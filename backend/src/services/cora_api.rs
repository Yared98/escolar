use crate::config::{Config, CoraMode};
use crate::error::AppError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

type TokenCache = Arc<Mutex<Option<(String, DateTime<Utc>)>>>;

#[derive(Clone, Debug)]
pub struct CoraGatewayConfig {
    pub mode: CoraMode,
    pub client_id: String,
    pub base_url: String,
    pub cert_pem: Option<String>,
    pub key_pem: Option<String>,
}

impl CoraGatewayConfig {
    pub fn try_from_config(config: &Config) -> Result<Self, AppError> {
        let mode = config.cora_mode;
        let base_url = config
            .cora_base_url
            .clone()
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.trim_end_matches('/').to_string())
            .unwrap_or_else(|| match mode {
                CoraMode::Sandbox => "https://matls-clients.api.stage.cora.com.br".to_string(),
                CoraMode::Production => "https://matls-clients.api.cora.com.br".to_string(),
                CoraMode::Mock => "http://localhost".to_string(),
            });

        let is_http_test = base_url.starts_with("http://");

        let client_id = config
            .cora_client_id
            .clone()
            .unwrap_or_default()
            .trim()
            .to_string();

        let cert_pem = config
            .cora_cert_file
            .as_ref()
            .and_then(|path| std::fs::read_to_string(path).ok())
            .filter(|s| !s.trim().is_empty());

        let key_pem = config
            .cora_key_file
            .as_ref()
            .and_then(|path| std::fs::read_to_string(path).ok())
            .filter(|s| !s.trim().is_empty());

        if !is_http_test && mode != CoraMode::Mock {
            if client_id.is_empty() {
                return Err(AppError::ServiceUnavailable(
                    "Cora não configurada: faltam client_id, certificado ou chave privada."
                        .to_string(),
                ));
            }
            if cert_pem.is_none() {
                return Err(AppError::ServiceUnavailable(
                    "Cora não configurada: faltam certificado (CORA_CERT_FILE).".to_string(),
                ));
            }
            if key_pem.is_none() {
                return Err(AppError::ServiceUnavailable(
                    "Cora não configurada: faltam chave privada (CORA_KEY_FILE).".to_string(),
                ));
            }
        }

        Ok(CoraGatewayConfig {
            mode,
            client_id,
            base_url,
            cert_pem,
            key_pem,
        })
    }
}

