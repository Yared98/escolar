use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::{DateTime, Utc};
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::Acquire;
use uuid::Uuid;

use crate::config::{AppState, ItauMode};
use crate::db::TenantDb;
use crate::error::AppError;
use crate::middleware::{auth::AuthUser, rbac::check_roles, tenant::ActiveTenant};
use crate::services::audit::log_audit;
use crate::services::itau_sts::{
    decifrar_chave_sessao_rsa, decifrar_texto_aes_256_cbc_iv_zero, gerar_chave_e_csr_sha512,
    gerar_par_rsa_2048, mascarar_client_id, obter_token_oauth_producao, parse_certificado_validade,
    pode_renovar_certificado, renovar_certificado_sts, solicitar_certificado_sts,
    testar_conexao_oauth,
};
use crate::services::secrets::{self, TipoSegredo};

const MSG_MOCK_BLOQUEIO: &str = "modo simulado: nada é enviado ao banco";

pub enum ItauHandlerError {
    App(AppError),
    BadGateway(String),
}

impl From<AppError> for ItauHandlerError {
    fn from(e: AppError) -> Self {
        ItauHandlerError::App(e)
    }
}

impl From<sqlx::Error> for ItauHandlerError {
    fn from(e: sqlx::Error) -> Self {
        ItauHandlerError::App(AppError::DatabaseError(e))
    }
}

impl From<(StatusCode, String)> for ItauHandlerError {
    fn from((status, msg): (StatusCode, String)) -> Self {
        if status == StatusCode::BAD_GATEWAY {
            ItauHandlerError::BadGateway(msg)
        } else {
            ItauHandlerError::App(AppError::BadRequest(msg))
        }
    }
}

impl IntoResponse for ItauHandlerError {
    fn into_response(self) -> Response {
        match self {
            ItauHandlerError::App(e) => e.into_response(),
            ItauHandlerError::BadGateway(msg) => (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": msg, "status": 502 })),
            )
                .into_response(),
        }
    }
}

#[derive(Serialize)]
pub struct ItauEstadoView {
    pub modo: String,
    pub ativo: bool,
    pub agencia: Option<String>,
    pub conta: Option<String>,
    pub dac: Option<String>,
    pub id_beneficiario: Option<String>,
    pub chave_pix: Option<String>,
    pub especie_padrao: String,
    pub multa_padrao_percentual: f64,
    pub juros_padrao_percentual: f64,
    pub ultimo_teste_ok_em: Option<DateTime<Utc>>,
    pub has_client_id: bool,
    pub client_id_mascarado: Option<String>,
    pub has_client_secret: bool,
    pub has_certificado: bool,
    pub certificado_valido_ate: Option<DateTime<Utc>>,
    pub pode_renovar: bool,
    pub has_chave_transporte: bool,
    pub chave_cifragem_configurada: bool,
    pub webhook_boleto_registrado_em: Option<DateTime<Utc>>,
    pub webhook_pix_registrado_em: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
pub struct SalvarDadosCobrancaDto {
    pub agencia: String,
    pub conta: String,
    pub dac: String,
    pub chave_pix: String,
    #[serde(default = "default_especie")]
    pub especie_padrao: String,
    #[serde(default = "default_multa")]
    pub multa_padrao_percentual: f64,
    #[serde(default = "default_juros")]
    pub juros_padrao_percentual: f64,
}

fn default_especie() -> String {
    "04".to_string()
}
fn default_multa() -> f64 {
    2.0
}
fn default_juros() -> f64 {
    1.0
}

#[derive(Deserialize, Default)]
pub struct GerarChaveTransporteDto {
    #[serde(default)]
    pub substituir: bool,
}

#[derive(Deserialize)]
pub struct ConfigurarCredenciaisProducaoDto {
    pub chave_sessao_cifrada: String,
    pub client_id_cifrado: String,
    pub token_temporario_cifrado: String,
}

#[derive(Deserialize)]
pub struct ConfigurarCredenciaisSandboxDto {
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Deserialize)]
pub struct AtivarIntegracaoDto {
    pub ativo: bool,
}

