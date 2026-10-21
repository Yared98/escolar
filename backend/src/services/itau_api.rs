use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Instant;

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgConnection;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::{Config, ItauMode};
use crate::error::AppError;
use crate::services::secrets::{self, TipoSegredo};

#[derive(Debug)]
pub enum ItauApiError {
    App(AppError),
    BadGateway(String),
    Rejeitado { status: u16, corpo: Value },
}

impl From<AppError> for ItauApiError {
    fn from(e: AppError) -> Self {
        ItauApiError::App(e)
    }
}

impl From<sqlx::Error> for ItauApiError {
    fn from(e: sqlx::Error) -> Self {
        ItauApiError::App(AppError::DatabaseError(e))
    }
}

impl std::fmt::Display for ItauApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ItauApiError::App(e) => write!(f, "{e}"),
            ItauApiError::BadGateway(msg) => write!(f, "{msg}"),
            ItauApiError::Rejeitado { status, corpo } => {
                write!(f, "Itaú retornou {status}: {corpo}")
            }
        }
    }
}

impl IntoResponse for ItauApiError {
    fn into_response(self) -> Response {
        match self {
            ItauApiError::App(e) => e.into_response(),
            ItauApiError::BadGateway(msg) => (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": msg, "status": 502 })),
            )
                .into_response(),
            ItauApiError::Rejeitado { status, corpo } => (
                StatusCode::from_u16(status).unwrap_or(StatusCode::UNPROCESSABLE_ENTITY),
                Json(corpo),
            )
                .into_response(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct DadosPagador {
    pub nome: String,
    pub documento: String,
    pub logradouro: String,
    pub numero: Option<String>,
    pub complemento: Option<String>,
    pub bairro: String,
    pub cidade: String,
    pub uf: String,
    pub cep: String,
}

#[derive(Debug, Clone)]
pub struct DadosBolecodeParams {
    pub fatura_id: Uuid,
    pub id_beneficiario: String,
    pub especie_padrao: String,
    pub chave_pix: String,
    pub nosso_numero: String,
    pub valor: f64,
    pub data_vencimento: NaiveDate,
    pub multa_percentual: f64,
    pub juros_mora_mes_percentual: f64,
    pub pagador: DadosPagador,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoletoEmitido {
    pub id_boleto_individual: String,
    pub numero_linha_digitavel: String,
    pub codigo_barras: String,
    pub nosso_numero: String,
    pub gateway_pix_code: Option<String>,
    pub gateway_txid: Option<String>,
    pub simulado: bool,
}

#[derive(Debug)]
pub enum RespostaEmissao {
    Sucesso(BoletoEmitido),
    Pendente { nosso_numero: String },
    Rejeitado { status: u16, corpo: Value },
}

static TOKEN_CACHE: OnceLock<Mutex<HashMap<Uuid, (String, Instant)>>> = OnceLock::new();

fn token_cache() -> &'static Mutex<HashMap<Uuid, (String, Instant)>> {
    TOKEN_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn normalizar_texto(texto: &str, max_len: usize) -> String {
    let mut filtrado = String::with_capacity(texto.len());
    for c in texto.chars() {
        match c {
            'ü' => filtrado.push('u'),
            'Ü' => filtrado.push('U'),
            c if c.is_ascii_alphanumeric() => filtrado.push(c),
            ' ' | '-' | '.' | ',' => filtrado.push(c),
            'á' | 'à' | 'ã' | 'â' | 'é' | 'ê' | 'í' | 'ó' | 'ô' | 'õ' | 'ú' | 'ç' | 'Á' | 'À'
            | 'Ã' | 'Â' | 'É' | 'Ê' | 'Í' | 'Ó' | 'Ô' | 'Õ' | 'Ú' | 'Ç' => {
                filtrado.push(c)
            }
            _ => {}
        }
    }

    // Depois do filtro só restam ASCII e acentos com o mesmo tamanho em maiúscula e minúscula,
    // então a posição achada na versão minúscula vale para a original.
    for word in &["javascript", "http", "alert"] {
        while let Some(pos) = filtrado.to_lowercase().find(word) {
            filtrado.drain(pos..pos + word.len());
        }
    }

    let palavras: Vec<&str> = filtrado.split_whitespace().collect();
    let junta = palavras.join(" ");
    junta.chars().take(max_len).collect()
}

pub fn validar_pagador(pagador: &DadosPagador) -> Result<(), AppError> {
    let nome_limpo = normalizar_texto(&pagador.nome, 100);
    if nome_limpo.is_empty() {
        return Err(AppError::BadRequest(
            "Nome do responsável financeiro do aluno é obrigatório para emissão no Itaú."
                .to_string(),
        ));
    }

    let doc_digits: String = pagador
        .documento
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect();
    if doc_digits.len() != 11 && doc_digits.len() != 14 {
        return Err(AppError::BadRequest(
            "CPF (11 dígitos) ou CNPJ (14 dígitos) do responsável é obrigatório para emissão no Itaú."
                .to_string(),
        ));
    }

    if pagador.logradouro.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Endereço incompleto: logradouro é obrigatório para emissão no Itaú.".to_string(),
        ));
    }

    if pagador.bairro.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Endereço incompleto: bairro é obrigatório para emissão no Itaú.".to_string(),
        ));
    }

    if pagador.cidade.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Endereço incompleto: cidade é obrigatória para emissão no Itaú.".to_string(),
        ));
    }

    let uf_trimmed = pagador.uf.trim().to_uppercase();
    if uf_trimmed.len() != 2 || !uf_trimmed.chars().all(|c| c.is_ascii_alphabetic()) {
        return Err(AppError::BadRequest(
            "Endereço incompleto: UF (2 letras maiúsculas) é obrigatória para emissão no Itaú."
                .to_string(),
        ));
    }

    let cep_digits: String = pagador.cep.chars().filter(|c| c.is_ascii_digit()).collect();
    if cep_digits.len() != 8 {
        return Err(AppError::BadRequest(
            "Endereço incompleto: CEP com 8 dígitos é obrigatório para emissão no Itaú."
                .to_string(),
        ));
    }

    Ok(())
}

