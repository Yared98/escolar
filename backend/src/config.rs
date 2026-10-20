use std::env;

use ring::signature::{Ed25519KeyPair, KeyPair};

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CoraMode {
    Mock,
    Sandbox,
    Production,
}

impl std::fmt::Display for CoraMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CoraMode::Mock => write!(f, "mock"),
            CoraMode::Sandbox => write!(f, "sandbox"),
            CoraMode::Production => write!(f, "production"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ItauMode {
    Mock,
    Sandbox,
    Production,
}

impl std::fmt::Display for ItauMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ItauMode::Mock => write!(f, "mock"),
            ItauMode::Sandbox => write!(f, "sandbox"),
            ItauMode::Production => write!(f, "production"),
        }
    }
}

pub fn parse_itau_mode(val: Option<&str>) -> Result<ItauMode, String> {
    match val {
        Some(s) if !s.trim().is_empty() => match s.trim().to_lowercase().as_str() {
            "mock" => Ok(ItauMode::Mock),
            "sandbox" => Ok(ItauMode::Sandbox),
            "production" => Ok(ItauMode::Production),
            _ => Err(format!(
                "Configuração inválida: ITAU_MODE='{s}'. Valores permitidos: mock, sandbox, production."
            )),
        },
        _ => Ok(ItauMode::Mock),
    }
}

pub fn parse_cora_mode(val: Option<&str>) -> Result<CoraMode, String> {
    match val {
        Some(s) if !s.trim().is_empty() => match s.trim().to_lowercase().as_str() {
            "mock" => Ok(CoraMode::Mock),
            "sandbox" => Ok(CoraMode::Sandbox),
            "production" => Ok(CoraMode::Production),
            _ => Err(format!(
                "Configuração inválida: CORA_MODE='{s}'. Valores permitidos: mock, sandbox, production."
            )),
        },
        _ => Ok(CoraMode::Mock),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EmailMode {
    Simulado,
}

impl std::fmt::Display for EmailMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EmailMode::Simulado => write!(f, "simulado"),
        }
    }
}

pub fn parse_email_mode(val: Option<&str>, is_production: bool) -> Result<EmailMode, String> {
    match val {
        Some(s) if !s.trim().is_empty() => match s.trim().to_lowercase().as_str() {
            "simulado" => Ok(EmailMode::Simulado),
            _ => {
                let msg = format!(
                    "Configuração inválida: EMAIL_MODE='{s}'. Nesta versão só é suportado 'simulado'."
                );
                if is_production {
                    Err(msg)
                } else {
                    tracing::warn!("{msg} Usando simulado.");
                    Ok(EmailMode::Simulado)
                }
            }
        },
        _ => Ok(EmailMode::Simulado),
    }
}

const MENSAGEM_APP_SECRETS_KEY: &str = "Configuração inválida: APP_SECRETS_KEY deve ter 64 caracteres hexadecimais (gere com: openssl rand -hex 32).";

#[derive(Clone)]
pub struct ChaveMestra([u8; 32]);

impl ChaveMestra {
    pub fn from_hex(valor: &str) -> Result<Self, String> {
        if valor.len() != 64 || !valor.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(MENSAGEM_APP_SECRETS_KEY.to_string());
        }
        let mut bytes = [0u8; 32];
        for (i, byte) in bytes.iter_mut().enumerate() {
            *byte = u8::from_str_radix(&valor[i * 2..i * 2 + 2], 16)
                .map_err(|_| MENSAGEM_APP_SECRETS_KEY.to_string())?;
        }
        Ok(Self(bytes))
    }

    pub fn bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

impl std::fmt::Debug for ChaveMestra {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ChaveMestra(***)")
    }
}

