use crate::error::AppError;
use crate::AppState;
use axum::{
    body::Bytes,
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct CoraWebhookPayload {
    #[serde(default)]
    pub event_id: Option<String>,
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: CoraWebhookData,
}

#[derive(Deserialize)]
pub struct CoraWebhookData {
    pub invoice: CoraWebhookInvoice,
}

#[derive(Deserialize)]
pub struct CoraWebhookInvoice {
    pub id: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub amount: Option<f64>,
    #[serde(default)]
    pub paid_amount: Option<f64>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub amount_cents: Option<i64>,
}

impl CoraWebhookInvoice {
    pub fn get_paid_value(&self) -> Option<f64> {
        if let Some(val) = self.paid_amount {
            return Some(val);
        }
        if let Some(val) = self.amount {
            return Some(val);
        }
        if let Some(val) = self.value {
            return Some(val);
        }
        if let Some(cents) = self.amount_cents {
            return Some(cents as f64 / 100.0);
        }
        None
    }
}

type HmacSha256 = Hmac<Sha256>;

pub async fn cora_webhook_handler(
    State(state): State<AppState>,
    Path(tenant_id): Path<Uuid>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<serde_json::Value>, AppError> {
    let mut db = crate::db::acquire_tenant(&state.pool, tenant_id).await?;

    let creds = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT webhook_secret FROM tenant_bank_integrations WHERE tenant_id = $1 AND gateway_name = 'cora' AND is_active = true"
    )
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let webhook_secret = match creds {
        Some((Some(secret_val),)) => secret_val,
        _ => {
            return Err(AppError::Unauthorized(
                "Webhook secret not configured for this tenant".into(),
            ))
        }
    };

    // 2. Extract Cora-Signature header
    let raw_sig_header = headers
        .get("Cora-Signature")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing Cora-Signature header".into()))?;

    let sig_format =
        std::env::var("CORA_WEBHOOK_SIGNATURE_FORMAT").unwrap_or_else(|_| "hex".to_string());

    let (timestamp_opt, sig_hex_str) = parse_cora_signature_header(raw_sig_header);

    if sig_format == "t_v1" || timestamp_opt.is_some() {
        let ts = timestamp_opt.ok_or_else(|| {
            AppError::Unauthorized("Timestamp 't' missing in Cora-Signature header".into())
        })?;
        let now = chrono::Utc::now().timestamp();
        let diff = (now - ts).abs();
        if diff > 300 {
            return Err(AppError::Unauthorized(
                "Webhook timestamp expired or out of tolerance".into(),
            ));
        }
    }

    // 3. Compute HMAC SHA-256 and constant-time comparison
    let mut mac = HmacSha256::new_from_slice(webhook_secret.as_bytes())
        .map_err(|_| AppError::InternalServerError("Invalid HMAC key length".into()))?;

    if let Some(ts) = timestamp_opt {
        mac.update(ts.to_string().as_bytes());
        mac.update(b".");
    }
    mac.update(&body);

    let calculated_sig_bytes = mac.finalize().into_bytes();

    let header_sig_bytes = hex::decode(&sig_hex_str)
        .map_err(|_| AppError::Unauthorized("Invalid hex in Cora-Signature header".into()))?;

    let len_match = header_sig_bytes.len().ct_eq(&calculated_sig_bytes.len());
    let bytes_match = header_sig_bytes.ct_eq(&calculated_sig_bytes[..]);
    let sig_valid: bool = (len_match & bytes_match).into();

    if !sig_valid {
        return Err(AppError::Unauthorized("Invalid webhook signature".into()));
    }

    // 4. Parse the verified payload
    let payload: CoraWebhookPayload = serde_json::from_slice(&body)
        .map_err(|_| AppError::BadRequest("Invalid JSON payload".into()))?;

    // 5. Anti-replay check via webhook_events
    let cora_id = payload.data.invoice.id.clone();
    let event_id = payload.event_id.clone().unwrap_or_else(|| {
        headers
            .get("webhook-event-id")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("{}_{}", payload.event_type, cora_id))
    });

    let payload_hash = hex::encode(Sha256::digest(&body));

    let insert_res = sqlx::query(
        "INSERT INTO webhook_events (tenant_id, gateway_name, event_id, payload_hash) VALUES ($1, 'cora', $2, $3) ON CONFLICT (tenant_id, gateway_name, event_id) DO NOTHING"
    )
    .bind(tenant_id)
    .bind(&event_id)
    .bind(&payload_hash)
    .execute(&mut *db)
    .await?;

    if insert_res.rows_affected() == 0 {
        tracing::info!(
            "Webhook event {} already processed for tenant {}",
            event_id,
            tenant_id
        );
        return Ok(Json(serde_json::json!({
            "status": "already_processed"
        })));
    }

    // 6. Process business logic
    if payload.event_type == "invoice.paid" || payload.event_type == "invoice.settled" {
        let fatura_opt = sqlx::query_as::<_, (Uuid, f64, String)>(
            "SELECT id, valor, status FROM faturas WHERE tenant_id = $1 AND gateway_invoice_id = $2 AND gateway_name = 'cora'"
        )
        .bind(tenant_id)
        .bind(&cora_id)
        .fetch_optional(&mut *db)
        .await?;

        if let Some((fatura_id, fatura_valor, status)) = fatura_opt {
            if status == "pendente" {
                if let Some(paid_raw) = payload.data.invoice.get_paid_value() {
                    let paid_reais = if paid_raw >= 100.0 * fatura_valor - 0.01
                        && (paid_raw / 100.0 - fatura_valor).abs() < 0.01
                    {
                        paid_raw / 100.0
                    } else {
                        paid_raw
                    };

                    if (paid_reais - fatura_valor).abs() > 0.01 {
                        sqlx::query(
                            "INSERT INTO audit_logs (tenant_id, acao, entidade, entidade_id, detalhes_json) VALUES ($1, 'webhook_valor_divergente', 'faturas', $2, $3)"
                        )
                        .bind(tenant_id)
                        .bind(fatura_id.to_string())
                        .bind(serde_json::json!({
                            "fatura_valor": fatura_valor,
                            "valor_pago": paid_reais,
                            "gateway_invoice_id": cora_id,
                            "gateway_name": "cora",
                            "reason": "Valor pago no webhook difere do valor cadastrado na fatura"
                        }))
                        .execute(&mut *db)
                        .await?;

                        return Ok(Json(serde_json::json!({
                            "status": "divergent_value_flagged"
                        })));
                    }
                }

                sqlx::query(
                    "UPDATE faturas SET status = 'pago', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'"
                )
                .bind(fatura_id)
                .bind(tenant_id)
                .execute(&mut *db)
                .await?;
            }
        } else {
            tracing::info!(
                "Webhook skipped: invoice {} not found for tenant {}",
                cora_id,
                tenant_id
            );
        }
    }

    Ok(Json(serde_json::json!({"status": "received"})))
}

fn parse_cora_signature_header(header: &str) -> (Option<i64>, String) {
    let mut ts_opt = None;
    let mut sig_str = header.trim().to_string();

    if header.contains("v1=") {
        for part in header.split(&[',', ';'][..]) {
            let part = part.trim();
            if let Some(stripped) = part.strip_prefix("t=") {
                if let Ok(parsed_ts) = stripped.trim().parse::<i64>() {
                    ts_opt = Some(parsed_ts);
                }
            } else if let Some(stripped) = part.strip_prefix("v1=") {
                sig_str = stripped.trim().to_string();
            }
        }
    }

    (ts_opt, sig_str)
}