type ItauConfigTuple = (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    String,
    f64,
    f64,
    bool,
    Option<DateTime<Utc>>,
    Option<DateTime<Utc>>,
    Option<DateTime<Utc>>,
);

/// 1. GET /tenant/integrations/itau
pub async fn obter_estado_itau(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<ItauEstadoView>, ItauHandlerError> {
    check_roles(&auth_user, &["admin", "gestor"])?;
    let tenant_id = active_tenant.0;

    let config_row: Option<ItauConfigTuple> = sqlx::query_as(
        r#"
        SELECT agencia, conta, dac, id_beneficiario, chave_pix,
               especie_padrao, multa_padrao_percentual::float8, juros_padrao_percentual::float8,
               ativo, ultimo_teste_ok_em, webhook_boleto_registrado_em, webhook_pix_registrado_em
        FROM tenant_itau_config
        WHERE tenant_id = $1
        "#,
    )
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let (
        agencia,
        conta,
        dac,
        id_beneficiario,
        chave_pix,
        especie_padrao,
        multa_padrao_percentual,
        juros_padrao_percentual,
        ativo,
        ultimo_teste_ok_em,
        webhook_boleto_registrado_em,
        webhook_pix_registrado_em,
    ) = match config_row {
        Some((ag, cc, d, id_b, pix, esp, multa, juros, at, ult, wb, wp)) => {
            (ag, cc, d, id_b, pix, esp, multa, juros, at, ult, wb, wp)
        }
        None => (
            None,
            None,
            None,
            None,
            None,
            "04".to_string(),
            2.0,
            1.0,
            false,
            None,
            None,
            None,
        ),
    };

    let has_client_id = secrets::existe(&mut db, tenant_id, "itau", TipoSegredo::ClientId).await?;
    let has_client_secret =
        secrets::existe(&mut db, tenant_id, "itau", TipoSegredo::ClientSecret).await?;
    let has_certificado = secrets::existe(&mut db, tenant_id, "itau", TipoSegredo::Cert).await?;
    let has_chave_transporte =
        secrets::existe(&mut db, tenant_id, "itau", TipoSegredo::TransporteChave).await?;
    let chave_cifragem_configurada = state.config.app_secrets_key.is_some();

    let mut client_id_mascarado = None;
    let mut certificado_valido_ate = None;

    if chave_cifragem_configurada {
        if let Ok(chave_mestra) = secrets::exigir_chave(&state.config) {
            if has_client_id {
                if let Ok(Some(bytes)) = secrets::ler(
                    &mut db,
                    chave_mestra,
                    tenant_id,
                    "itau",
                    TipoSegredo::ClientId,
                )
                .await
                {
                    if let Ok(cid) = String::from_utf8(bytes) {
                        client_id_mascarado = Some(mascarar_client_id(&cid));
                    }
                }
            }

            if has_certificado {
                if let Ok(Some(bytes)) =
                    secrets::ler(&mut db, chave_mestra, tenant_id, "itau", TipoSegredo::Cert).await
                {
                    if let Ok(cert_str) = String::from_utf8(bytes) {
                        if let Ok(validade) = parse_certificado_validade(&cert_str) {
                            certificado_valido_ate = Some(validade);
                        }
                    }
                }
            }
        }
    }

    let pode_renovar = pode_renovar_certificado(certificado_valido_ate);

    Ok(Json(ItauEstadoView {
        modo: state.config.itau_mode.to_string(),
        ativo,
        agencia,
        conta,
        dac,
        id_beneficiario,
        chave_pix,
        especie_padrao,
        multa_padrao_percentual,
        juros_padrao_percentual,
        ultimo_teste_ok_em,
        has_client_id,
        client_id_mascarado,
        has_client_secret,
        has_certificado,
        certificado_valido_ate,
        pode_renovar,
        has_chave_transporte,
        chave_cifragem_configurada,
        webhook_boleto_registrado_em,
        webhook_pix_registrado_em,
    }))
}

/// 2. PUT /tenant/integrations/itau/dados
pub async fn salvar_dados_cobranca_itau(
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<SalvarDadosCobrancaDto>,
) -> Result<Json<Value>, ItauHandlerError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;

    let agencia = dto.agencia.trim();
    if agencia.len() != 4 || !agencia.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest(
            "Agência deve ter exatamente 4 dígitos numéricos.".into(),
        )
        .into());
    }

    let conta = dto.conta.trim();
    if conta.len() != 7 || !conta.chars().all(|c| c.is_ascii_digit()) {
        return Err(
            AppError::BadRequest("Conta deve ter exatamente 7 dígitos numéricos.".into()).into(),
        );
    }

    let dac = dto.dac.trim();
    if dac.len() != 1 || !dac.chars().all(|c| c.is_ascii_digit()) {
        return Err(
            AppError::BadRequest("DAC deve ter exatamente 1 dígito numérico.".into()).into(),
        );
    }

    let chave_pix = dto.chave_pix.trim();
    if chave_pix.is_empty() || chave_pix.len() > 77 {
        return Err(
            AppError::BadRequest("Chave Pix deve ter entre 1 e 77 caracteres.".into()).into(),
        );
    }

    let especie = dto.especie_padrao.trim();
    if especie.len() != 2 || !especie.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest(
            "Espécie padrão deve ter exatamente 2 dígitos numéricos.".into(),
        )
        .into());
    }

    if dto.multa_padrao_percentual < 0.0 {
        return Err(
            AppError::BadRequest("Multa padrão deve ser maior ou igual a zero.".into()).into(),
        );
    }

    if dto.juros_padrao_percentual < 0.0 {
        return Err(
            AppError::BadRequest("Juros padrão deve ser maior ou igual a zero.".into()).into(),
        );
    }

    let id_beneficiario = format!("{agencia}{conta}{dac}");

    sqlx::query(
        r#"
        INSERT INTO tenant_itau_config (
            tenant_id, agencia, conta, dac, id_beneficiario, chave_pix,
            especie_padrao, multa_padrao_percentual, juros_padrao_percentual, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (tenant_id) DO UPDATE SET
            agencia = EXCLUDED.agencia,
            conta = EXCLUDED.conta,
            dac = EXCLUDED.dac,
            id_beneficiario = EXCLUDED.id_beneficiario,
            chave_pix = EXCLUDED.chave_pix,
            especie_padrao = EXCLUDED.especie_padrao,
            multa_padrao_percentual = EXCLUDED.multa_padrao_percentual,
            juros_padrao_percentual = EXCLUDED.juros_padrao_percentual,
            updated_at = NOW()
        "#,
    )
    .bind(tenant_id)
    .bind(agencia)
    .bind(conta)
    .bind(dac)
    .bind(&id_beneficiario)
    .bind(chave_pix)
    .bind(especie)
    .bind(dto.multa_padrao_percentual)
    .bind(dto.juros_padrao_percentual)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "itau_dados_cobranca",
        "tenant_itau_config",
        Some(tenant_id.to_string()),
        Some(json!({ "id_beneficiario": id_beneficiario })),
    )
    .await;

    Ok(Json(
        json!({ "ok": true, "id_beneficiario": id_beneficiario }),
    ))
}

