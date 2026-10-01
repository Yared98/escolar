use axum::{
    extract::Request,
    http::HeaderValue,
    middleware::Next,
    response::Response,
};

pub async fn opensec_security_headers_middleware(
    req: Request,
    next: Next,
) -> Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();

    // OpenSec Security Hardening Headers (OWASP Compliant)
    headers.insert(
        "X-Content-Type-Options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        "X-Frame-Options",
        HeaderValue::from_static("DENY"),
    );
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
