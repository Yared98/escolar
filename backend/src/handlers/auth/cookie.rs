//! Sessão do navegador: o refresh token vai num cookie `HttpOnly` em vez de ir no corpo da resposta.
//!
//! O navegador (frontend) pede esse modo com o cabeçalho `X-Auth-Mode: cookie`. Sem o cabeçalho, o
//! comportamento antigo continua (refresh token no corpo), para clientes que não são navegador.
//!
//! Defesas no modo cookie:
//! - `HttpOnly`: script da página (XSS) não consegue ler o refresh token;
//! - `SameSite=Strict` e `Path=/api/v1/auth`: o cookie só viaja para as rotas de sessão e só em
//!   requisições do mesmo site;
//! - cabeçalho customizado obrigatório (`X-Auth-Mode`): obriga o navegador a fazer a checagem
//!   prévia de CORS, que sites de terceiros não passam;
//! - conferência do `Origin` (mesma origem ou uma das origens permitidas).

use axum::{
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

use super::AuthResponseDto;
use crate::error::AppError;

pub const COOKIE_REFRESH: &str = "escolar_refresh";
pub const HEADER_MODO: &str = "x-auth-mode";
/// Só as rotas de sessão recebem o cookie.
pub const COOKIE_PATH: &str = "/api/v1/auth";
const REFRESH_MAX_AGE_SECS: i64 = 7 * 24 * 60 * 60;

/// O cliente pediu o modo cookie (navegador)?
pub fn modo_cookie(headers: &HeaderMap) -> bool {
    headers
        .get(HEADER_MODO)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.trim().eq_ignore_ascii_case("cookie"))
        .unwrap_or(false)
}

/// `Secure` em produção (HTTPS). `COOKIE_SECURE=true|false` força o valor (ex.: teste local em http).
pub fn cookie_secure(environment: &str) -> bool {
    match std::env::var("COOKIE_SECURE")
        .ok()
        .map(|v| v.trim().to_ascii_lowercase())
    {
        Some(v) if v == "true" || v == "1" => true,
        Some(v) if v == "false" || v == "0" => false,
        _ => environment.eq_ignore_ascii_case("production"),
    }
}

fn montar_cookie(valor: &str, max_age: i64, secure: bool) -> String {
    let mut cookie = format!(
        "{COOKIE_REFRESH}={valor}; Max-Age={max_age}; Path={COOKIE_PATH}; HttpOnly; SameSite=Strict"
    );
    if secure {
        cookie.push_str("; Secure");
    }
    cookie
}

/// Valor do `Set-Cookie` que grava o refresh token (token é base64url, sem caracteres especiais).
pub fn set_cookie_refresh(token: &str, secure: bool) -> Result<HeaderValue, AppError> {
    HeaderValue::from_str(&montar_cookie(token, REFRESH_MAX_AGE_SECS, secure))
        .map_err(|e| AppError::InternalServerError(e.to_string()))
}

/// Valor do `Set-Cookie` que apaga o cookie.
pub fn set_cookie_limpar(secure: bool) -> Result<HeaderValue, AppError> {
    HeaderValue::from_str(&montar_cookie("", 0, secure))
        .map_err(|e| AppError::InternalServerError(e.to_string()))
}

/// Lê o refresh token do cabeçalho `Cookie`.
pub fn refresh_do_cookie(headers: &HeaderMap) -> Option<String> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|linha| linha.split(';'))
        .filter_map(|par| par.trim().split_once('='))
        .find(|(nome, valor)| *nome == COOKIE_REFRESH && !valor.is_empty())
        .map(|(_, valor)| valor.to_string())
}

/// `Origin` ausente passa (cliente que não é navegador; o cabeçalho customizado e o `SameSite`
/// continuam valendo). Presente: precisa ser a própria origem (`Host`) ou uma origem permitida.
pub fn origem_permitida(headers: &HeaderMap, origens_permitidas: &str) -> bool {
    let Some(origem) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) else {
        return true;
    };
    let origem = origem.trim().trim_end_matches('/');
    if origens_permitidas
        .split(',')
        .map(|o| o.trim().trim_end_matches('/'))
        .any(|o| !o.is_empty() && o.eq_ignore_ascii_case(origem))
    {
        return true;
    }
    let host_da_origem = origem
        .split_once("://")
        .map(|(_, resto)| resto)
        .unwrap_or(origem);
    headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .map(|host| host.trim().eq_ignore_ascii_case(host_da_origem))
        .unwrap_or(false)
}