/// 3. POST /tenant/integrations/itau/chave-transporte
pub async fn gerar_chave_transporte_itau(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<GerarChaveTransporteDto>,
) -> Result<Json<Value>, ItauHandlerError> {
    check_roles(&auth_user, &["admin"])?;
    if state.config.itau_mode == ItauMode::Mock {
        return Err(AppError::BadRequest(MSG_MOCK_BLOQUEIO.into()).into());
    }
    let chave_mestra = secrets::exigir_chave(&state.config)?;
    let tenant_id = active_tenant.0;

    let ja_existe =
        secrets::existe(&mut db, tenant_id, "itau", TipoSegredo::TransporteChave).await?;
    if ja_existe && !dto.substituir {
        return Err(AppError::Conflict(
            "Chave de transporte já existe. Envie substituir=true para gerar uma nova.".into(),
        )
        .into());
    }

    let (priv_pem, pub_pem) = gerar_par_rsa_2048()?;

    secrets::salvar(
        &mut db,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::TransporteChave,
        priv_pem.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "itau_chave_transporte",
        "tenant_gateway_secrets",
        Some(tenant_id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "chave_publica_pem": pub_pem })))
}

/// 4. POST /tenant/integrations/itau/credenciais
pub async fn configurar_credenciais_producao_itau(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<ConfigurarCredenciaisProducaoDto>,
) -> Result<Json<Value>, ItauHandlerError> {
    check_roles(&auth_user, &["admin"])?;
    if state.config.itau_mode == ItauMode::Mock {
        return Err(AppError::BadRequest(MSG_MOCK_BLOQUEIO.into()).into());
    }
    if state.config.itau_mode == ItauMode::Sandbox {
        return Err(AppError::BadRequest(
            "Em modo sandbox utilize a rota /tenant/integrations/itau/credenciais-sandbox".into(),
        )
        .into());
    }
    let chave_mestra = secrets::exigir_chave(&state.config)?;
    let tenant_id = active_tenant.0;

    let transporte_priv_bytes = secrets::ler(
        &mut db,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::TransporteChave,
    )
    .await?
    .ok_or_else(|| {
        AppError::BadRequest(
            "Chave de transporte privada não encontrada. Gere a chave de transporte primeiro."
                .into(),
        )
    })?;

    let transporte_priv_pem = String::from_utf8(transporte_priv_bytes)
        .map_err(|_| AppError::InternalServerError("Chave de transporte corrompida".into()))?;

    let session_key = decifrar_chave_sessao_rsa(&transporte_priv_pem, &dto.chave_sessao_cifrada)?;
    let client_id =
        decifrar_texto_aes_256_cbc_iv_zero(&session_key, &dto.client_id_cifrado, "Client ID")?;
    let token_temporario = decifrar_texto_aes_256_cbc_iv_zero(
        &session_key,
        &dto.token_temporario_cifrado,
        "Token temporário",
    )?;

    let tenant_name: String = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_one(&mut *db)
        .await
        .unwrap_or_else(|_| "Escola".to_string());

    let (_cert_priv_rsa, cert_priv_pem, csr_pem) =
        gerar_chave_e_csr_sha512(&client_id, &tenant_name)?;

    let (cert_pem, client_secret) =
        match solicitar_certificado_sts(state.config.itau_sts_url(), &token_temporario, &csr_pem)
            .await
        {
            Ok(pair) => pair,
            Err(err) => match err {
                Ok(pair) => pair,
                Err((status, msg)) => {
                    if status == StatusCode::BAD_GATEWAY {
                        return Err(ItauHandlerError::BadGateway(msg));
                    } else {
                        return Err(AppError::BadRequest(msg).into());
                    }
                }
            },
        };

    let mut tx = db.begin().await?;

    secrets::salvar(
        &mut tx,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::Cert,
        cert_pem.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    secrets::salvar(
        &mut tx,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::CertChave,
        cert_priv_pem.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    secrets::salvar(
        &mut tx,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::ClientId,
        client_id.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    secrets::salvar(
        &mut tx,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::ClientSecret,
        client_secret.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    secrets::apagar(&mut tx, tenant_id, "itau", TipoSegredo::TransporteChave).await?;

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "itau_credenciais_producao",
        "tenant_gateway_secrets",
        Some(tenant_id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "ok": true })))
}

/// 5. POST /tenant/integrations/itau/credenciais-sandbox
pub async fn configurar_credenciais_sandbox_itau(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<ConfigurarCredenciaisSandboxDto>,
) -> Result<Json<Value>, ItauHandlerError> {
    check_roles(&auth_user, &["admin"])?;
    if state.config.itau_mode != ItauMode::Sandbox {
        return Err(AppError::BadRequest(
            "Credenciais de sandbox só podem ser configuradas quando ITAU_MODE=sandbox".into(),
        )
        .into());
    }
    let chave_mestra = secrets::exigir_chave(&state.config)?;
    let tenant_id = active_tenant.0;

    let client_id = dto.client_id.trim();
    let client_secret = dto.client_secret.trim();
    if client_id.is_empty() || client_secret.is_empty() {
        return Err(
            AppError::BadRequest("Client ID e Client Secret não podem ser vazios.".into()).into(),
        );
    }

    let mut tx = db.begin().await?;

    secrets::salvar(
        &mut tx,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::ClientId,
        client_id.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    secrets::salvar(
        &mut tx,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::ClientSecret,
        client_secret.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "itau_credenciais_sandbox",
        "tenant_gateway_secrets",
        Some(tenant_id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "ok": true })))
}

