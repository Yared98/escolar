use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::Utc;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use uuid::Uuid;

use crate::config::{AppState, ChaveMestra};
use crate::error::AppError;
use crate::services::secrets::{self, TipoSegredo};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Deserialize, Default)]
pub struct TokenRequestForm {
    pub grant_type: Option<String>,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

pub fn derivar_chave_webhook_token(chave_mestra: &ChaveMestra) -> Result<[u8; 32], AppError> {
    let mut mac = HmacSha256::new_from_slice(chave_mestra.bytes())
        .map_err(|e| AppError::InternalServerError(format!("Falha ao inicializar HMAC: {e}")))?;
    mac.update(b"itau-webhook-token");
    let result = mac.finalize().into_bytes();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result[..32]);
    Ok(key)
}

pub fn gerar_webhook_token(
    tenant_id: Uuid,
    chave_mestra: &ChaveMestra,
    validade_segundos: i64,
) -> Result<String, AppError> {
    let derived_key = derivar_chave_webhook_token(chave_mestra)?;
    let exp = Utc::now().timestamp() + validade_segundos;
    let payload_str = format!("{tenant_id}|{exp}");
    let payload_b64 = URL_SAFE_NO_PAD.encode(payload_str.as_bytes());

    let mut signer = HmacSha256::new_from_slice(&derived_key)
        .map_err(|e| AppError::InternalServerError(format!("Falha ao assinar token: {e}")))?;
    signer.update(payload_b64.as_bytes());
    let sig_bytes = signer.finalize().into_bytes();
    let sig_b64 = URL_SAFE_NO_PAD.encode(sig_bytes);

    Ok(format!("{payload_b64}.{sig_b64}"))
}

pub fn validar_webhook_token(
    token: &str,
    expected_tenant_id: Uuid,
    chave_mestra: &ChaveMestra,
) -> Result<(), &'static str> {
    let derived_key = derivar_chave_webhook_token(chave_mestra).map_err(|_| "erro_chave")?;

    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 2 {
        return Err("token_malformado");
    }

    let payload_b64 = parts[0];
    let sig_b64 = parts[1];

    let provided_sig = URL_SAFE_NO_PAD
        .decode(sig_b64)
        .map_err(|_| "assinatura_invalida")?;

    let mut verifier = HmacSha256::new_from_slice(&derived_key).map_err(|_| "falha_verificador")?;
    verifier.update(payload_b64.as_bytes());
    let expected_sig = verifier.finalize().into_bytes();

    let sig_len_match = expected_sig.len().ct_eq(&provided_sig.len());
    let sig_bytes_match = expected_sig.as_slice().ct_eq(provided_sig.as_slice());
    let sig_valida: bool = (sig_len_match & sig_bytes_match).into();

    if !sig_valida {
        return Err("assinatura_invalida");
    }

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|_| "payload_invalido")?;
    let payload_str = String::from_utf8(payload_bytes).map_err(|_| "payload_invalido")?;

    let subparts: Vec<&str> = payload_str.split('|').collect();
    if subparts.len() != 2 {
        return Err("payload_invalido");
    }

    let token_tenant: Uuid = subparts[0].parse().map_err(|_| "tenant_invalido")?;
    let exp: i64 = subparts[1].parse().map_err(|_| "exp_invalido")?;

    if token_tenant != expected_tenant_id {
        return Err("tenant_divergente");
    }

    if exp <= Utc::now().timestamp() {
        return Err("token_expirado");
    }

    Ok(())
}

fn erro_invalid_client() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": "invalid_client" })),
    )
        .into_response()
}

fn erro_unauthorized(msg: &str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": msg, "status": 401 })),
    )
        .into_response()
}

fn parse_form_urlencoded(body: &str) -> TokenRequestForm {
    let mut form = TokenRequestForm::default();
    for part in body.split('&') {
        if let Some((k, v)) = part.split_once('=') {
            let val = v.replace('+', " ");
            match k {
                "grant_type" => form.grant_type = Some(val),
                "client_id" => form.client_id = Some(val),
                "client_secret" => form.client_secret = Some(val),
                _ => {}
            }
        }
    }
    form
}