pub fn montar_payload_bolecode(params: &DadosBolecodeParams) -> Result<Value, AppError> {
    validar_pagador(&params.pagador)?;

    let hoje = Utc::now().date_naive();
    if params.data_vencimento < hoje {
        return Err(AppError::BadRequest(
            "Data de vencimento não pode estar no passado.".to_string(),
        ));
    }

    let doc_digits: String = params
        .pagador
        .documento
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect();
    let tipo_pessoa = if doc_digits.len() > 11 { "J" } else { "F" };

    let pessoa_json = if tipo_pessoa == "F" {
        json!({
            "nome_pessoa": normalizar_texto(&params.pagador.nome, 100),
            "tipo_pessoa": {
                "codigo_tipo_pessoa": "F",
                "numero_cadastro_pessoa_fisica": doc_digits
            }
        })
    } else {
        json!({
            "nome_pessoa": normalizar_texto(&params.pagador.nome, 100),
            "tipo_pessoa": {
                "codigo_tipo_pessoa": "J",
                "numero_cadastro_nacional_pessoa_juridica": doc_digits
            }
        })
    };

    let mut logradouro_completo = params.pagador.logradouro.trim().to_string();
    if let Some(num) = &params.pagador.numero {
        let num_trimmed = num.trim();
        if !num_trimmed.is_empty() {
            logradouro_completo.push_str(", ");
            logradouro_completo.push_str(num_trimmed);
        }
    }
    if let Some(comp) = &params.pagador.complemento {
        let comp_trimmed = comp.trim();
        if !comp_trimmed.is_empty() {
            logradouro_completo.push_str(" - ");
            logradouro_completo.push_str(comp_trimmed);
        }
    }

    let cep_digits: String = params
        .pagador
        .cep
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect();
    let endereco_json = json!({
        "nome_logradouro": normalizar_texto(&logradouro_completo, 150),
        "nome_bairro": normalizar_texto(&params.pagador.bairro, 100),
        "nome_cidade": normalizar_texto(&params.pagador.cidade, 100),
        "sigla_UF": params.pagador.uf.trim().to_uppercase(),
        "numero_CEP": cep_digits
    });

    let valor_str = format!("{:.2}", params.valor);
    let seu_numero = params.fatura_id.simple().to_string()[..10].to_uppercase();

    let multa_json = if params.multa_percentual > 0.0 {
        json!({
            "codigo_tipo_multa": "02",
            "percentual_multa": format!("{:.5}", params.multa_percentual)
        })
    } else {
        json!({
            "codigo_tipo_multa": "03"
        })
    };

    let juros_json = if params.juros_mora_mes_percentual > 0.0 {
        json!({
            "codigo_tipo_juros": "90",
            "percentual_juros": format!("{:.5}", params.juros_mora_mes_percentual)
        })
    } else {
        json!({
            "codigo_tipo_juros": "05"
        })
    };

    let payload = json!({
        "etapa_processo_boleto": "efetivacao",
        "beneficiario": {
            "id_beneficiario": params.id_beneficiario
        },
        "dado_boleto": {
            "descricao_instrumento_cobranca": "boleto_pix",
            "tipo_boleto": "a vista",
            "codigo_carteira": "109",
            "codigo_especie": params.especie_padrao,
            "codigo_tipo_vencimento": 3,
            "valor_total_titulo": valor_str,
            "pagador": {
                "pessoa": pessoa_json,
                "endereco": endereco_json
            },
            "dados_individuais_boleto": [
                {
                    "numero_nosso_numero": params.nosso_numero,
                    "data_vencimento": params.data_vencimento.format("%Y-%m-%d").to_string(),
                    "valor_titulo": valor_str,
                    "texto_seu_numero": seu_numero
                }
            ],
            "multa": multa_json,
            "juros": juros_json,
            "desconto": {
                "codigo_tipo_desconto": "00"
            },
            "recebimento_divergente": {
                "codigo_tipo_autorizacao": "03"
            }
        },
        "dados_qrcode": {
            "chave": params.chave_pix,
            "tipo_cobranca": "cob"
        }
    });

    Ok(payload)
}