/// 6. POST /tenant/integrations/itau/testar
pub async fn testar_conexao_itau(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Value>, ItauHandlerError> {
    check_roles(&auth_user, &["admin"])?;
    if state.config.itau_mode == ItauMode::Mock {
        return Err(AppError::BadRequest(MSG_MOCK_BLOQUEIO.into()).into());
    }
    let chave_mestra = secrets::exigir_chave(&state.config)?;
    let tenant_id = active_tenant.0;

    let client_id_bytes = secrets::ler(
        &mut db,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::ClientId,
    )
    .await?
    .ok_or_else(|| AppError::BadRequest("Client ID não configurado".into()))?;
    let client_secret_bytes = secrets::ler(
        &mut db,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::ClientSecret,
    )
    .await?
    .ok_or_else(|| AppError::BadRequest("Client Secret não configurado".into()))?;

    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|_| AppError::InternalServerError("Client ID inválido".into()))?;
    let client_secret = String::from_utf8(client_secret_bytes)
        .map_err(|_| AppError::InternalServerError("Client Secret inválido".into()))?;

    let is_sandbox = state.config.itau_mode == ItauMode::Sandbox;

    let (cert_pem, cert_key_pem) = if is_sandbox {
        (None, None)
    } else {
        let cert_bytes = secrets::ler(&mut db, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
            .await?
            .ok_or_else(|| AppError::BadRequest("Certificado não encontrado no banco".into()))?;
        let cert_key_bytes = secrets::ler(
            &mut db,
            chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
        )
        .await?
        .ok_or_else(|| {
            AppError::BadRequest("Chave privada do certificado não encontrada no banco".into())
        })?;
        let c = String::from_utf8(cert_bytes)
            .map_err(|_| AppError::InternalServerError("Certificado corrompido".into()))?;
        let k = String::from_utf8(cert_key_bytes)
            .map_err(|_| AppError::InternalServerError("Chave do certificado corrompida".into()))?;
        (Some(c), Some(k))
    };

    testar_conexao_oauth(
        state.config.itau_sts_url(),
        is_sandbox,
        &client_id,
        &client_secret,
        cert_pem.as_deref(),
        cert_key_pem.as_deref(),
    )
    .await?;

    sqlx::query(
        r#"
        INSERT INTO tenant_itau_config (tenant_id, ultimo_teste_ok_em, updated_at)
        VALUES ($1, NOW(), NOW())
        ON CONFLICT (tenant_id) DO UPDATE SET
            ultimo_teste_ok_em = NOW(),
            updated_at = NOW()
        "#,
    )
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "itau_testar_conexao",
        "tenant_itau_config",
        Some(tenant_id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "ok": true })))
}

