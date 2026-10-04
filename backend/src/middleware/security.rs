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

        // Limpeza automatica (GC) de registros expirados e remocao de chaves sem timestamps
        map.retain(|_, timestamps| {
            timestamps.retain(|&t| now.duration_since(t) < window);
            !timestamps.is_empty()
        });

        let timestamps = map.entry(ip.to_string()).or_insert_with(Vec::new);
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

    pub async fn gc(&self) {
        let window = Duration::from_secs(60);
        let now = Instant::now();
        let mut map = self.requests.lock().await;
        map.retain(|_, timestamps| {
            timestamps.retain(|&t| now.duration_since(t) < window);
            !timestamps.is_empty()
        });
    }

    pub async fn len(&self) -> usize {
        self.requests.lock().await.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.len().await == 0
    }
}

pub fn extract_client_ip_from_req(
    headers: &HeaderMap,
    socket_addr: Option<&std::net::SocketAddr>,
    config: &crate::config::Config,
) -> String {
    if config.trusted_proxy {
        if let Some(xff) = headers.get("x-forwarded-for").and_then(|h| h.to_str().ok()) {
            if let Some(last_ip) = xff.split(',').next_back() {
                let trimmed = last_ip.trim();
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ip_rate_limiter_gc() {
        let limiter = IpRateLimiter::new();
        assert_eq!(limiter.len().await, 0);

        limiter.check_and_record("10.0.0.1", 5).await;
        limiter.check_and_record("10.0.0.2", 5).await;
        assert_eq!(limiter.len().await, 2);

        limiter.gc().await;
        // Entradas recentes continuam no mapa
        assert_eq!(limiter.len().await, 2);
    }

    #[test]
    fn test_extract_client_ip_from_req_trusted_proxy_last_item() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.195, 70.41.3.18, 150.172.238.178"),
        );

        let mut config = crate::config::Config::default();
        config.trusted_proxy = true;

        let ip = extract_client_ip_from_req(&headers, None, &config);
        // Deve extrair o ultimo IP (adicionado pelo proxy confiavel mais proximo)
        assert_eq!(ip, "150.172.238.178");
    }

    #[test]
    fn test_extract_client_ip_from_req_untrusted_proxy_uses_socket() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.195, 150.172.238.178"),
        );

        let mut config = crate::config::Config::default();
        config.trusted_proxy = false;

        let socket_addr: std::net::SocketAddr = "192.168.1.100:8080".parse().unwrap();
        let ip = extract_client_ip_from_req(&headers, Some(&socket_addr), &config);

        // TRUSTED_PROXY=false deve ignorar X-Forwarded-For e usar o IP do socket
        assert_eq!(ip, "192.168.1.100");
    }
}