pub async fn obter_token(
    config: &Config,
    conn: &mut PgConnection,
    tenant_id: Uuid,
) -> Result<String, ItauApiError> {
    {
        let cache = token_cache().lock().await;
        if let Some((tok, inst)) = cache.get(&tenant_id) {
            if inst.elapsed().as_secs() < (300 - 60) {
                return Ok(tok.clone());
            }
        }
    }

    let chave_mestra = secrets::exigir_chave(config)?;
    let client_id_bytes =
        secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::ClientId)
            .await?
            .ok_or_else(|| {
                AppError::BadRequest("Credencial client_id do Itaú não configurada".to_string())
            })?;
    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|_| AppError::BadRequest("client_id inválido".to_string()))?;

    let client_secret_bytes = secrets::ler(
        conn,
        chave_mestra,
        tenant_id,
        "itau",
        TipoSegredo::ClientSecret,
    )
    .await?
    .ok_or_else(|| {
        AppError::BadRequest("Credencial client_secret do Itaú não configurada".to_string())
    })?;
    let client_secret = String::from_utf8(client_secret_bytes)
        .map_err(|_| AppError::BadRequest("client_secret inválido".to_string()))?;

    let token = match config.itau_mode {
        ItauMode::Mock => "sim_mock_token_itau".to_string(),
        ItauMode::Sandbox => {
            let sts_base = config.itau_sts_url();
            let url = if sts_base.starts_with("http://127.0.0.1")
                || sts_base.starts_with("http://localhost")
            {
                format!("{}/api/oauth/token", sts_base.trim_end_matches('/'))
            } else {
                "https://sts.rdhi.com.br/api/oauth/token".to_string()
            };

            let client = reqwest::Client::new();
            let form = [
                ("grant_type", "client_credentials"),
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
            ];

            let resp = client.post(&url).form(&form).send().await.map_err(|e| {
                tracing::error!(error = %e, "falha de conexão ao obter token OAuth sandbox do Itaú");
                ItauApiError::BadGateway(format!("Não foi possível conectar ao STS do Itaú: {e}"))
            })?;

            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            if !status.is_success() {
                return Err(ItauApiError::BadGateway(format!(
                    "Falha ao autenticar no Itaú (status {status}): {text}"
                )));
            }

            #[derive(Deserialize)]
            struct TokenResponse {
                access_token: String,
            }
            let parsed = serde_json::from_str::<TokenResponse>(&text).map_err(|_| {
                ItauApiError::BadGateway("Resposta de token do Itaú sem access_token válido".into())
            })?;
            parsed.access_token
        }
        ItauMode::Production => {
            let cert_bytes = secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
                .await?
                .ok_or_else(|| {
                    AppError::BadRequest("Certificado do Itaú não configurado".to_string())
                })?;
            let cert_pem = String::from_utf8(cert_bytes)
                .map_err(|_| AppError::BadRequest("Certificado inválido".to_string()))?;

            let key_bytes = secrets::ler(
                conn,
                chave_mestra,
                tenant_id,
                "itau",
                TipoSegredo::CertChave,
            )
            .await?
            .ok_or_else(|| {
                AppError::BadRequest("Chave do certificado do Itaú não configurada".to_string())
            })?;
            let key_pem = String::from_utf8(key_bytes)
                .map_err(|_| AppError::BadRequest("Chave do certificado inválida".to_string()))?;

            let sts_base = config.itau_sts_url();
            crate::services::itau_sts::obter_token_oauth_producao(
                sts_base,
                &client_id,
                &client_secret,
                &cert_pem,
                &key_pem,
            )
            .await
            .map_err(|(code, msg)| {
                if code == StatusCode::BAD_GATEWAY {
                    ItauApiError::BadGateway(msg)
                } else {
                    ItauApiError::App(AppError::BadRequest(msg))
                }
            })?
        }
    };

    token_cache()
        .lock()
        .await
        .insert(tenant_id, (token.clone(), Instant::now()));
    Ok(token)
}

fn montar_cliente_http(
    config: &Config,
    cert_pem: Option<&str>,
    key_pem: Option<&str>,
) -> Result<reqwest::Client, ItauApiError> {
    let mut builder = reqwest::Client::builder();

    if config.itau_mode == ItauMode::Production {
        let cert = cert_pem.ok_or_else(|| {
            ItauApiError::App(AppError::BadRequest(
                "Certificado ausente para produção".into(),
            ))
        })?;
        let key = key_pem.ok_or_else(|| {
            ItauApiError::App(AppError::BadRequest(
                "Chave do certificado ausente para produção".into(),
            ))
        })?;
        let identity_pem = format!("{}\n{}", cert.trim(), key.trim());
        let identity = reqwest::Identity::from_pem(identity_pem.as_bytes()).map_err(|e| {
            ItauApiError::App(AppError::BadRequest(format!(
                "Identidade mTLS inválida: {e}"
            )))
        })?;
        builder = builder.identity(identity);
    }

    builder.build().map_err(|e| {
        ItauApiError::App(AppError::InternalServerError(format!(
            "Falha ao montar cliente HTTP: {e}"
        )))
    })
}

pub async fn emitir_bolecode(
    config: &Config,
    conn: &mut PgConnection,
    tenant_id: Uuid,
    params: &DadosBolecodeParams,
) -> Result<RespostaEmissao, ItauApiError> {
    if config.itau_mode == ItauMode::Mock {
        let fake_id = format!("sim_itau_{}", Uuid::new_v4().simple());
        let fake_txid = format!("BLSIM{}", &Uuid::new_v4().simple().to_string()[..25]);
        return Ok(RespostaEmissao::Sucesso(BoletoEmitido {
            id_boleto_individual: fake_id,
            numero_linha_digitavel: "34191000000000000000000000000000000000000000000".to_string(),
            codigo_barras: "34190000000000000000000000000000000000000000".to_string(),
            nosso_numero: params.nosso_numero.clone(),
            gateway_pix_code: Some("00020101021226580014br.gov.bcb.pix0136simulado520400005303986540510.005802BR5906ESCOLA6009SAOPAULO62070503***63041D3A".to_string()),
            gateway_txid: Some(fake_txid),
            simulado: true,
        }));
    }

    let token = obter_token(config, conn, tenant_id).await?;
    let payload = montar_payload_bolecode(params)?;

    let (cert_pem, key_pem) = if config.itau_mode == ItauMode::Production {
        let chave_mestra = secrets::exigir_chave(config)?;
        let c_bytes = secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("Certificado não encontrado".into()))
            })?;
        let k_bytes = secrets::ler(
            conn,
            chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
        )
        .await?
        .ok_or_else(|| {
            ItauApiError::App(AppError::BadRequest(
                "Chave do certificado não encontrada".into(),
            ))
        })?;
        (
            Some(String::from_utf8_lossy(&c_bytes).to_string()),
            Some(String::from_utf8_lossy(&k_bytes).to_string()),
        )
    } else {
        (None, None)
    };

    let client = montar_cliente_http(config, cert_pem.as_deref(), key_pem.as_deref())?;
    let url = format!(
        "{}/boletos-pix",
        config.itau_recebimentos_url().trim_end_matches('/')
    );
    let correlation_id = Uuid::new_v4().to_string();

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-itau-correlationID", &correlation_id)
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "falha ao conectar na API de boletos-pix do Itaú");
            ItauApiError::BadGateway(format!("Não foi possível conectar ao Itaú: {e}"))
        })?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status == StatusCode::ACCEPTED {
        return Ok(RespostaEmissao::Pendente {
            nosso_numero: params.nosso_numero.clone(),
        });
    }

    if status == StatusCode::UNPROCESSABLE_ENTITY
        || status == StatusCode::BAD_REQUEST
        || status == StatusCode::CONFLICT
    {
        let parsed: Value =
            serde_json::from_str(&text).unwrap_or_else(|_| json!({ "mensagem": text }));
        return Ok(RespostaEmissao::Rejeitado {
            status: status.as_u16(),
            corpo: parsed,
        });
    }

    if !status.is_success() {
        return Err(ItauApiError::BadGateway(format!(
            "Itaú retornou erro na emissão (status {status}): {text}"
        )));
    }

    let parsed: Value = serde_json::from_str(&text).map_err(|_| {
        ItauApiError::BadGateway("Resposta de emissão do Itaú com formato JSON inválido".into())
    })?;

    let individual = parsed
        .pointer("/dado_boleto/dados_individuais_boleto/0")
        .ok_or_else(|| {
            ItauApiError::BadGateway("Resposta do Itaú sem dados_individuais_boleto[0]".into())
        })?;

    let id_boleto_individual = individual
        .get("id_boleto_individual")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let numero_linha_digitavel = individual
        .get("numero_linha_digitavel")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let codigo_barras = individual
        .get("codigo_barras")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let nosso_numero_resp = individual
        .get("numero_nosso_numero")
        .and_then(|v| v.as_str())
        .unwrap_or(&params.nosso_numero)
        .to_string();

    let emv = parsed
        .pointer("/dados_qrcode/emv")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let txid = parsed
        .pointer("/dados_qrcode/txid")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(RespostaEmissao::Sucesso(BoletoEmitido {
        id_boleto_individual,
        numero_linha_digitavel,
        codigo_barras,
        nosso_numero: nosso_numero_resp,
        gateway_pix_code: emv,
        gateway_txid: txid,
        simulado: false,
    }))
}

