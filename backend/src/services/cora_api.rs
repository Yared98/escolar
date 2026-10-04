use crate::config::CoraMode;
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize)]
pub struct CoraAuthRequest {
    grant_type: String,
    client_id: String,
}

#[derive(Deserialize)]
pub struct CoraAuthResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i32,
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraCustomer {
    pub name: String,
    pub email: String,
    pub document: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraBankSlipOption {
    pub name: String,
    pub value: i32, // in cents
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraBankSlip {
    #[serde(rename = "type")]
    pub payment_type: String, // "BOLETO"
    pub amount: i32,
    pub due_at: String, // YYYY-MM-DD
    pub customer: CoraCustomer,
    pub description: String,
    pub discount: Option<CoraBankSlipOption>,
    pub fine: Option<CoraBankSlipOption>,
    pub interest: Option<CoraBankSlipOption>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CoraCreateInvoiceRequest {
    pub request_id: String,
    pub name: String,
    pub description: String,
    pub customer: CoraCustomer,
    pub payment_terms: Vec<CoraBankSlip>,
}

#[derive(Deserialize, Clone, Debug)]
pub struct CoraPaymentTermResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub payment_type: String,
}

#[derive(Deserialize, Clone, Debug)]
pub struct CoraInvoiceResponse {
    pub id: String,
    pub url: String,
    pub payment_terms: Vec<CoraPaymentTermResponse>,
}

#[axum::async_trait]
pub trait BankGateway: Send + Sync {
    async fn get_token(&self, client_id: &str, client_secret: &str) -> Result<String, AppError>;
    async fn create_invoice(
        &self,
        token: &str,
        invoice: CoraCreateInvoiceRequest,
    ) -> Result<CoraInvoiceResponse, AppError>;
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
    async fn get_token(&self, _client_id: &str, _client_secret: &str) -> Result<String, AppError> {
        Ok("mocked_bearer_token_for_cora".to_string())
    }

    async fn create_invoice(
        &self,
        _token: &str,
        _invoice: CoraCreateInvoiceRequest,
    ) -> Result<CoraInvoiceResponse, AppError> {
        Ok(CoraInvoiceResponse {
            id: format!("cora_{}", Uuid::new_v4().simple()),
            url: format!("https://boletos.cora.com.br/{}", Uuid::new_v4().simple()),
            payment_terms: vec![],
        })
    }
}

pub type CoraClient = CoraMock;

pub struct CoraUnsupportedGateway {
    mode: CoraMode,
}

#[axum::async_trait]
impl BankGateway for CoraUnsupportedGateway {
    async fn get_token(&self, _client_id: &str, _client_secret: &str) -> Result<String, AppError> {
        Err(AppError::ServiceUnavailable(format!(
            "Cora {} ainda não suportado; use CORA_MODE=mock",
            self.mode
        )))
    }

    async fn create_invoice(
        &self,
        _token: &str,
        _invoice: CoraCreateInvoiceRequest,
    ) -> Result<CoraInvoiceResponse, AppError> {
        Err(AppError::ServiceUnavailable(format!(
            "Cora {} ainda não suportado; use CORA_MODE=mock",
            self.mode
        )))
    }
}

pub fn gateway_for(mode: CoraMode) -> Box<dyn BankGateway> {
    match mode {
        CoraMode::Mock => Box::new(CoraMock),
        CoraMode::Sandbox | CoraMode::Production => Box::new(CoraUnsupportedGateway { mode }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_gateway_for_mock() {
        let gateway = gateway_for(CoraMode::Mock);
        let token = gateway.get_token("client", "secret").await.unwrap();
        assert_eq!(token, "mocked_bearer_token_for_cora");
    }

    #[tokio::test]
    async fn test_gateway_for_sandbox_returns_unsupported_error() {
        let gateway = gateway_for(CoraMode::Sandbox);
        let err = gateway.get_token("client", "secret").await.unwrap_err();
        match err {
            AppError::ServiceUnavailable(msg) => {
                assert_eq!(msg, "Cora sandbox ainda não suportado; use CORA_MODE=mock");
            }
            other => panic!("Esperado ServiceUnavailable, recebido: {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_gateway_for_production_returns_unsupported_error() {
        let gateway = gateway_for(CoraMode::Production);
        let dummy_invoice = CoraCreateInvoiceRequest {
            request_id: "req-123".to_string(),
            name: "Fatura Teste".to_string(),
            description: "Descrição".to_string(),
            customer: CoraCustomer {
                name: "Aluno Teste".to_string(),
                email: "aluno@teste.com".to_string(),
                document: "12345678901".to_string(),
            },
            payment_terms: vec![],
        };
        let err = gateway
            .create_invoice("token", dummy_invoice)
            .await
            .unwrap_err();
        match err {
            AppError::ServiceUnavailable(msg) => {
                assert_eq!(
                    msg,
                    "Cora production ainda não suportado; use CORA_MODE=mock"
                );
            }
            other => panic!("Esperado ServiceUnavailable, recebido: {:?}", other),
        }
    }
}
