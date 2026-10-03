use std::env;

use ring::signature::{Ed25519KeyPair, KeyPair};

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

impl Config {
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

        let (jwt_private_pem, jwt_public_pem, jwt_public_x) = if let Ok(pem) =
            env::var("JWT_ED25519_PRIVATE_PEM")
        {
            if pem.trim().is_empty() {
                return Err("JWT_ED25519_PRIVATE_PEM está vazio.".to_string());
            }
            material_from_private_pem(&pem)?
        } else if is_production {
            return Err(
                "ERRO CRÍTICO: em produção, configure JWT_ED25519_PRIVATE_PEM com uma chave PKCS#8 Ed25519."
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

        Ok(Config {
            database_url,
            jwt_private_pem,
            jwt_public_pem,
            jwt_public_x,
            port,
            allowed_origins,
            environment,
        })
    }
}

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub config: Config,
    pub message_hub: crate::realtime::MessageHub,
}

#[cfg(test)]
mod tests {
    use super::*;

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
        };

        let debug_repr = format!("{:?}", config);
        assert!(!debug_repr.contains("escolar_password"));
        assert!(!debug_repr.contains("BEGIN PRIVATE KEY"));
        assert!(debug_repr.contains("database_url: \"***\""));
        assert!(debug_repr.contains("jwt_private_pem: \"***\""));
    }
}