pub async fn consultar_boleto(
    config: &Config,
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id_beneficiario: &str,
    nosso_numero: &str,
) -> Result<Option<BoletoEmitido>, ItauApiError> {
    if config.itau_mode == ItauMode::Mock {
        return Ok(Some(BoletoEmitido {
            id_boleto_individual: format!("sim_itau_{}", Uuid::new_v4().simple()),
            numero_linha_digitavel: "34191000000000000000000000000000000000000000000".to_string(),
            codigo_barras: "34190000000000000000000000000000000000000000".to_string(),
            nosso_numero: nosso_numero.to_string(),
            gateway_pix_code: Some("00020101021226580014br.gov.bcb.pix0136simulado520400005303986540510.005802BR5906ESCOLA6009SAOPAULO62070503***63041D3A".to_string()),
            gateway_txid: Some(format!("BLSIM{}", &Uuid::new_v4().simple().to_string()[..25])),
            simulado: true,
        }));
    }

    let token = obter_token(config, conn, tenant_id).await?;

    let chave_mestra = secrets::exigir_chave(config)?;
    let client_id_bytes =
        secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::ClientId)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("client_id não configurado".into()))
            })?;
    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|_| ItauApiError::App(AppError::BadRequest("client_id inválido".into())))?;

    let (cert_pem, key_pem) = if config.itau_mode == ItauMode::Production {
        let c_bytes = secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("Certificado não encontrado".into()))
            })?;
        let k_bytes = secrets::ler(
            conn,
            chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
        )
        .await?
        .ok_or_else(|| {
            ItauApiError::App(AppError::BadRequest(
                "Chave do certificado não encontrada".into(),
            ))
        })?;
        (
            Some(String::from_utf8_lossy(&c_bytes).to_string()),
            Some(String::from_utf8_lossy(&k_bytes).to_string()),
        )
    } else {
        (None, None)
    };

    let client = montar_cliente_http(config, cert_pem.as_deref(), key_pem.as_deref())?;
    let url = format!(
        "{}/boletos?id_beneficiario={}&codigo_carteira=109&nosso_numero={}&view=specific",
        config.itau_cash_management_url().trim_end_matches('/'),
        id_beneficiario,
        nosso_numero
    );
    let correlation_id = Uuid::new_v4().to_string();

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-itau-apikey", &client_id)
        .header("x-itau-correlationID", &correlation_id)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "falha de conexão ao consultar boleto no Itaú");
            ItauApiError::BadGateway(format!("Não foi possível consultar boleto no Itaú: {e}"))
        })?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status == StatusCode::NOT_FOUND || status == StatusCode::NO_CONTENT {
        return Ok(None);
    }

    if !status.is_success() {
        return Err(ItauApiError::BadGateway(format!(
            "Itaú retornou erro na consulta (status {status}): {text}"
        )));
    }

    let parsed: Value = serde_json::from_str(&text).map_err(|_| {
        ItauApiError::BadGateway("Resposta de consulta com formato inválido".into())
    })?;

    let item = if let Some(arr) = parsed.as_array() {
        arr.first().cloned()
    } else if let Some(arr) = parsed.get("data").and_then(|d| d.as_array()) {
        arr.first().cloned()
    } else {
        Some(parsed.clone())
    };

    let Some(item) = item else {
        return Ok(None);
    };

    let id_boleto = item
        .get("id_boleto")
        .and_then(|v| v.as_str())
        .or_else(|| {
            item.pointer("/dado_boleto/dados_individuais_boleto/0/id_boleto_individual")
                .and_then(|v| v.as_str())
        })
        .unwrap_or_default()
        .to_string();

    let individual = item
        .pointer("/dado_boleto/dados_individuais_boleto/0")
        .or_else(|| item.pointer("/dados_individuais_boleto/0"));

    let (linha_digitavel, codigo_barras) = if let Some(ind) = individual {
        (
            ind.get("numero_linha_digitavel")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            ind.get("codigo_barras")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
        )
    } else {
        (
            item.get("numero_linha_digitavel")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            item.get("codigo_barras")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
        )
    };

    if linha_digitavel.is_empty() || codigo_barras.is_empty() {
        return Ok(None);
    }

    let emv = item
        .pointer("/dados_qrcode/emv")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let txid = item
        .pointer("/dados_qrcode/txid")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(Some(BoletoEmitido {
        id_boleto_individual: id_boleto,
        numero_linha_digitavel: linha_digitavel,
        codigo_barras,
        nosso_numero: nosso_numero.to_string(),
        gateway_pix_code: emv,
        gateway_txid: txid,
        simulado: false,
    }))
}