/// 7. POST /tenant/integrations/itau/ativar
pub async fn ativar_integracao_itau(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<AtivarIntegracaoDto>,
) -> Result<Json<Value>, ItauHandlerError> {
    check_roles(&auth_user, &["admin"])?;
    if state.config.itau_mode == ItauMode::Mock {
        return Err(AppError::BadRequest(MSG_MOCK_BLOQUEIO.into()).into());
    }
    let _ = secrets::exigir_chave(&state.config)?;
    let tenant_id = active_tenant.0;

    if dto.ativo {
        let ultimo_teste: Option<DateTime<Utc>> = sqlx::query_scalar(
            "SELECT ultimo_teste_ok_em FROM tenant_itau_config WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_optional(&mut *db)
        .await?
        .flatten();

        if ultimo_teste.is_none() {
            return Err(AppError::Conflict(
                "Conexão com o Itaú deve ser testada com sucesso antes da ativação.".into(),
            )
            .into());
        }
    }

    sqlx::query(
        r#"
        INSERT INTO tenant_itau_config (tenant_id, ativo, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (tenant_id) DO UPDATE SET
            ativo = EXCLUDED.ativo,
            updated_at = NOW()
        "#,
    )
    .bind(tenant_id)
    .bind(dto.ativo)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "itau_ativar",
        "tenant_itau_config",
        Some(tenant_id.to_string()),
        Some(json!({ "ativo": dto.ativo })),
    )
    .await;

    Ok(Json(json!({ "ok": true, "ativo": dto.ativo })))
}

/// 8. POST /tenant/integrations/itau/renovar
pub async fn renovar_certificado_itau(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Value>, ItauHandlerError> {
    check_roles(&auth_user, &["admin"])?;
    if state.config.itau_mode == ItauMode::Mock {
        return Err(AppError::BadRequest(MSG_MOCK_BLOQUEIO.into()).into());
    }
    let chave_mestra = secrets::exigir_chave(&state.config)?;
    let tenant_id = active_tenant.0;

    let cert_bytes = secrets::ler(&mut db, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
        .await?
        .ok_or_else(|| AppError::BadRequest("Certificado atual não encontrado".into()))?;
    let cert_key_bytes = secrets::ler(
        &mut db,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::CertChave,
    )
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Chave privada do certificado atual não encontrada".into())
    })?;
    let client_id_bytes = secrets::ler(
        &mut db,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::ClientId,
    )
    .await?
    .ok_or_else(|| AppError::BadRequest("Client ID não encontrado".into()))?;
    let client_secret_bytes = secrets::ler(
        &mut db,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::ClientSecret,
    )
    .await?
    .ok_or_else(|| AppError::BadRequest("Client Secret não encontrado".into()))?;

    let cert_pem = String::from_utf8(cert_bytes)
        .map_err(|_| AppError::InternalServerError("Certificado corrompido".into()))?;
    let cert_key_pem = String::from_utf8(cert_key_bytes)
        .map_err(|_| AppError::InternalServerError("Chave do certificado corrompida".into()))?;
    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|_| AppError::InternalServerError("Client ID corrompido".into()))?;
    let client_secret = String::from_utf8(client_secret_bytes)
        .map_err(|_| AppError::InternalServerError("Client Secret corrompido".into()))?;

    let validade = parse_certificado_validade(&cert_pem)?;
    if !pode_renovar_certificado(Some(validade)) {
        return Err(AppError::BadRequest(
            "Certificado só pode ser renovado quando faltarem 30 dias ou menos para a expiração."
                .into(),
        )
        .into());
    }

    let tenant_name: String = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_one(&mut *db)
        .await
        .unwrap_or_else(|_| "Escola".to_string());

    let access_token = obter_token_oauth_producao(
        state.config.itau_sts_url(),
        &client_id,
        &client_secret,
        &cert_pem,
        &cert_key_pem,
    )
    .await?;

    let (_nova_cert_priv_rsa, nova_cert_priv_pem, novo_csr_pem) =
        gerar_chave_e_csr_sha512(&client_id, &tenant_name)?;

    let novo_cert_pem = renovar_certificado_sts(
        state.config.itau_sts_url(),
        &access_token,
        &novo_csr_pem,
        &cert_pem,
        &cert_key_pem,
    )
    .await?;

    let mut tx = db.begin().await?;

    secrets::salvar(
        &mut tx,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::Cert,
        novo_cert_pem.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    secrets::salvar(
        &mut tx,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::CertChave,
        nova_cert_priv_pem.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "itau_renovar_certificado",
        "tenant_gateway_secrets",
        Some(tenant_id.to_string()),
        None,
    )
    .await;

    Ok(Json(json!({ "ok": true })))
}

/// POST /tenant/integrations/itau/webhooks/boleto
pub async fn cadastrar_webhook_boleto_itau(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Value>, ItauHandlerError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;

    if state.config.itau_mode == ItauMode::Mock {
        return Err(AppError::BadRequest(
            "Modo simulado ativo: cadastro de webhook no Itaú não disponível.".into(),
        )
        .into());
    }

    let webhook_base_url_owned = state.config.itau_webhook_base_url().ok_or_else(|| {
        AppError::BadRequest(
            "URL pública de webhook não configurada no servidor (ITAU_WEBHOOK_BASE_URL).".into(),
        )
    })?;
    let webhook_base_url = webhook_base_url_owned.trim().trim_end_matches('/');
    if webhook_base_url.is_empty() {
        return Err(AppError::BadRequest(
            "URL pública de webhook não configurada no servidor (ITAU_WEBHOOK_BASE_URL).".into(),
        )
        .into());
    }

    let chave_mestra = secrets::exigir_chave(&state.config)?;

    let has_cid = secrets::existe(&mut db, tenant_id, "itau", TipoSegredo::ClientId).await?;
    let has_sec = secrets::existe(&mut db, tenant_id, "itau", TipoSegredo::ClientSecret).await?;
    if !has_cid || !has_sec {
        return Err(AppError::BadRequest(
            "Credenciais do Itaú não configuradas para este tenant.".into(),
        )
        .into());
    }

    let config_row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT id_beneficiario FROM tenant_itau_config WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;

    let id_beneficiario = match config_row.and_then(|r| r.0) {
        Some(s) if !s.trim().is_empty() => s,
        _ => {
            return Err(AppError::BadRequest(
                "Dados de cobrança do Itaú (agência/conta) não configurados.".into(),
            )
            .into());
        }
    };

    let webhook_client_id = Uuid::new_v4().to_string();
    let mut secret_bytes = [0u8; 32];
    SystemRandom::new()
        .fill(&mut secret_bytes)
        .map_err(|_| AppError::InternalServerError("Falha ao gerar segredo aleatório".into()))?;
    let webhook_client_secret = hex::encode(secret_bytes);
    let secret_hash = hex::encode(Sha256::digest(webhook_client_secret.as_bytes()));

    secrets::salvar(
        &mut db,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::WebhookClientSecretHash,
        secret_hash.as_bytes(),
        Some(auth_user.id),
    )
    .await?;

    let webhook_url = format!("{webhook_base_url}/webhooks/itau/{tenant_id}/boletos");
    let webhook_oauth_url = format!("{webhook_base_url}/webhooks/itau/{tenant_id}/oauth/token");

    crate::services::itau_api::cadastrar_webhook_boletos(
        &state.config,
        &mut db,
        tenant_id,
        &id_beneficiario,
        &webhook_url,
        &webhook_oauth_url,
        &webhook_client_id,
        &webhook_client_secret,
    )
    .await
    .map_err(|e| match e {
        crate::services::itau_api::ItauApiError::BadGateway(msg) => {
            ItauHandlerError::BadGateway(msg)
        }
        crate::services::itau_api::ItauApiError::App(err) => ItauHandlerError::App(err),
        crate::services::itau_api::ItauApiError::Rejeitado { status, corpo } => {
            ItauHandlerError::BadGateway(format!("Itaú retornou {status}: {corpo}"))
        }
    })?;

    sqlx::query(
        r#"
        UPDATE tenant_itau_config
        SET webhook_client_id = $1,
            webhook_boleto_registrado_em = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $2
        "#,
    )
    .bind(&webhook_client_id)
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "itau_webhook_boleto_cadastrado",
        "tenant_itau_config",
        Some(tenant_id.to_string()),
        Some(json!({
            "webhook_client_id": webhook_client_id,
            "webhook_url": webhook_url,
            "webhook_oauth_url": webhook_oauth_url,
        })),
    )
    .await;

    Ok(Json(json!({
        "status": "ok",
        "webhook_client_id": webhook_client_id,
        "webhook_url": webhook_url,
        "webhook_oauth_url": webhook_oauth_url,
        "registrado_em": Utc::now()
    })))
}