#[derive(Deserialize)]
pub struct CoraAuthResponse {
    pub access_token: String,
    #[allow(dead_code)]
    pub token_type: Option<String>,
    pub expires_in: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraDocument {
    pub identity: String,
    #[serde(rename = "type")]
    pub document_type: String,
}

/// Endereço do pagador (opcional na Cora; quando enviado, todos os campos são exigidos).
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct CoraAddress {
    pub street: String,
    pub number: String,
    pub district: String,
    pub city: String,
    pub state: String,
    pub complement: String,
    pub zip_code: String,
}

impl CoraAddress {
    /// Monta o endereço só quando o cadastro tem todos os campos exigidos; CEP só com dígitos
    /// (8) e UF com 2 letras. Complemento vazio vira "N/A", como nos exemplos da Cora.
    #[allow(clippy::too_many_arguments)]
    pub fn do_cadastro(
        logradouro: Option<&str>,
        numero: Option<&str>,
        bairro: Option<&str>,
        cidade: Option<&str>,
        estado: Option<&str>,
        complemento: Option<&str>,
        cep: Option<&str>,
    ) -> Option<Self> {
        let limpo = |v: Option<&str>| v.map(str::trim).filter(|s| !s.is_empty()).map(String::from);
        let cep: String = cep?.chars().filter(|c| c.is_ascii_digit()).collect();
        let estado = limpo(estado)?.to_uppercase();
        if cep.len() != 8 || estado.len() != 2 {
            return None;
        }
        Some(Self {
            street: limpo(logradouro)?,
            number: limpo(numero)?,
            district: limpo(bairro)?,
            city: limpo(cidade)?,
            state: estado,
            complement: limpo(complemento).unwrap_or_else(|| "N/A".to_string()),
            zip_code: cep,
        })
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraCustomer {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    pub document: CoraDocument,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<CoraAddress>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraService {
    pub name: String,
    pub description: String,
    pub amount: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraFine {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate: Option<f64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraInterest {
    pub rate: f64,
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraPaymentTerms {
    pub due_date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fine: Option<CoraFine>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interest: Option<CoraInterest>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraCreateInvoiceRequest {
    pub code: String,
    pub customer: CoraCustomer,
    pub services: Vec<CoraService>,
    pub payment_terms: CoraPaymentTerms,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_forms: Option<Vec<String>>,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct CoraBankSlip {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub digitable: Option<String>,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct CoraPixResponse {
    #[serde(default)]
    pub emv: Option<String>,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct CoraPaymentOptions {
    #[serde(default)]
    pub bank_slip: Option<CoraBankSlip>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct CoraInvoiceResponse {
    pub id: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub payment_options: Option<CoraPaymentOptions>,
    #[serde(default)]
    pub pix: Option<CoraPixResponse>,
    /// Valor pago em centavos, quando a Cora informa na consulta.
    #[serde(default)]
    pub total_paid: Option<i64>,
}

impl CoraInvoiceResponse {
    /// Situação confirmada de pagamento na consulta da cobrança.
    pub fn esta_paga(&self) -> bool {
        self.status
            .as_deref()
            .map(|s| s.eq_ignore_ascii_case("PAID"))
            .unwrap_or(false)
    }

    pub fn boleto_url(&self) -> Option<String> {
        self.payment_options
            .as_ref()
            .and_then(|po| po.bank_slip.as_ref())
            .and_then(|bs| bs.url.clone())
    }

    pub fn digitable_line(&self) -> Option<String> {
        self.payment_options
            .as_ref()
            .and_then(|po| po.bank_slip.as_ref())
            .and_then(|bs| bs.digitable.clone())
    }

    pub fn pix_emv(&self) -> Option<String> {
        self.pix.as_ref().and_then(|p| p.emv.clone())
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraSimulatePaymentRequest {
    pub id: String,
}

#[axum::async_trait]
pub trait BankGateway: Send + Sync {
    fn mode(&self) -> CoraMode;

    async fn get_token(&self) -> Result<String, AppError>;

    async fn create_invoice(
        &self,
        idempotency_key: &str,
        invoice: CoraCreateInvoiceRequest,
    ) -> Result<CoraInvoiceResponse, AppError>;

    async fn get_invoice(&self, id: &str) -> Result<CoraInvoiceResponse, AppError>;

    async fn simulate_payment(&self, id: &str) -> Result<(), AppError>;
}

#[derive(Default)]
pub struct CoraMock;

impl CoraMock {
    pub fn new() -> Self {
        Self
    }
}

#[axum::async_trait]
impl BankGateway for CoraMock {
    fn mode(&self) -> CoraMode {
        CoraMode::Mock
    }

    async fn get_token(&self) -> Result<String, AppError> {
        Ok("mocked_bearer_token_for_cora".to_string())
    }

    async fn create_invoice(
        &self,
        _idempotency_key: &str,
        invoice: CoraCreateInvoiceRequest,
    ) -> Result<CoraInvoiceResponse, AppError> {
        Ok(CoraInvoiceResponse {
            id: format!("cora_{}", Uuid::new_v4().simple()),
            status: Some("OPEN".to_string()),
            payment_options: Some(CoraPaymentOptions {
                bank_slip: Some(CoraBankSlip {
                    url: Some(format!(
                        "https://boletos.cora.com.br/{}?code={}",
                        Uuid::new_v4().simple(),
                        invoice.code
                    )),
                    digitable: Some("00190000090321583700012584580174791420000002000".to_string()),
                }),
            }),
            pix: Some(CoraPixResponse {
                emv: Some(format!(
                    "00020101021226830014br.gov.bcb.pix2561qrcode-h.cora.com.br/v1/cobv/{}",
                    Uuid::new_v4().simple()
                )),
            }),
            total_paid: None,
        })
    }

    async fn get_invoice(&self, _id: &str) -> Result<CoraInvoiceResponse, AppError> {
        Err(AppError::ServiceUnavailable(
            "Consulta de cobrança não disponível no modo simulado.".to_string(),
        ))
    }

    async fn simulate_payment(&self, _id: &str) -> Result<(), AppError> {
        Err(AppError::BadRequest(
            "Simulação de pagamento só é permitida no ambiente de testes (sandbox) da Cora."
                .to_string(),
        ))
    }
}

pub struct CoraUnsupportedGateway {
    mode: CoraMode,
}

#[axum::async_trait]
impl BankGateway for CoraUnsupportedGateway {
    fn mode(&self) -> CoraMode {
        self.mode
    }

    async fn get_token(&self) -> Result<String, AppError> {
        Err(AppError::ServiceUnavailable(format!(
            "Cora {} não configurada; defina CORA_CLIENT_ID, CORA_CERT_FILE e CORA_KEY_FILE ou use CORA_MODE=mock",
            self.mode
        )))
    }

    async fn create_invoice(
        &self,
        _idempotency_key: &str,
        _invoice: CoraCreateInvoiceRequest,
    ) -> Result<CoraInvoiceResponse, AppError> {
        Err(AppError::ServiceUnavailable(format!(
            "Cora {} não configurada; defina CORA_CLIENT_ID, CORA_CERT_FILE e CORA_KEY_FILE ou use CORA_MODE=mock",
            self.mode
        )))
    }

    async fn get_invoice(&self, _id: &str) -> Result<CoraInvoiceResponse, AppError> {
        Err(AppError::ServiceUnavailable(format!(
            "Cora {} não configurada; defina CORA_CLIENT_ID, CORA_CERT_FILE e CORA_KEY_FILE ou use CORA_MODE=mock",
            self.mode
        )))
    }

    async fn simulate_payment(&self, _id: &str) -> Result<(), AppError> {
        Err(AppError::ServiceUnavailable(format!(
            "Cora {} não configurada; defina CORA_CLIENT_ID, CORA_CERT_FILE e CORA_KEY_FILE ou use CORA_MODE=mock",
            self.mode
        )))
    }
}

pub struct CoraDirectGateway {
    mode: CoraMode,
    config: CoraGatewayConfig,
    client: reqwest::Client,
    token_cache: TokenCache,
}

impl CoraDirectGateway {
    pub fn new(config: CoraGatewayConfig) -> Result<Self, AppError> {
        let client = build_http_client(&config)?;
        Ok(Self {
            mode: config.mode,
            config,
            client,
            token_cache: Arc::new(Mutex::new(None)),
        })
    }

    fn base_url(&self) -> &str {
        &self.config.base_url
    }

    async fn token_with_cache(&self) -> Result<String, AppError> {
        {
            let cache = self.token_cache.lock().await;
            if let Some((token, expires_at)) = cache.as_ref() {
                if Utc::now() < *expires_at {
                    return Ok(token.clone());
                }
            }
        }

        let token = self.fetch_token().await?;
        let mut cache = self.token_cache.lock().await;
        let expires_at = Utc::now() + chrono::Duration::seconds(token.expires_in.max(60) - 60);
        *cache = Some((token.access_token.clone(), expires_at));
        Ok(token.access_token)
    }

    async fn fetch_token(&self) -> Result<CoraAuthResponse, AppError> {
        let form = [
            ("grant_type", "client_credentials"),
            ("client_id", &self.config.client_id),
        ];
        let url = format!("{}/token", self.base_url());
        let resp = self
            .client
            .post(&url)
            .form(&form)
            .send()
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "falha ao solicitar token da Cora");
                AppError::ServiceUnavailable("Não foi possível conectar à Cora.".to_string())
            })?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %body, "Cora rejeitou a solicitação de token");
            return Err(AppError::ServiceUnavailable(
                "Credenciais da Cora rejeitadas.".to_string(),
            ));
        }

        resp.json::<CoraAuthResponse>().await.map_err(|e| {
            tracing::error!(error = %e, "resposta de token da Cora inválida");
            AppError::ServiceUnavailable("Resposta inesperada da Cora.".to_string())
        })
    }
}

fn build_http_client(config: &CoraGatewayConfig) -> Result<reqwest::Client, AppError> {
    let mut builder = reqwest::Client::builder();

    if config.base_url.starts_with("https://") {
        match (&config.cert_pem, &config.key_pem) {
            (Some(cert), Some(key)) => {
                let identity_pem = format!("{}\n{}", cert.trim(), key.trim());
                let identity =
                    reqwest::Identity::from_pem(identity_pem.as_bytes()).map_err(|e| {
                        tracing::error!(error = %e, "falha ao montar identidade mTLS da Cora");
                        AppError::ServiceUnavailable(
                            "Certificado ou chave privada da Cora inválidos.".to_string(),
                        )
                    })?;
                builder = builder.identity(identity);
            }
            _ => {
                return Err(AppError::ServiceUnavailable(
                    "Cora não configurada: certificado e chave privada são obrigatórios para HTTPS."
                        .to_string(),
                ));
            }
        }
    }

    builder.build().map_err(|e| {
        tracing::error!(error = %e, "falha ao construir cliente HTTP da Cora");
        AppError::InternalServerError("Erro interno ao preparar cliente da Cora.".to_string())
    })
}

#[axum::async_trait]
impl BankGateway for CoraDirectGateway {
    fn mode(&self) -> CoraMode {
        self.mode
    }

    async fn get_token(&self) -> Result<String, AppError> {
        self.token_with_cache().await
    }

    async fn create_invoice(
        &self,
        idempotency_key: &str,
        invoice: CoraCreateInvoiceRequest,
    ) -> Result<CoraInvoiceResponse, AppError> {
        let token = self.token_with_cache().await?;
        let url = format!("{}/v2/invoices", self.base_url());
        let resp = self
            .client
            .post(&url)
            .header("Idempotency-Key", idempotency_key)
            .header("Authorization", format!("Bearer {token}"))
            .json(&invoice)
            .send()
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "falha ao criar cobrança na Cora");
                AppError::ServiceUnavailable("Não foi possível criar cobrança na Cora.".to_string())
            })?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %body, "Cora rejeitou criação de cobrança");
            return Err(AppError::ServiceUnavailable(
                "A Cora não aceitou a cobrança.".to_string(),
            ));
        }

        resp.json::<CoraInvoiceResponse>().await.map_err(|e| {
            tracing::error!(error = %e, "resposta de criação da Cora inválida");
            AppError::ServiceUnavailable("Resposta inesperada da Cora.".to_string())
        })
    }

    async fn get_invoice(&self, id: &str) -> Result<CoraInvoiceResponse, AppError> {
        let token = self.token_with_cache().await?;
        let url = format!("{}/v2/invoices/{id}", self.base_url());
        let resp = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "falha ao consultar cobrança na Cora");
                AppError::ServiceUnavailable("Não foi possível consultar a Cora.".to_string())
            })?;

        if resp.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(AppError::NotFound);
        }

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %body, "Cora rejeitou consulta de cobrança");
            return Err(AppError::ServiceUnavailable(
                "A Cora não permitiu a consulta.".to_string(),
            ));
        }

        resp.json::<CoraInvoiceResponse>().await.map_err(|e| {
            tracing::error!(error = %e, "resposta de consulta da Cora inválida");
            AppError::ServiceUnavailable("Resposta inesperada da Cora.".to_string())
        })
    }

    async fn simulate_payment(&self, id: &str) -> Result<(), AppError> {
        if self.mode != CoraMode::Sandbox {
            return Err(AppError::BadRequest(
                "Simulação de pagamento só é permitida em ambiente de testes (sandbox) da Cora."
                    .to_string(),
            ));
        }
        let token = self.token_with_cache().await?;
        let idempotency_key = Uuid::new_v4().to_string();
        let url = format!("{}/v2/invoices/pay", self.base_url());
        let resp = self
            .client
            .post(&url)
            .header("Idempotency-Key", idempotency_key)
            .header("Authorization", format!("Bearer {token}"))
            .json(&CoraSimulatePaymentRequest { id: id.to_string() })
            .send()
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "falha ao simular pagamento na Cora");
                AppError::ServiceUnavailable(
                    "Não foi possível simular o pagamento na Cora.".to_string(),
                )
            })?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %body, "Cora rejeitou simulação de pagamento");
            return Err(AppError::ServiceUnavailable(
                "A Cora não aceitou a simulação de pagamento.".to_string(),
            ));
        }

        Ok(())
    }
}