pub async fn baixar_boleto(
    config: &Config,
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id_boleto: &str,
) -> Result<(), ItauApiError> {
    if config.itau_mode == ItauMode::Mock {
        return Ok(());
    }

    let token = obter_token(config, conn, tenant_id).await?;

    let chave_mestra = secrets::exigir_chave(config)?;
    let client_id_bytes =
        secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::ClientId)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("client_id não configurado".into()))
            })?;
    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|_| ItauApiError::App(AppError::BadRequest("client_id inválido".into())))?;

    let (cert_pem, key_pem) = if config.itau_mode == ItauMode::Production {
        let c_bytes = secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("Certificado não encontrado".into()))
            })?;
        let k_bytes = secrets::ler(
            conn,
            chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
        )
        .await?
        .ok_or_else(|| {
            ItauApiError::App(AppError::BadRequest(
                "Chave do certificado não encontrada".into(),
            ))
        })?;
        (
            Some(String::from_utf8_lossy(&c_bytes).to_string()),
            Some(String::from_utf8_lossy(&k_bytes).to_string()),
        )
    } else {
        (None, None)
    };

    let client = montar_cliente_http(config, cert_pem.as_deref(), key_pem.as_deref())?;
    let url = format!(
        "{}/boletos/{}/baixa",
        config.itau_cash_management_url().trim_end_matches('/'),
        id_boleto
    );
    let correlation_id = Uuid::new_v4().to_string();

    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-itau-apikey", &client_id)
        .header("x-itau-correlationID", &correlation_id)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "falha de conexão ao baixar boleto no Itaú");
            ItauApiError::BadGateway(format!("Não foi possível conectar ao Itaú para baixa: {e}"))
        })?;

    let status = resp.status();
    if status.is_success() || status == StatusCode::ACCEPTED || status == StatusCode::NO_CONTENT {
        Ok(())
    } else {
        let text = resp.text().await.unwrap_or_default();
        tracing::error!(status = %status, "Itaú recusou pedido de baixa");
        Err(ItauApiError::BadGateway(format!(
            "Itaú recusou baixa (status {status}): {text}"
        )))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SituacaoBoleto {
    pub situacao: String,
    pub esta_pago: bool,
    pub valor_pago: Option<f64>,
}

pub async fn consultar_situacao_boleto(
    config: &Config,
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id_beneficiario: &str,
    nosso_numero: &str,
) -> Result<Option<SituacaoBoleto>, ItauApiError> {
    if config.itau_mode == ItauMode::Mock {
        return Ok(Some(SituacaoBoleto {
            situacao: "Pago".to_string(),
            esta_pago: true,
            valor_pago: None,
        }));
    }

    let token = obter_token(config, conn, tenant_id).await?;

    let chave_mestra = secrets::exigir_chave(config)?;
    let client_id_bytes =
        secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::ClientId)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("client_id não configurado".into()))
            })?;
    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|_| ItauApiError::App(AppError::BadRequest("client_id inválido".into())))?;

    let (cert_pem, key_pem) = if config.itau_mode == ItauMode::Production {
        let c_bytes = secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("Certificado não encontrado".into()))
            })?;
        let k_bytes = secrets::ler(
            conn,
            chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
        )
        .await?
        .ok_or_else(|| {
            ItauApiError::App(AppError::BadRequest(
                "Chave do certificado não encontrada".into(),
            ))
        })?;
        (
            Some(String::from_utf8_lossy(&c_bytes).to_string()),
            Some(String::from_utf8_lossy(&k_bytes).to_string()),
        )
    } else {
        (None, None)
    };

    let client = montar_cliente_http(config, cert_pem.as_deref(), key_pem.as_deref())?;
    let url = format!(
        "{}/boletos?id_beneficiario={}&codigo_carteira=109&nosso_numero={}&view=specific",
        config.itau_cash_management_url().trim_end_matches('/'),
        id_beneficiario,
        nosso_numero
    );
    let correlation_id = Uuid::new_v4().to_string();

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-itau-apikey", &client_id)
        .header("x-itau-correlationID", &correlation_id)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "falha de conexão ao consultar boleto no Itaú");
            ItauApiError::BadGateway(format!("Não foi possível consultar boleto no Itaú: {e}"))
        })?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status == StatusCode::NOT_FOUND || status == StatusCode::NO_CONTENT {
        return Ok(None);
    }

    if !status.is_success() {
        return Err(ItauApiError::BadGateway(format!(
            "Itaú retornou erro na consulta (status {status}): {text}"
        )));
    }

    let parsed: Value = serde_json::from_str(&text).map_err(|_| {
        ItauApiError::BadGateway("Resposta de consulta com formato inválido".into())
    })?;

    let item = if let Some(arr) = parsed.as_array() {
        arr.first().cloned()
    } else if let Some(arr) = parsed.get("data").and_then(|d| d.as_array()) {
        arr.first().cloned()
    } else {
        Some(parsed.clone())
    };

    let Some(item) = item else {
        return Ok(None);
    };

    let situacao = item
        .pointer("/dado_boleto/dados_individuais_boleto/0/situacao_geral_boleto")
        .and_then(|v| v.as_str())
        .or_else(|| {
            item.pointer("/dados_individuais_boleto/0/situacao_geral_boleto")
                .and_then(|v| v.as_str())
        })
        .or_else(|| item.get("situacao_geral_boleto").and_then(|v| v.as_str()))
        .or_else(|| item.get("status").and_then(|v| v.as_str()))
        .or_else(|| item.get("situacao").and_then(|v| v.as_str()))
        .unwrap_or("Em Aberto")
        .to_string();

    let s_lower = situacao.to_lowercase();
    let esta_pago = s_lower == "pago"
        || s_lower == "liquidado"
        || s_lower == "liquidada"
        || s_lower.contains("pago")
        || s_lower.contains("liquidad");

    let valor_pago = item
        .pointer("/dado_boleto/dados_individuais_boleto/0/pagamentos/0/valor_pago_total_cobranca")
        .or_else(|| {
            item.pointer("/dados_individuais_boleto/0/pagamentos/0/valor_pago_total_cobranca")
        })
        .or_else(|| item.pointer("/dados_individuais_boleto/0/valor_pago_total_cobranca"))
        .or_else(|| item.pointer("/pagamentos/0/valor_pago_total_cobranca"))
        .or_else(|| item.get("valor_pago_total_cobranca"))
        .or_else(|| item.get("valor_pago"))
        .or_else(|| item.get("valorPagoTotalCobranca"))
        .and_then(|v| {
            if let Some(s) = v.as_str() {
                s.trim().parse::<f64>().ok()
            } else {
                v.as_f64()
            }
        });

    Ok(Some(SituacaoBoleto {
        situacao,
        esta_pago,
        valor_pago,
    }))
}

