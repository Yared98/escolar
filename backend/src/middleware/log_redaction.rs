//! Redação de segredos em logs de requisição (B22).
//!
//! O tempo real da agenda (SSE) envia `?access_token=<JWT>` na query string;
//! o span padrão do `TraceLayer` gravaria a URI completa no log.

use axum::http::Request;
use tower_http::trace::MakeSpan;
use tracing::Span;

/// Parâmetros de query cujo valor nunca deve ir para o log.
const SENSITIVE_PARAMS: [&str; 2] = ["access_token", "token"];

/// Filtro de log padrão (sem `RUST_LOG`): em produção nada em `debug`.
pub fn default_log_filter(app_env: Option<&str>) -> &'static str {
    match app_env {
        Some(env) if env.trim().eq_ignore_ascii_case("production") => {
            "escolar_backend=info,tower_http=info"
        }
        _ => "escolar_backend=debug,tower_http=debug",
    }
}

/// Devolve a URI em texto para log, trocando por `***` o valor de
/// `access_token` e `token` (caminho e demais parâmetros ficam iguais).
pub fn redact_uri(uri: &str) -> String {
    let (before_fragment, fragment) = match uri.split_once('#') {
        Some((a, f)) => (a, Some(f)),
        None => (uri, None),
    };
    let Some((path, query)) = before_fragment.split_once('?') else {
        return uri.to_string();
    };
    let redacted_query = query
        .split('&')
        .map(|pair| match pair.split_once('=') {
            Some((key, _)) if is_sensitive(key) => format!("{key}=***"),
            None if is_sensitive(pair) => format!("{pair}=***"),
            _ => pair.to_string(),
        })
        .collect::<Vec<_>>()
        .join("&");
    match fragment {
        Some(f) => format!("{path}?{redacted_query}#{f}"),
        None => format!("{path}?{redacted_query}"),
    }
}

fn is_sensitive(key: &str) -> bool {
    SENSITIVE_PARAMS.iter().any(|p| key.eq_ignore_ascii_case(p))
}

/// `make_span_with` do `TraceLayer`: método, URI redigida e versão.
#[derive(Clone, Copy, Debug, Default)]
pub struct RedactedMakeSpan;

impl<B> MakeSpan<B> for RedactedMakeSpan {
    fn make_span(&mut self, request: &Request<B>) -> Span {
        let uri = redact_uri(&request.uri().to_string());
        tracing::info_span!(
            "request",
            method = %request.method(),
            uri = %uri,
            version = ?request.version(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redige_access_token_e_token() {
        assert_eq!(
            redact_uri("/a?x=1&access_token=abc"),
            "/a?x=1&access_token=***"
        );
        assert_eq!(redact_uri("/a?token=abc&y=2"), "/a?token=***&y=2");
        assert_eq!(
            redact_uri("/api/v1/auth/me?access_token=eyJ.a.b&token=zzz"),
            "/api/v1/auth/me?access_token=***&token=***"
        );
        assert_eq!(redact_uri("/a?ACCESS_TOKEN=abc"), "/a?ACCESS_TOKEN=***");
    }

    #[test]
    fn mantem_resto_da_url() {
        assert_eq!(redact_uri("/a?x=1&y=2"), "/a?x=1&y=2");
        assert_eq!(redact_uri("/a?tokens=1&mytoken=2"), "/a?tokens=1&mytoken=2");
        assert_eq!(
            redact_uri("/a?x=1&access_token=abc#f"),
            "/a?x=1&access_token=***#f"
        );
    }

    #[test]
    fn url_sem_query_nao_muda() {
        assert_eq!(redact_uri("/api/v1/health"), "/api/v1/health");
        assert_eq!(redact_uri("/"), "/");
    }

    #[test]
    fn filtro_padrao_por_ambiente() {
        assert_eq!(
            default_log_filter(Some("production")),
            "escolar_backend=info,tower_http=info"
        );
        assert_eq!(
            default_log_filter(Some("Production")),
            "escolar_backend=info,tower_http=info"
        );
        assert!(!default_log_filter(Some("production")).contains("debug"));
        assert!(default_log_filter(None).contains("debug"));
        assert!(default_log_filter(Some("development")).contains("debug"));
    }

    #[test]
    fn make_span_nao_expoe_token() {
        let req = Request::builder()
            .uri("/agenda/mensagens/stream?access_token=SEGREDO123")
            .body(())
            .unwrap();
        let mut mk = RedactedMakeSpan;
        let _ = mk.make_span(&req);
        assert!(!redact_uri(&req.uri().to_string()).contains("SEGREDO123"));
    }
}
