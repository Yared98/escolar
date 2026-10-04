use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::{
    extract::{Request, State},
    http::{HeaderMap, HeaderValue},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use tokio::sync::Mutex;

use crate::config::AppState;

#[derive(Clone, Debug)]
pub struct IpRateLimiter {
    requests: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
}

impl Default for IpRateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

impl IpRateLimiter {
    pub fn new() -> Self {
        Self {
            requests: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn check_and_record(&self, ip: &str, limit_per_minute: u32) -> bool {
        let window = Duration::from_secs(60);
        let now = Instant::now();
        let mut map = self.requests.lock().await;

        let timestamps = map.entry(ip.to_string()).or_insert_with(Vec::new);
        timestamps.retain(|&t| now.duration_since(t) < window);

        if timestamps.len() >= limit_per_minute as usize {
            false
        } else {
            timestamps.push(now);
            true
        }
    }

    pub async fn get_retry_after(&self, ip: &str) -> u64 {
        let window = Duration::from_secs(60);
        let now = Instant::now();
        let map = self.requests.lock().await;

        if let Some(timestamps) = map.get(ip) {
            if let Some(&oldest) = timestamps.first() {
                let elapsed = now.duration_since(oldest);
                if elapsed < window {
                    return (window - elapsed).as_secs().max(1);
                }
            }
        }
        60
    }
}

pub fn extract_client_ip_from_req(
    headers: &HeaderMap,
    socket_addr: Option<&std::net::SocketAddr>,
    config: &crate::config::Config,
) -> String {
    if config.trusted_proxy {
        if let Some(xff) = headers.get("x-forwarded-for").and_then(|h| h.to_str().ok()) {
            if let Some(first_ip) = xff.split(',').next() {
                let trimmed = first_ip.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
    }
    if let Some(addr) = socket_addr {
        return addr.ip().to_string();
    }
    "127.0.0.1".to_string()
}

pub async fn ip_rate_limit_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<axum::extract::ConnectInfo<std::net::SocketAddr>>,
    req: Request,
    next: Next,
) -> Response {
    let client_ip =
        extract_client_ip_from_req(&headers, connect_info.as_ref().map(|c| &c.0), &state.config);

    if state
        .ip_rate_limiter
        .check_and_record(&client_ip, state.config.rate_limit_public_rpm)
        .await
    {
        next.run(req).await
    } else {
        let retry_after = state.ip_rate_limiter.get_retry_after(&client_ip).await;
        let mut res = (
            axum::http::StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({
                "error": "Too Many Requests",
                "status": 429
            })),
        )
            .into_response();
        res.headers_mut().insert(
            axum::http::header::RETRY_AFTER,
            HeaderValue::from_str(&retry_after.to_string())
                .unwrap_or_else(|_| HeaderValue::from_static("60")),
        );
        res
    }
}

pub async fn opensec_security_headers_middleware(req: Request, next: Next) -> Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();

    // OpenSec Security Hardening Headers (OWASP Compliant)
    headers.insert(
        "X-Content-Type-Options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("X-Frame-Options", HeaderValue::from_static("DENY"));
    headers.insert(
        "X-XSS-Protection",
        HeaderValue::from_static("1; mode=block"),
    );
    headers.insert(
        "Strict-Transport-Security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    headers.insert(
        "Referrer-Policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        "X-OpenSec-Protection-Status",
        HeaderValue::from_static("Active - Ruleset v2026.4 (OWASP + LGPD)"),
    );

    response
}