pub fn gateway_for(config: &Config) -> Box<dyn BankGateway> {
    match config.cora_mode {
        CoraMode::Mock => Box::new(CoraMock::new()),
        mode => {
            if !config.cora_configured_for(mode) {
                return Box::new(CoraUnsupportedGateway { mode });
            }
            match CoraGatewayConfig::try_from_config(config).and_then(CoraDirectGateway::new) {
                Ok(gateway) => Box::new(gateway),
                Err(e) => {
                    tracing::warn!(error = %e, "Cora direto não pôde ser inicializado");
                    Box::new(CoraUnsupportedGateway { mode })
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endereco_so_vai_completo_e_normalizado() {
        let e = CoraAddress::do_cadastro(
            Some("Rua A"),
            Some("10"),
            Some("Centro"),
            Some("Recife"),
            Some("pe"),
            None,
            Some("50000-123"),
        )
        .unwrap();
        assert_eq!(e.zip_code, "50000123");
        assert_eq!(e.state, "PE");
        assert_eq!(e.complement, "N/A");
        assert!(CoraAddress::do_cadastro(
            Some("Rua A"),
            None,
            Some("Centro"),
            Some("Recife"),
            Some("PE"),
            None,
            Some("50000123")
        )
        .is_none());
        assert!(CoraAddress::do_cadastro(
            Some("Rua A"),
            Some("1"),
            Some("Centro"),
            Some("Recife"),
            Some("PE"),
            None,
            Some("5000")
        )
        .is_none());
    }

    #[test]
    fn consulta_paga_so_com_status_paid() {
        let r: CoraInvoiceResponse = serde_json::from_str(
            r#"{"id":"inv_1","status":"PAID","total_amount":3000,"total_paid":3000}"#,
        )
        .unwrap();
        assert!(r.esta_paga());
        assert_eq!(r.total_paid, Some(3000));
        let r: CoraInvoiceResponse =
            serde_json::from_str(r#"{"id":"inv_1","status":"IN_PAYMENT"}"#).unwrap();
        assert!(!r.esta_paga());
    }

    #[tokio::test]
    async fn test_gateway_for_mock() {
        let mut config = Config::default();
        config.cora_mode = CoraMode::Mock;
        let gateway = gateway_for(&config);
        assert_eq!(gateway.mode(), CoraMode::Mock);
        let token = gateway.get_token().await.unwrap();
        assert_eq!(token, "mocked_bearer_token_for_cora");
    }

    #[tokio::test]
    async fn test_gateway_for_sandbox_without_config_returns_unsupported_error() {
        let mut config = Config::default();
        config.cora_mode = CoraMode::Sandbox;
        config.cora_client_id = None;
        config.cora_cert_file = None;
        config.cora_key_file = None;
        config.cora_base_url = None;
        let gateway = gateway_for(&config);
        let err = gateway.get_token().await.unwrap_err();
        match err {
            AppError::ServiceUnavailable(msg) => {
                assert!(msg.contains("não configurada"), "{msg}");
            }
            other => panic!("Esperado ServiceUnavailable, recebido: {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_gateway_for_sandbox_with_http_base_url_returns_direct() {
        let mut config = Config::default();
        config.cora_mode = CoraMode::Sandbox;
        config.cora_base_url = Some("http://localhost:9999".to_string());
        let gateway = gateway_for(&config);
        assert_eq!(gateway.mode(), CoraMode::Sandbox);
    }

    #[tokio::test]
    async fn test_gateway_for_production_without_certificates_returns_unsupported() {
        let mut config = Config::default();
        config.cora_mode = CoraMode::Production;
        config.cora_client_id = Some("id".to_string());
        config.cora_cert_file = None;
        config.cora_key_file = None;
        config.cora_base_url = None;
        let gateway = gateway_for(&config);
        let err = gateway
            .create_invoice("key", dummy_invoice())
            .await
            .unwrap_err();
        match err {
            AppError::ServiceUnavailable(msg) => {
                assert!(msg.contains("não configurada"), "{msg}");
            }
            other => panic!("Esperado ServiceUnavailable, recebido: {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_mock_create_invoice_returns_url_and_pix() {
        let gateway = CoraMock::new();
        let resp = gateway
            .create_invoice("key", dummy_invoice())
            .await
            .unwrap();
        assert!(resp.id.starts_with("cora_"));
        assert!(resp.boleto_url().is_some());
        assert!(resp.pix_emv().is_some());
        assert!(resp.digitable_line().is_some());
    }

    #[tokio::test]
    async fn test_mock_simulate_payment_refuses() {
        let gateway = CoraMock::new();
        let err = gateway.simulate_payment("id").await.unwrap_err();
        match err {
            AppError::BadRequest(msg) => assert!(msg.contains("sandbox")),
            other => panic!("Esperado BadRequest, recebido: {:?}", other),
        }
    }

    #[test]
    fn test_invoice_body_amount_in_cents() {
        let invoice = CoraCreateInvoiceRequest {
            code: "fat-1".to_string(),
            customer: CoraCustomer {
                name: "Maria Silva".to_string(),
                email: Some("maria@escola.test".to_string()),
                address: None,
                document: CoraDocument {
                    identity: "12345678901".to_string(),
                    document_type: "CPF".to_string(),
                },
            },
            services: vec![CoraService {
                name: "Mensalidade".to_string(),
                description: "Mensalidade março".to_string(),
                amount: (150.0 * 100.0_f64).round() as i64,
            }],
            payment_terms: CoraPaymentTerms {
                due_date: "2026-10-20".to_string(),
                fine: Some(CoraFine {
                    amount: None,
                    rate: Some(2.0),
                }),
                interest: Some(CoraInterest { rate: 1.0 }),
            },
            payment_forms: Some(vec!["BANK_SLIP".to_string(), "PIX".to_string()]),
        };
        assert_eq!(invoice.services[0].amount, 15000);
    }

    fn dummy_invoice() -> CoraCreateInvoiceRequest {
        CoraCreateInvoiceRequest {
            code: "code".to_string(),
            customer: CoraCustomer {
                name: "Teste".to_string(),
                email: Some("teste@teste.com".to_string()),
                address: None,
                document: CoraDocument {
                    identity: "12345678901".to_string(),
                    document_type: "CPF".to_string(),
                },
            },
            services: vec![CoraService {
                name: "Mensalidade".to_string(),
                description: "Teste".to_string(),
                amount: 1000,
            }],
            payment_terms: CoraPaymentTerms {
                due_date: "2026-10-20".to_string(),
                fine: None,
                interest: None,
            },
            payment_forms: None,
        }
    }
}