/// POST /tenant/integrations/itau/webhooks/pix
pub async fn cadastrar_webhook_pix_itau(
    State(state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Value>, ItauHandlerError> {
    check_roles(&auth_user, &["admin"])?;
    let tenant_id = active_tenant.0;

    if state.config.itau_mode == ItauMode::Mock {
        return Err(AppError::BadRequest(
            "Modo simulado ativo: cadastro de webhook no Itaú não disponível.".into(),
        )
        .into());
    }

    let webhook_base_url_owned = state.config.itau_webhook_base_url().ok_or_else(|| {
        AppError::BadRequest(
            "URL pública de webhook não configurada no servidor (ITAU_WEBHOOK_BASE_URL).".into(),
        )
    })?;
    let webhook_base_url = webhook_base_url_owned.trim().trim_end_matches('/');
    if webhook_base_url.is_empty() {
        return Err(AppError::BadRequest(
            "URL pública de webhook não configurada no servidor (ITAU_WEBHOOK_BASE_URL).".into(),
        )
        .into());
    }

    let has_cid = secrets::existe(&mut db, tenant_id, "itau", TipoSegredo::ClientId).await?;
    let has_sec = secrets::existe(&mut db, tenant_id, "itau", TipoSegredo::ClientSecret).await?;
    if !has_cid || !has_sec {
        return Err(AppError::BadRequest(
            "Credenciais do Itaú não configuradas para este tenant.".into(),
        )
        .into());
    }

    let config_row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT chave_pix FROM tenant_itau_config WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;

    let chave_pix = match config_row.and_then(|r| r.0) {
        Some(s) if !s.trim().is_empty() => s,
        _ => {
            return Err(AppError::BadRequest(
                "Chave Pix do Itaú não configurada para este tenant.".into(),
            )
            .into());
        }
    };

    let webhook_url = format!("{webhook_base_url}/webhooks/itau/{tenant_id}");

    crate::services::itau_api::cadastrar_webhook_pix(
        &state.config,
        &mut db,
        tenant_id,
        &chave_pix,
        &webhook_url,
    )
    .await
    .map_err(|e| match e {
        crate::services::itau_api::ItauApiError::BadGateway(msg) => {
            ItauHandlerError::BadGateway(msg)
        }
        crate::services::itau_api::ItauApiError::App(err) => ItauHandlerError::App(err),
        crate::services::itau_api::ItauApiError::Rejeitado { status, corpo } => {
            ItauHandlerError::BadGateway(format!("Itaú retornou {status}: {corpo}"))
        }
    })?;

    sqlx::query(
        r#"
        UPDATE tenant_itau_config
        SET webhook_pix_registrado_em = NOW(),
            updated_at = NOW()
        WHERE tenant_id = $1
        "#,
    )
    .bind(tenant_id)
    .execute(&mut *db)
    .await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "itau_webhook_pix_cadastrado",
        "tenant_itau_config",
        Some(tenant_id.to_string()),
        Some(json!({
            "webhook_url": webhook_url,
            "chave_pix": chave_pix,
        })),
    )
    .await;

    Ok(Json(json!({
        "status": "ok",
        "webhook_url": webhook_url,
        "chave_pix": chave_pix,
        "registrado_em": Utc::now()
    })))
}