pub async fn itau_oauth_token_handler(
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    headers: HeaderMap,
    body_bytes: Bytes,
) -> Result<Response, AppError> {
    let mut provided_client_id = None;
    let mut provided_client_secret = None;
    let mut grant_type = None;

    // 1. Tentar ler do cabeçalho Authorization: Basic ...
    if let Some(auth_header) = headers.get(header::AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(stripped) = auth_str.strip_prefix("Basic ") {
                if let Ok(decoded_bytes) =
                    base64::engine::general_purpose::STANDARD.decode(stripped.trim())
                {
                    if let Ok(decoded_str) = String::from_utf8(decoded_bytes) {
                        if let Some((cid, sec)) = decoded_str.split_once(':') {
                            provided_client_id = Some(cid.to_string());
                            provided_client_secret = Some(sec.to_string());
                        }
                    }
                }
            }
        }
    }

    // 2. Ler do corpo (form ou JSON) caso não esteja completo no Basic
    if let Ok(body_str) = std::str::from_utf8(&body_bytes) {
        let form = parse_form_urlencoded(body_str);
        if grant_type.is_none() {
            grant_type = form.grant_type;
        }
        if provided_client_id.is_none() {
            provided_client_id = form.client_id;
        }
        if provided_client_secret.is_none() {
            provided_client_secret = form.client_secret;
        }
    }
    if grant_type.is_none() || provided_client_id.is_none() || provided_client_secret.is_none() {
        if let Ok(json_val) = serde_json::from_slice::<Value>(&body_bytes) {
            if grant_type.is_none() {
                grant_type = json_val
                    .get("grant_type")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
            }
            if provided_client_id.is_none() {
                provided_client_id = json_val
                    .get("client_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
            }
            if provided_client_secret.is_none() {
                provided_client_secret = json_val
                    .get("client_secret")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
            }
        }
    }

    if grant_type.as_deref() != Some("client_credentials") {
        return Ok(erro_invalid_client());
    }

    let (Some(cid), Some(sec)) = (provided_client_id, provided_client_secret) else {
        return Ok(erro_invalid_client());
    };

    let chave_mestra = match secrets::exigir_chave(&state.config) {
        Ok(k) => k,
        Err(_) => return Ok(erro_invalid_client()),
    };

    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    let row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT webhook_client_id FROM tenant_itau_config WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;

    let stored_client_id = match row.and_then(|r| r.0) {
        Some(s) if !s.is_empty() => s,
        _ => return Ok(erro_invalid_client()),
    };

    let stored_secret_hash_bytes = match secrets::ler(
        &mut db,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::WebhookClientSecretHash,
    )
    .await
    {
        Ok(Some(b)) => b,
        _ => return Ok(erro_invalid_client()),
    };

    let stored_secret_hash_str = match String::from_utf8(stored_secret_hash_bytes) {
        Ok(s) => s,
        Err(_) => return Ok(erro_invalid_client()),
    };

    // Calcular hash SHA-256 do secret recebido (hex em minúsculas)
    let provided_hash = hex::encode(Sha256::digest(sec.as_bytes()));

    // Comparação em tempo constante de client_id e do hash do secret
    let cid_expected = stored_client_id.as_bytes();
    let cid_provided = cid.as_bytes();
    let cid_len_match = cid_expected.len().ct_eq(&cid_provided.len());
    let cid_bytes_match = cid_expected.ct_eq(cid_provided);

    let hash_expected = stored_secret_hash_str.to_lowercase().into_bytes();
    let hash_provided = provided_hash.as_bytes();
    let hash_len_match = hash_expected.len().ct_eq(&hash_provided.len());
    let hash_bytes_match = hash_expected.as_slice().ct_eq(hash_provided);

    let valido: bool = (cid_len_match & cid_bytes_match & hash_len_match & hash_bytes_match).into();

    if !valido {
        return Ok(erro_invalid_client());
    }

    let token = gerar_webhook_token(tenant_id, chave_mestra, 300)?;

    Ok((
        StatusCode::OK,
        Json(TokenResponse {
            access_token: token,
            token_type: "Bearer".to_string(),
            expires_in: 300,
        }),
    )
        .into_response())
}