/// Resposta de login/cadastro: no modo cookie o refresh token sai do corpo e vai no cookie.
pub fn resposta_sessao(
    dto: AuthResponseDto,
    cookie: bool,
    secure: bool,
) -> Result<Response, AppError> {
    if !cookie {
        return Ok(Json(dto).into_response());
    }
    let refresh = dto.refresh_token.clone();
    let mut corpo: Value =
        serde_json::to_value(&dto).map_err(|e| AppError::InternalServerError(e.to_string()))?;
    if let Some(obj) = corpo.as_object_mut() {
        obj.remove("refresh_token");
    }
    let mut resposta = Json(corpo).into_response();
    resposta
        .headers_mut()
        .append(header::SET_COOKIE, set_cookie_refresh(&refresh, secure)?);
    Ok(resposta)
}

/// Resposta de renovação: corpo sem refresh token e cookie rotacionado.
pub fn resposta_renovacao(
    token: &str,
    refresh: &str,
    expires_in: usize,
    secure: bool,
) -> Result<Response, AppError> {
    let mut resposta = Json(json!({
        "token": token,
        "expires_in": expires_in,
        "token_type": "Bearer"
    }))
    .into_response();
    resposta
        .headers_mut()
        .append(header::SET_COOKIE, set_cookie_refresh(refresh, secure)?);
    Ok(resposta)
}

/// 401 que também apaga o cookie (refresh token inválido, revogado ou expirado).
pub fn resposta_nao_autorizado_limpando(mensagem: &str, secure: bool) -> Response {
    let mut resposta = (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": mensagem, "status": 401 })),
    )
        .into_response();
    if let Ok(v) = set_cookie_limpar(secure) {
        resposta.headers_mut().append(header::SET_COOKIE, v);
    }
    resposta
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(pares: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pares {
            h.append(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    #[test]
    fn cookie_tem_os_atributos_de_seguranca() {
        let v = set_cookie_refresh("abc", true).unwrap();
        let s = v.to_str().unwrap();
        for esperado in [
            "escolar_refresh=abc",
            "HttpOnly",
            "SameSite=Strict",
            "Path=/api/v1/auth",
            "Secure",
            "Max-Age=604800",
        ] {
            assert!(s.contains(esperado), "faltou {esperado} em {s}");
        }
        let sem = set_cookie_refresh("abc", false).unwrap();
        assert!(!sem.to_str().unwrap().contains("Secure"));
        assert!(set_cookie_limpar(true)
            .unwrap()
            .to_str()
            .unwrap()
            .contains("Max-Age=0"));
    }

    #[test]
    fn le_o_refresh_do_cabecalho_cookie() {
        let h = headers(&[("cookie", "outro=1; escolar_refresh=tok123; tema=escuro")]);
        assert_eq!(refresh_do_cookie(&h).as_deref(), Some("tok123"));
        assert_eq!(
            refresh_do_cookie(&headers(&[("cookie", "escolar_refresh=")])),
            None
        );
        assert_eq!(refresh_do_cookie(&HeaderMap::new()), None);
    }

    #[test]
    fn modo_cookie_so_com_o_cabecalho() {
        assert!(modo_cookie(&headers(&[("x-auth-mode", "cookie")])));
        assert!(!modo_cookie(&headers(&[("x-auth-mode", "body")])));
        assert!(!modo_cookie(&HeaderMap::new()));
    }

    #[test]
    fn origem_de_outro_site_e_recusada() {
        let permitidas = "https://escola.exemplo.com.br, http://localhost:3000";
        assert!(origem_permitida(
            &headers(&[("origin", "https://escola.exemplo.com.br")]),
            permitidas
        ));
        assert!(origem_permitida(
            &headers(&[("origin", "http://localhost:3000/")]),
            permitidas
        ));
        assert!(origem_permitida(
            &headers(&[
                ("origin", "http://localhost:8088"),
                ("host", "localhost:8088")
            ]),
            permitidas
        ));
        assert!(!origem_permitida(
            &headers(&[("origin", "https://malicioso.example")]),
            permitidas
        ));
        assert!(!origem_permitida(
            &headers(&[
                ("origin", "https://malicioso.example"),
                ("host", "escola.exemplo.com.br")
            ]),
            permitidas
        ));
        assert!(origem_permitida(&HeaderMap::new(), permitidas));
    }

    #[test]
    fn secure_segue_o_ambiente() {
        std::env::remove_var("COOKIE_SECURE");
        assert!(cookie_secure("production"));
        assert!(!cookie_secure("development"));
        assert!(!cookie_secure("demo"));
    }
}