pub fn parse_app_secrets_key(val: Option<&str>) -> Result<Option<ChaveMestra>, String> {
    match val.map(str::trim) {
        Some(s) if !s.is_empty() => ChaveMestra::from_hex(s).map(Some),
        _ => Ok(None),
    }
}

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_private_pem: String,
    pub jwt_public_pem: String,
    pub jwt_public_x: String,
    pub port: u16,
    pub allowed_origins: String,
    #[allow(dead_code)]
    pub environment: String,
    pub trusted_proxy: bool,
    pub rate_limit_public_rpm: u32,
    pub account_lock_max_attempts: i64,
    pub account_lock_window_minutes: i64,
    pub cora_mode: CoraMode,
    pub cora_client_id: Option<String>,
    pub cora_cert_file: Option<String>,
    pub cora_key_file: Option<String>,
    pub cora_base_url: Option<String>,
    pub email_mode: EmailMode,
    pub app_public_url: String,
    pub app_secrets_key: Option<ChaveMestra>,
    pub itau_mode: ItauMode,
    pub itau_sts_base_url: Option<String>,
}

impl Config {
    /// Indica se as credenciais de servidor da Cora estão presentes.
    /// Em modo de teste (CORA_BASE_URL explícito com http://) o certificado não é exigido.
    pub fn cora_configured_for(&self, mode: CoraMode) -> bool {
        if mode == CoraMode::Mock {
            return true;
        }
        if let Some(base) = &self.cora_base_url {
            if base.trim().starts_with("http://") {
                return !base.trim().is_empty();
            }
        }
        self.cora_client_id
            .as_ref()
            .is_some_and(|s| !s.trim().is_empty())
            && self
                .cora_cert_file
                .as_ref()
                .is_some_and(|s| !s.trim().is_empty())
            && self
                .cora_key_file
                .as_ref()
                .is_some_and(|s| !s.trim().is_empty())
    }

    pub fn itau_sts_url(&self) -> &str {
        self.itau_sts_base_url
            .as_deref()
            .unwrap_or("https://sts.itau.com.br")
    }

    pub fn is_production(&self) -> bool {
        self.environment.to_lowercase() == "production"
    }

    pub fn from_env() -> Result<Self, String> {
        let environment = env::var("APP_ENV")
            .or_else(|_| env::var("ENVIRONMENT"))
            .unwrap_or_else(|_| "development".to_string());

        let is_production = environment.to_lowercase() == "production";

        let database_url = match env::var("DATABASE_URL") {
            Ok(url) if !url.trim().is_empty() => url,
            _ => {
                if is_production {
                    return Err(
                        "ERRO DE SEGURANÇA: DATABASE_URL deve ser explicitamente configurada em produção!"
                            .to_string(),
                    );
                }
                "postgres://escolar_app:escolar_password@localhost:5432/escolar_db".to_string()
            }
        };

        let (jwt_private_pem, jwt_public_pem, jwt_public_x) = if let Ok(path) =
            env::var("JWT_ED25519_PRIVATE_PEM_FILE")
        {
            if path.trim().is_empty() {
                // Variável definida mas vazia: ignore e tente a próxima fonte.
                if let Ok(pem) = env::var("JWT_ED25519_PRIVATE_PEM") {
                    if pem.trim().is_empty() {
                        return Err("JWT_ED25519_PRIVATE_PEM está vazio.".to_string());
                    }
                    material_from_private_pem(&pem)?
                } else if is_production {
                    return Err(
                        "ERRO CRÍTICO: em produção, configure JWT_ED25519_PRIVATE_PEM (conteúdo) ou JWT_ED25519_PRIVATE_PEM_FILE (caminho) com uma chave PKCS#8 Ed25519."
                            .to_string(),
                    );
                } else {
                    development_signing_material()
                }
            } else {
                let pem = std::fs::read_to_string(&path).map_err(|e| {
                    format!("JWT_ED25519_PRIVATE_PEM_FILE ({path}) não pôde ser lido: {e}")
                })?;
                if pem.trim().is_empty() {
                    return Err(
                        "JWT_ED25519_PRIVATE_PEM_FILE aponta para arquivo vazio.".to_string()
                    );
                }
                material_from_private_pem(&pem)?
            }
        } else if let Ok(pem) = env::var("JWT_ED25519_PRIVATE_PEM") {
            if pem.trim().is_empty() {
                return Err("JWT_ED25519_PRIVATE_PEM está vazio.".to_string());
            }
            material_from_private_pem(&pem)?
        } else if is_production {
            return Err(
                "ERRO CRÍTICO: em produção, configure JWT_ED25519_PRIVATE_PEM (conteúdo) ou JWT_ED25519_PRIVATE_PEM_FILE (caminho) com uma chave PKCS#8 Ed25519."
                    .to_string(),
            );
        } else {
            development_signing_material()
        };

        let allowed_origins = env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000,http://127.0.0.1:3000".to_string());

        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8000);