#[allow(clippy::too_many_arguments)]
pub async fn cadastrar_webhook_boletos(
    config: &Config,
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id_beneficiario: &str,
    webhook_url: &str,
    webhook_oauth_url: &str,
    webhook_client_id: &str,
    webhook_client_secret: &str,
) -> Result<(), ItauApiError> {
    if config.itau_mode == ItauMode::Mock {
        return Err(ItauApiError::App(AppError::BadRequest(
            "Modo simulado ativo: cadastro de webhook no Itaú não disponível.".into(),
        )));
    }

    let token = obter_token(config, conn, tenant_id).await?;

    let chave_mestra = secrets::exigir_chave(config)?;
    let client_id_bytes =
        secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::ClientId)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("client_id não configurado".into()))
            })?;
    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|_| ItauApiError::App(AppError::BadRequest("client_id inválido".into())))?;

    let (cert_pem, key_pem) = if config.itau_mode == ItauMode::Production {
        let c_bytes = secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("Certificado não encontrado".into()))
            })?;
        let k_bytes = secrets::ler(
            conn,
            chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
        )
        .await?
        .ok_or_else(|| {
            ItauApiError::App(AppError::BadRequest(
                "Chave do certificado não encontrada".into(),
            ))
        })?;
        (
            Some(String::from_utf8_lossy(&c_bytes).to_string()),
            Some(String::from_utf8_lossy(&k_bytes).to_string()),
        )
    } else {
        (None, None)
    };

    let client = montar_cliente_http(config, cert_pem.as_deref(), key_pem.as_deref())?;
    let url = format!(
        "{}/notificacoes_boletos",
        config.itau_boletos_v3_url().trim_end_matches('/')
    );
    let correlation_id = Uuid::new_v4().to_string();

    let payload = json!({
        "data": {
            "id_beneficiario": id_beneficiario,
            "webhook_url": webhook_url,
            "webhook_client_id": webhook_client_id,
            "webhook_client_secret": webhook_client_secret,
            "webhook_oauth_url": webhook_oauth_url,
            "valor_minimo": "0.00",
            "tipos_notificacoes": ["BAIXA_OPERACIONAL", "BAIXA_EFETIVA"]
        }
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-itau-apikey", &client_id)
        .header("x-itau-correlationID", &correlation_id)
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "falha de conexão ao cadastrar webhook de boletos no Itaú");
            ItauApiError::BadGateway(format!(
                "Não foi possível conectar ao Itaú para cadastrar webhook: {e}"
            ))
        })?;

    let status = resp.status();
    if status.is_success() || status == StatusCode::ACCEPTED || status == StatusCode::NO_CONTENT {
        Ok(())
    } else {
        let text = resp.text().await.unwrap_or_default();
        tracing::error!(status = %status, "Itaú recusou cadastro de webhook");
        Err(ItauApiError::BadGateway(format!(
            "Itaú recusou cadastro de webhook (status {status}): {text}"
        )))
    }
}

