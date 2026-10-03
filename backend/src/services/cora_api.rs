use crate::error::AppError;
use reqwest::Client;
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

#[derive(Serialize)]
pub struct CoraCustomer {
    pub name: String,
    pub email: String,
    pub document: String,
}

#[derive(Serialize)]
pub struct CoraBankSlipOption {
    pub name: String,
    pub value: i32, // in cents
}

#[derive(Serialize)]
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

#[derive(Serialize)]
pub struct CoraCreateInvoiceRequest {
    pub request_id: String,
    pub name: String,
    pub description: String,
    pub customer: CoraCustomer,
    pub payment_terms: Vec<CoraBankSlip>,
}

#[derive(Deserialize)]
pub struct CoraPaymentTermResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub payment_type: String,
}

#[derive(Deserialize)]
pub struct CoraInvoiceResponse {
    pub id: String,
    pub url: String,
    pub payment_terms: Vec<CoraPaymentTermResponse>,
}

#[allow(dead_code)]
pub struct CoraClient {
    http_client: Client,
    base_url: String,
}

impl CoraClient {
    pub fn new() -> Self {
        Self {
            http_client: Client::new(),
            base_url: "https://api.sandbox.cora.com.br/v2".to_string(), // In production, use "https://api.cora.com.br/v2"
        }
    }

    pub async fn get_token(
        &self,
        client_id: &str,
        client_secret: &str,
    ) -> Result<String, AppError> {
        // NOTE: In Cora v2, authentication requires mTLS or standard Basic Auth for Sandbox
        // For simplicity in this ERP, we mock the auth logic to return a dummy token in testing,
        // but construct the real request structure.

        let _payload = [
            ("grant_type", "client_credentials"),
            ("client_id", client_id),
            ("client_secret", client_secret),
        ];

        /* Real request:
        let response = self.http_client.post("https://api.sandbox.cora.com.br/token")
            .form(&payload)
            .send()
            .await
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;

        let auth_resp: CoraAuthResponse = response.json().await.map_err(|e| AppError::InternalServerError(e.to_string()))?;
        Ok(auth_resp.access_token)
        */

        // Mocked for MVP to avoid strict mTLS setup
        Ok("mocked_bearer_token_for_cora".to_string())
    }

    pub async fn create_invoice(
        &self,
        _token: &str,
        _invoice: CoraCreateInvoiceRequest,
    ) -> Result<CoraInvoiceResponse, AppError> {
        /* Real request:
        let response = self.http_client.post(&format!("{}/invoices", self.base_url))
            .bearer_auth(token)
            .json(&invoice)
            .send()
            .await
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::BadRequest(format!("Erro na Cora: {}", error_text)));
        }

        let cora_resp: CoraInvoiceResponse = response.json().await.map_err(|e| AppError::InternalServerError(e.to_string()))?;
        Ok(cora_resp)
        */

        // Mocked response for ERP testing without real banking keys
        Ok(CoraInvoiceResponse {
            id: format!("cora_{}", Uuid::new_v4().simple()),
            url: format!("https://boletos.cora.com.br/{}", Uuid::new_v4().simple()),
            payment_terms: vec![],
        })
    }
}