        let trusted_proxy = env::var("TRUSTED_PROXY")
            .map(|v| {
                let s = v.trim().to_lowercase();
                s == "true" || s == "1" || s == "yes"
            })
            .unwrap_or(false);

        let rate_limit_public_rpm = env::var("RATE_LIMIT_PUBLIC_RPM")
            .or_else(|_| env::var("RATE_LIMIT_PER_MINUTE"))
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(60);

        let account_lock_max_attempts = env::var("ACCOUNT_LOCK_MAX_ATTEMPTS")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(5);

        let account_lock_window_minutes = env::var("ACCOUNT_LOCK_WINDOW_MINUTES")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(15);

        let cora_mode = parse_cora_mode(env::var("CORA_MODE").ok().as_deref())?;
        let cora_client_id = env::var("CORA_CLIENT_ID")
            .ok()
            .filter(|s| !s.trim().is_empty());
        let cora_cert_file = env::var("CORA_CERT_FILE")
            .ok()
            .filter(|s| !s.trim().is_empty());
        let cora_key_file = env::var("CORA_KEY_FILE")
            .ok()
            .filter(|s| !s.trim().is_empty());
        let cora_base_url = env::var("CORA_BASE_URL")
            .ok()
            .filter(|s| !s.trim().is_empty());
        let email_mode = parse_email_mode(env::var("EMAIL_MODE").ok().as_deref(), is_production)?;
        let app_public_url =
            env::var("APP_PUBLIC_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
        let app_secrets_key = parse_app_secrets_key(env::var("APP_SECRETS_KEY").ok().as_deref())?;
        let itau_mode = parse_itau_mode(env::var("ITAU_MODE").ok().as_deref())?;
        let itau_sts_base_url = env::var("ITAU_STS_BASE_URL")
            .ok()
            .filter(|s| !s.trim().is_empty());

        Ok(Config {
            database_url,
            jwt_private_pem,
            jwt_public_pem,
            jwt_public_x,
            port,
            allowed_origins,
            environment,
            trusted_proxy,
            rate_limit_public_rpm,
            account_lock_max_attempts,
            account_lock_window_minutes,
            cora_mode,
            cora_client_id,
            cora_cert_file,
            cora_key_file,
            cora_base_url,
            email_mode,
            app_public_url,
            app_secrets_key,
            itau_mode,
            itau_sts_base_url,
        })
    }
}

impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("database_url", &"***")
            .field("jwt_private_pem", &"***")
            .field("jwt_public_pem", &self.jwt_public_pem)
            .field("jwt_public_x", &self.jwt_public_x)
            .field("port", &self.port)
            .field("allowed_origins", &self.allowed_origins)
            .field("environment", &self.environment)
            .field("trusted_proxy", &self.trusted_proxy)
            .field("rate_limit_public_rpm", &self.rate_limit_public_rpm)
            .field("account_lock_max_attempts", &self.account_lock_max_attempts)
            .field(
                "account_lock_window_minutes",
                &self.account_lock_window_minutes,
            )
            .field("cora_mode", &self.cora_mode)
            .field("cora_base_url", &self.cora_base_url)
            .field("email_mode", &self.email_mode)
            .field("app_public_url", &self.app_public_url)
            .field("app_secrets_key", &self.app_secrets_key)
            .field("itau_mode", &self.itau_mode)
            .field("itau_sts_base_url", &self.itau_sts_base_url)
            .finish()
    }
}