pub async fn itau_boletos_webhook_handler(
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    headers: HeaderMap,
    body_bytes: Bytes,
) -> Result<Response, AppError> {
    // 1. Validar Authorization: Bearer <token>
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .unwrap_or_default();

    let token = match auth_header.strip_prefix("Bearer ") {
        Some(t) => t.trim(),
        None => return Ok(erro_unauthorized("invalid_token")),
    };

    let chave_mestra = match secrets::exigir_chave(&state.config) {
        Ok(k) => k,
        Err(_) => return Ok(erro_unauthorized("invalid_token")),
    };

    if let Err(_reason) = validar_webhook_token(token, tenant_id, chave_mestra) {
        return Ok(erro_unauthorized("invalid_token"));
    }

    // 2. Extrair boletos do payload (lista boletos[] ou objeto único)
    let body_val: Value = match serde_json::from_slice(&body_bytes) {
        Ok(v) => v,
        Err(_) => {
            return Ok((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "JSON inválido" })),
            )
                .into_response())
        }
    };

    let boletos_list: Vec<Value> =
        if let Some(arr) = body_val.get("boletos").and_then(|b| b.as_array()) {
            arr.clone()
        } else if body_val.is_object() {
            vec![body_val.clone()]
        } else {
            vec![]
        };

    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    for item in &boletos_list {
        let id_boleto = item
            .get("idBoleto")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let tipo_liquidacao = item
            .get("tipoLiquidacao")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let data_inclusao = item
            .get("dataInclusaoPagamento")
            .and_then(|v| v.as_str())
            .unwrap_or_default();

        let event_id = format!("{id_boleto}:{tipo_liquidacao}:{data_inclusao}");

        sqlx::query(
            r#"
            INSERT INTO gateway_avisos (tenant_id, gateway_name, tipo, event_id, payload, status, tentativas, proxima_tentativa_em)
            VALUES ($1, 'itau', 'boleto', $2, $3, 'pendente', 0, NOW())
            ON CONFLICT (tenant_id, gateway_name, event_id) DO NOTHING
            "#
        )
        .bind(tenant_id)
        .bind(&event_id)
        .bind(item)
        .execute(&mut *db)
        .await?;
    }

    // Disparar processamento em background fora da requisição
    let state_clone = state.clone();
    tokio::spawn(async move {
        if let Err(e) =
            crate::services::itau_avisos::processar_pendentes(&state_clone, tenant_id).await
        {
            tracing::warn!(tenant_id = %tenant_id, error = %e, "erro no processamento assíncrono de avisos do Itaú");
        }
    });

    Ok((StatusCode::OK, Json(json!({ "status": "received" }))).into_response())
}

pub async fn itau_pix_webhook_handler(
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    body_bytes: Bytes,
) -> Result<Response, AppError> {
    // 1. Limite de tamanho de corpo (256 KB)
    if body_bytes.len() > 256 * 1024 {
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "payload_too_large" })),
        )
            .into_response());
    }

    // 2. Parse do JSON
    let body_val: Value = match serde_json::from_slice(&body_bytes) {
        Ok(v) => v,
        Err(_) => {
            return Ok((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "JSON inválido" })),
            )
                .into_response())
        }
    };

    // 3. Conexão tenant e verificação se o tenant existe e integração está ativa
    let mut db = match crate::db::acquire_tenant(&state.pool, tenant_id).await {
        Ok(conn) => conn,
        Err(e) => {
            tracing::warn!(tenant_id = %tenant_id, error = %e, "webhook pix recebido mas falha ao conectar ao tenant");
            return Ok((StatusCode::OK, Json(json!({ "status": "received" }))).into_response());
        }
    };

    let config_row: Option<(bool,)> =
        sqlx::query_as("SELECT ativo FROM tenant_itau_config WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_optional(&mut *db)
            .await?;

    let ativo = config_row.map(|r| r.0).unwrap_or(false);
    if !ativo {
        tracing::warn!(tenant_id = %tenant_id, "webhook pix recebido para tenant inexistente ou integracao inativa; ignorado");
        return Ok((StatusCode::OK, Json(json!({ "status": "received" }))).into_response());
    }

    // 4. Extrair lista de pix
    let pix_list: Vec<Value> = if let Some(arr) = body_val.get("pix").and_then(|b| b.as_array()) {
        arr.clone()
    } else if body_val.is_object() && body_val.get("endToEndId").is_some() {
        vec![body_val.clone()]
    } else {
        vec![]
    };

    if pix_list.len() > 100 {
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "limite de itens excedido" })),
        )
            .into_response());
    }

    // 5. Para cada item: validar endToEndId [a-zA-Z0-9]{32} e gravar em gateway_avisos
    for item in &pix_list {
        let e2eid = item
            .get("endToEndId")
            .and_then(|v| v.as_str())
            .unwrap_or_default();

        if e2eid.len() != 32 || !e2eid.chars().all(|c| c.is_ascii_alphanumeric()) {
            continue;
        }

        sqlx::query(
            r#"
            INSERT INTO gateway_avisos (tenant_id, gateway_name, tipo, event_id, payload, status, tentativas, proxima_tentativa_em)
            VALUES ($1, 'itau', 'pix', $2, $3, 'pendente', 0, NOW())
            ON CONFLICT (tenant_id, gateway_name, event_id) DO NOTHING
            "#
        )
        .bind(tenant_id)
        .bind(e2eid)
        .bind(item)
        .execute(&mut *db)
        .await?;
    }

    // 6. Disparar processamento assíncrono em tokio::spawn
    let state_clone = state.clone();
    tokio::spawn(async move {
        if let Err(e) =
            crate::services::itau_avisos::processar_pendentes(&state_clone, tenant_id).await
        {
            tracing::warn!(tenant_id = %tenant_id, error = %e, "erro no processamento assíncrono de avisos do Itaú");
        }
    });

    Ok((StatusCode::OK, Json(json!({ "status": "received" }))).into_response())
}