pub fn itau_regulatorio_pix_url(config: &Config) -> String {
    if let Ok(base) = std::env::var("ITAU_API_BASE_URL") {
        if !base.trim().is_empty() {
            return base.trim_end_matches('/').to_string();
        }
    }
    match config.itau_mode {
        ItauMode::Mock | ItauMode::Production => {
            "https://pix-pj.api.itau.com/regulatorio-pix/v2".to_string()
        }
        ItauMode::Sandbox => {
            "https://sandbox.devportal.itau.com.br/itau-ep9-api-regulatorio-pix-v2-externo/v2"
                .to_string()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetalhePix {
    pub end_to_end_id: String,
    pub txid: Option<String>,
    pub valor: f64,
    pub horario: Option<String>,
    pub chave: Option<String>,
}

pub async fn consultar_pix(
    config: &Config,
    conn: &mut PgConnection,
    tenant_id: Uuid,
    e2eid: &str,
) -> Result<Option<DetalhePix>, ItauApiError> {
    if config.itau_mode == ItauMode::Mock && std::env::var("ITAU_API_BASE_URL").is_err() {
        return Ok(None);
    }

    let token = obter_token(config, conn, tenant_id).await?;

    let chave_mestra = secrets::exigir_chave(config)?;
    let client_id_bytes =
        secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::ClientId)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("client_id não configurado".into()))
            })?;
    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|_| ItauApiError::App(AppError::BadRequest("client_id inválido".into())))?;

    let (cert_pem, key_pem) = if config.itau_mode == ItauMode::Production {
        let c_bytes = secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("Certificado não encontrado".into()))
            })?;
        let k_bytes = secrets::ler(
            conn,
            chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
        )
        .await?
        .ok_or_else(|| {
            ItauApiError::App(AppError::BadRequest(
                "Chave do certificado não encontrada".into(),
            ))
        })?;
        (
            Some(String::from_utf8_lossy(&c_bytes).to_string()),
            Some(String::from_utf8_lossy(&k_bytes).to_string()),
        )
    } else {
        (None, None)
    };

    let client = montar_cliente_http(config, cert_pem.as_deref(), key_pem.as_deref())?;
    let url = format!("{}/pix/{}", itau_regulatorio_pix_url(config), e2eid);
    let correlation_id = Uuid::new_v4().to_string();

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-itau-apikey", &client_id)
        .header("x-itau-correlationID", &correlation_id)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "falha de conexão ao consultar pix no Itaú");
            ItauApiError::BadGateway(format!("Não foi possível consultar pix no Itaú: {e}"))
        })?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status == StatusCode::NOT_FOUND || status == StatusCode::NO_CONTENT {
        return Ok(None);
    }

    if !status.is_success() {
        return Err(ItauApiError::BadGateway(format!(
            "Itaú retornou erro na consulta pix (status {status}): {text}"
        )));
    }

    let parsed: Value = serde_json::from_str(&text).map_err(|_| {
        ItauApiError::BadGateway("Resposta de consulta pix com formato inválido".into())
    })?;

    let item = if let Some(arr) = parsed.get("pix").and_then(|p| p.as_array()) {
        arr.first().cloned()
    } else if let Some(arr) = parsed.as_array() {
        arr.first().cloned()
    } else if let Some(arr) = parsed.get("data").and_then(|d| d.as_array()) {
        arr.first().cloned()
    } else if let Some(obj) = parsed.get("data").and_then(|d| d.as_object()) {
        Some(Value::Object(obj.clone()))
    } else {
        Some(parsed.clone())
    };

    let Some(item) = item else {
        return Ok(None);
    };

    let end_to_end_id = item
        .get("endToEndId")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let txid = item
        .get("txid")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string());

    let valor = item
        .get("valor")
        .and_then(|v| {
            if let Some(s) = v.as_str() {
                s.trim().parse::<f64>().ok()
            } else {
                v.as_f64()
            }
        })
        .unwrap_or(0.0);

    let horario = item
        .get("horario")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let chave = item
        .get("chave")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(Some(DetalhePix {
        end_to_end_id,
        txid,
        valor,
        horario,
        chave,
    }))
}