const DEV_SEED: [u8; 32] = *b"escolar-dev-ed25519-seed-2026!!!";

pub fn development_signing_material() -> (String, String, String) {
    material_from_seed(&DEV_SEED).expect("chave Ed25519 de desenvolvimento")
}

pub fn material_from_private_pem(pem: &str) -> Result<(String, String, String), String> {
    let der = decode_pem(pem).map_err(|e| format!("JWT_ED25519_PRIVATE_PEM inválida: {e}"))?;
    let key = Ed25519KeyPair::from_pkcs8_maybe_unchecked(&der)
        .map_err(|_| "JWT_ED25519_PRIVATE_PEM não é uma chave Ed25519 PKCS#8".to_string())?;
    Ok(material_from_key(pem.trim().to_string() + "\n", &key))
}

pub fn material_from_seed(seed: &[u8; 32]) -> Result<(String, String, String), String> {
    let key = Ed25519KeyPair::from_seed_unchecked(seed)
        .map_err(|_| "seed Ed25519 inválida".to_string())?;
    let private_der = pkcs8_ed25519_private(seed);
    let private_pem = der_to_pem("PRIVATE KEY", &private_der);
    Ok(material_from_key(private_pem, &key))
}

fn material_from_key(private_pem: String, key: &Ed25519KeyPair) -> (String, String, String) {
    let public = key.public_key().as_ref().to_vec();
    let public_pem = der_to_pem("PUBLIC KEY", &spki_ed25519_public(&public));
    let public_x = base64_url(&public);
    (private_pem, public_pem, public_x)
}

fn pkcs8_ed25519_private(seed: &[u8; 32]) -> Vec<u8> {
    let mut der = vec![
        0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04,
        0x20,
    ];
    der.extend_from_slice(seed);
    der
}

fn spki_ed25519_public(public_key: &[u8]) -> Vec<u8> {
    let mut der = vec![
        0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
    ];
    der.extend_from_slice(public_key);
    der
}