pub async fn cadastrar_webhook_pix(
    config: &Config,
    conn: &mut PgConnection,
    tenant_id: Uuid,
    chave_pix: &str,
    webhook_url: &str,
) -> Result<(), ItauApiError> {
    if config.itau_mode == ItauMode::Mock {
        return Err(ItauApiError::App(AppError::BadRequest(
            "Modo simulado ativo: cadastro de webhook no Itaú não disponível.".into(),
        )));
    }

    let token = obter_token(config, conn, tenant_id).await?;

    let chave_mestra = secrets::exigir_chave(config)?;
    let client_id_bytes =
        secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::ClientId)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("client_id não configurado".into()))
            })?;
    let client_id = String::from_utf8(client_id_bytes)
        .map_err(|_| ItauApiError::App(AppError::BadRequest("client_id inválido".into())))?;

    let (cert_pem, key_pem) = if config.itau_mode == ItauMode::Production {
        let c_bytes = secrets::ler(conn, chave_mestra, tenant_id, "itau", TipoSegredo::Cert)
            .await?
            .ok_or_else(|| {
                ItauApiError::App(AppError::BadRequest("Certificado não encontrado".into()))
            })?;
        let k_bytes = secrets::ler(
            conn,
            chave_mestra,
            tenant_id,
            "itau",
            TipoSegredo::CertChave,
        )
        .await?
        .ok_or_else(|| {
            ItauApiError::App(AppError::BadRequest(
                "Chave do certificado não encontrada".into(),
            ))
        })?;
        (
            Some(String::from_utf8_lossy(&c_bytes).to_string()),
            Some(String::from_utf8_lossy(&k_bytes).to_string()),
        )
    } else {
        (None, None)
    };

    let client = montar_cliente_http(config, cert_pem.as_deref(), key_pem.as_deref())?;
    let url = format!("{}/webhook/{}", itau_regulatorio_pix_url(config), chave_pix);
    let correlation_id = Uuid::new_v4().to_string();

    let payload = json!({
        "webhookUrl": webhook_url
    });

    let resp = client
        .put(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("x-itau-apikey", &client_id)
        .header("x-itau-correlationID", &correlation_id)
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "falha de conexão ao cadastrar webhook Pix no Itaú");
            ItauApiError::BadGateway(format!(
                "Não foi possível conectar ao Itaú para cadastrar webhook Pix: {e}"
            ))
        })?;

    let status = resp.status();
    if status.is_success() || status == StatusCode::ACCEPTED || status == StatusCode::NO_CONTENT {
        Ok(())
    } else {
        let text = resp.text().await.unwrap_or_default();
        tracing::error!(status = %status, "Itaú recusou cadastro de webhook Pix");
        Err(ItauApiError::BadGateway(format!(
            "Itaú recusou cadastro de webhook Pix (status {status}): {text}"
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalizar_texto_remove_palavras_proibidas() {
        let entrada = "Colégio http://site.com alert javascript alert";
        let res = normalizar_texto(entrada, 100);
        assert_eq!(res, "Colégio site.com");
    }

    #[test]
    fn test_normalizar_texto_unicode_que_muda_de_tamanho_nao_quebra() {
        // 'İ' e 'ẞ' mudam de tamanho em bytes ao passar para minúscula.
        let res = normalizar_texto("İstanbul ẞtraße HTTP Ana", 100);
        assert_eq!(res, "stanbul trae Ana");
    }

    #[test]
    fn test_normalizar_texto_remove_caracteres_especiais_e_trata_acentos() {
        let entrada = "[Escola] & Colégio: <São José> / (123) * # | ü Müller";
        let res = normalizar_texto(entrada, 100);
        assert_eq!(res, "Escola Colégio São José 123 u Muller");
    }

    #[test]
    fn test_normalizar_texto_respeita_tamanho_maximo() {
        let entrada = "12345678901234567890";
        let res = normalizar_texto(entrada, 10);
        assert_eq!(res, "1234567890");
    }

    #[test]
    fn test_montar_payload_bolecode_multa_juros_carteira_especie() {
        let params = DadosBolecodeParams {
            fatura_id: Uuid::nil(),
            id_beneficiario: "150000052061".to_string(),
            especie_padrao: "04".to_string(),
            chave_pix: "12345678000190".to_string(),
            nosso_numero: "00000001".to_string(),
            valor: 550.00,
            data_vencimento: Utc::now().date_naive() + chrono::Duration::days(10),
            multa_percentual: 2.0,
            juros_mora_mes_percentual: 1.0,
            pagador: DadosPagador {
                nome: "Responsável Teste".to_string(),
                documento: "12345678901".to_string(),
                logradouro: "Rua das Flores".to_string(),
                numero: Some("100".to_string()),
                complemento: Some("Apto 10".to_string()),
                bairro: "Centro".to_string(),
                cidade: "São Paulo".to_string(),
                uf: "SP".to_string(),
                cep: "01310-100".to_string(),
            },
        };

        let payload = montar_payload_bolecode(&params).unwrap();
        assert_eq!(payload["etapa_processo_boleto"], "efetivacao");
        assert_eq!(payload["beneficiario"]["id_beneficiario"], "150000052061");
        assert_eq!(payload["dado_boleto"]["codigo_carteira"], "109");
        assert_eq!(payload["dado_boleto"]["codigo_especie"], "04");
        assert_eq!(payload["dado_boleto"]["valor_total_titulo"], "550.00");
        assert_eq!(
            payload["dado_boleto"]["dados_individuais_boleto"][0]["numero_nosso_numero"],
            "00000001"
        );
        assert_eq!(
            payload["dado_boleto"]["dados_individuais_boleto"][0]["texto_seu_numero"],
            "0000000000"
        );
        assert_eq!(payload["dado_boleto"]["multa"]["codigo_tipo_multa"], "02");
        assert_eq!(
            payload["dado_boleto"]["multa"]["percentual_multa"],
            "2.00000"
        );
        assert_eq!(payload["dado_boleto"]["juros"]["codigo_tipo_juros"], "90");
        assert_eq!(
            payload["dado_boleto"]["juros"]["percentual_juros"],
            "1.00000"
        );
        assert_eq!(payload["dados_qrcode"]["chave"], "12345678000190");
        assert_eq!(payload["dados_qrcode"]["tipo_cobranca"], "cob");
    }

    #[test]
    fn test_montar_payload_bolecode_isento_multa_juros() {
        let params = DadosBolecodeParams {
            fatura_id: Uuid::nil(),
            id_beneficiario: "150000052061".to_string(),
            especie_padrao: "04".to_string(),
            chave_pix: "12345678000190".to_string(),
            nosso_numero: "00000001".to_string(),
            valor: 550.00,
            data_vencimento: Utc::now().date_naive() + chrono::Duration::days(10),
            multa_percentual: 0.0,
            juros_mora_mes_percentual: 0.0,
            pagador: DadosPagador {
                nome: "Responsável Teste".to_string(),
                documento: "12345678901".to_string(),
                logradouro: "Rua das Flores".to_string(),
                numero: None,
                complemento: None,
                bairro: "Centro".to_string(),
                cidade: "São Paulo".to_string(),
                uf: "SP".to_string(),
                cep: "01310100".to_string(),
            },
        };

        let payload = montar_payload_bolecode(&params).unwrap();
        assert_eq!(payload["dado_boleto"]["multa"]["codigo_tipo_multa"], "03");
        assert!(payload["dado_boleto"]["multa"]
            .get("percentual_multa")
            .is_none());
        assert_eq!(payload["dado_boleto"]["juros"]["codigo_tipo_juros"], "05");
        assert!(payload["dado_boleto"]["juros"]
            .get("percentual_juros")
            .is_none());
    }

    #[test]
    fn test_validar_pagador_endereco_incompleto() {
        let pagador = DadosPagador {
            nome: "Responsável".to_string(),
            documento: "12345678901".to_string(),
            logradouro: "".to_string(),
            numero: None,
            complemento: None,
            bairro: "Centro".to_string(),
            cidade: "São Paulo".to_string(),
            uf: "SP".to_string(),
            cep: "01310100".to_string(),
        };
        let err = validar_pagador(&pagador).unwrap_err();
        assert!(format!("{err}").contains("logradouro é obrigatório"));

        let pagador_uf = DadosPagador {
            logradouro: "Rua".to_string(),
            uf: "XYZ".to_string(),
            ..pagador.clone()
        };
        let err_uf = validar_pagador(&pagador_uf).unwrap_err();
        assert!(format!("{err_uf}").contains("UF"));

        let pagador_cep = DadosPagador {
            logradouro: "Rua".to_string(),
            uf: "SP".to_string(),
            cep: "123".to_string(),
            ..pagador.clone()
        };
        let err_cep = validar_pagador(&pagador_cep).unwrap_err();
        assert!(format!("{err_cep}").contains("CEP com 8 dígitos"));
    }
}