fn der_to_pem(label: &str, der: &[u8]) -> String {
    const B64: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut body = String::new();
    let mut index = 0;
    while index < der.len() {
        let remaining = der.len() - index;
        let b0 = der[index];
        let b1 = if remaining > 1 { der[index + 1] } else { 0 };
        let b2 = if remaining > 2 { der[index + 2] } else { 0 };
        body.push(B64[(b0 >> 2) as usize] as char);
        body.push(B64[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if remaining > 1 {
            body.push(B64[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            body.push('=');
        }
        if remaining > 2 {
            body.push(B64[(b2 & 0x3f) as usize] as char);
        } else {
            body.push('=');
        }
        index += 3;
    }

    let mut pem = format!("-----BEGIN {label}-----\n");
    for line in body.as_bytes().chunks(64) {
        pem.push_str(std::str::from_utf8(line).expect("base64 ascii"));
        pem.push('\n');
    }
    pem.push_str(&format!("-----END {label}-----\n"));
    pem
}

fn decode_pem(pem: &str) -> Result<Vec<u8>, String> {
    let body: String = pem
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with("-----"))
        .collect();
    base64_decode(&body)
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    const TABLE: &[u8; 256] = &{
        let mut table = [255u8; 256];
        let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut i = 0;
        while i < alphabet.len() {
            table[alphabet[i] as usize] = i as u8;
            i += 1;
        }
        table
    };
    let cleaned: String = input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '=')
        .collect();
    let bytes = cleaned.as_bytes();
    let mut out = Vec::new();
    let mut index = 0;
    while index + 4 <= bytes.len() {
        let n = decode_quartet(&bytes[index..index + 4], TABLE)?;
        out.extend_from_slice(&n.to_be_bytes()[1..]);
        index += 4;
    }
    let rest = bytes.len() - index;
    if rest == 2 {
        let n = decode_quartet(&[bytes[index], bytes[index + 1], b'A', b'A'], TABLE)?;
        out.push((n >> 16) as u8);
    } else if rest == 3 {
        let n = decode_quartet(
            &[bytes[index], bytes[index + 1], bytes[index + 2], b'A'],
            TABLE,
        )?;
        out.push((n >> 16) as u8);
        out.push((n >> 8) as u8);
    } else if rest != 0 {
        return Err("PEM base64 incompleto".into());
    }
    Ok(out)
}

fn decode_quartet(chars: &[u8], table: &[u8; 256]) -> Result<u32, String> {
    let mut value = 0u32;
    for char in chars {
        let decoded = table[*char as usize];
        if decoded == 255 {
            return Err("caractere base64 inválido".into());
        }
        value = (value << 6) | decoded as u32;
    }
    Ok(value)
}

fn base64_url(bytes: &[u8]) -> String {
    const URL_SAFE_CHARS: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut result = String::new();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(URL_SAFE_CHARS[(b0 >> 2) as usize] as char);
        result.push(URL_SAFE_CHARS[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            result.push(URL_SAFE_CHARS[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
        }
        if chunk.len() > 2 {
            result.push(URL_SAFE_CHARS[(b2 & 0x3F) as usize] as char);
        }
    }
    result
}

impl Default for Config {
    fn default() -> Self {
        Self {
            database_url: String::new(),
            jwt_private_pem: String::new(),
            jwt_public_pem: String::new(),
            jwt_public_x: String::new(),
            port: 8000,
            allowed_origins: "http://localhost:3000".to_string(),
            environment: "development".to_string(),
            trusted_proxy: false,
            rate_limit_public_rpm: 60,
            account_lock_max_attempts: 5,
            account_lock_window_minutes: 15,
            cora_mode: CoraMode::Mock,
            cora_client_id: None,
            cora_cert_file: None,
            cora_key_file: None,
            cora_base_url: None,
            email_mode: EmailMode::Simulado,
            app_public_url: "http://localhost:3000".to_string(),
            app_secrets_key: None,
            itau_mode: ItauMode::Mock,
            itau_sts_base_url: None,
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub config: Config,
    pub message_hub: crate::realtime::MessageHub,
    pub ip_rate_limiter: crate::middleware::security::IpRateLimiter,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cora_mode_parsing() {
        assert_eq!(parse_cora_mode(None).unwrap(), CoraMode::Mock);
        assert_eq!(parse_cora_mode(Some("")).unwrap(), CoraMode::Mock);
        assert_eq!(parse_cora_mode(Some("mock")).unwrap(), CoraMode::Mock);
        assert_eq!(parse_cora_mode(Some("MOCK")).unwrap(), CoraMode::Mock);
        assert_eq!(parse_cora_mode(Some("sandbox")).unwrap(), CoraMode::Sandbox);
        assert_eq!(parse_cora_mode(Some("Sandbox")).unwrap(), CoraMode::Sandbox);
        assert_eq!(
            parse_cora_mode(Some("production")).unwrap(),
            CoraMode::Production
        );
        assert_eq!(
            parse_cora_mode(Some("PRODUCTION")).unwrap(),
            CoraMode::Production
        );
        let err = parse_cora_mode(Some("banana")).unwrap_err();
        assert!(err.contains("Configuração inválida: CORA_MODE='banana'"));
    }

    #[test]
    fn test_config_debug_redacts_secrets() {
        let config = Config {
            database_url: "postgres://escolar_app:escolar_password@localhost:5432/escolar_db".to_string(),
            jwt_private_pem: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----".to_string(),
            jwt_public_pem: "PUBLIC_PEM".to_string(),
            jwt_public_x: "PUBLIC_X".to_string(),
            port: 8000,
            allowed_origins: "http://localhost:3000".to_string(),
            environment: "development".to_string(),
            trusted_proxy: false,
            rate_limit_public_rpm: 60,
            account_lock_max_attempts: 5,
            account_lock_window_minutes: 15,
            cora_mode: CoraMode::Mock,
            cora_client_id: Some("client_id".to_string()),
            cora_cert_file: Some("/run/segredos/cert.pem".to_string()),
            cora_key_file: Some("/run/segredos/key.pem".to_string()),
            cora_base_url: None,
            email_mode: EmailMode::Simulado,
            app_public_url: "http://localhost:3000".to_string(),
            app_secrets_key: None,
            itau_mode: ItauMode::Mock,
            itau_sts_base_url: None,
        };

        let debug_repr = format!("{:?}", config);
        assert!(!debug_repr.contains("escolar_password"));
        assert!(!debug_repr.contains("BEGIN PRIVATE KEY"));
        assert!(!debug_repr.contains("client_id"));
        assert!(!debug_repr.contains("cert.pem"));
        assert!(!debug_repr.contains("key.pem"));
        assert!(debug_repr.contains("database_url: \"***\""));
        assert!(debug_repr.contains("jwt_private_pem: \"***\""));
    }

    #[test]
    fn test_email_mode_simulado_default() {
        assert_eq!(parse_email_mode(None, false).unwrap(), EmailMode::Simulado);
        assert_eq!(
            parse_email_mode(Some(""), false).unwrap(),
            EmailMode::Simulado
        );
        assert_eq!(
            parse_email_mode(Some("simulado"), false).unwrap(),
            EmailMode::Simulado
        );
        assert_eq!(
            parse_email_mode(Some("SIMULADO"), false).unwrap(),
            EmailMode::Simulado
        );
    }

    #[test]
    fn test_email_mode_invalido_dev_cai_para_simulado() {
        assert_eq!(
            parse_email_mode(Some("smtp"), false).unwrap(),
            EmailMode::Simulado
        );
    }

    #[test]
    fn test_email_mode_invalido_prod_erro() {
        let err = parse_email_mode(Some("smtp"), true).unwrap_err();
        assert!(err.contains("EMAIL_MODE='smtp'"));
    }

    #[test]
    fn test_app_secrets_key_ausente_ou_vazia_e_none() {
        assert!(parse_app_secrets_key(None).unwrap().is_none());
        assert!(parse_app_secrets_key(Some("")).unwrap().is_none());
        assert!(parse_app_secrets_key(Some("   ")).unwrap().is_none());
    }

    #[test]
    fn test_app_secrets_key_hex_valida_e_some() {
        let hex = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
        let chave = parse_app_secrets_key(Some(hex)).unwrap().expect("chave");
        assert_eq!(chave.bytes()[0], 0x00);
        assert_eq!(chave.bytes()[1], 0x11);
        assert_eq!(chave.bytes()[31], 0xff);
        assert_eq!(format!("{:?}", chave), "ChaveMestra(***)");
    }

    #[test]
    fn test_app_secrets_key_invalida_nao_mostra_valor() {
        let curta = "a".repeat(63);
        let err = parse_app_secrets_key(Some(&curta)).unwrap_err();
        assert!(err.contains("APP_SECRETS_KEY deve ter 64 caracteres hexadecimais"));
        assert!(!err.contains(&curta));

        let nao_hex = format!("{}g", "a".repeat(63));
        let err = parse_app_secrets_key(Some(&nao_hex)).unwrap_err();
        assert!(err.contains("APP_SECRETS_KEY deve ter 64 caracteres hexadecimais"));
        assert!(!err.contains(&nao_hex));
    }

    #[test]
    fn test_cora_configured_for() {
        let mut config = Config::default();
        assert!(config.cora_configured_for(CoraMode::Mock));
        assert!(!config.cora_configured_for(CoraMode::Sandbox));

        config.cora_base_url = Some("http://localhost:9999".to_string());
        assert!(config.cora_configured_for(CoraMode::Sandbox));

        config.cora_base_url = None;
        config.cora_client_id = Some("id".to_string());
        config.cora_cert_file = Some("/run/segredos/cert.pem".to_string());
        config.cora_key_file = Some("/run/segredos/key.pem".to_string());
        assert!(config.cora_configured_for(CoraMode::Production));
    }
}
