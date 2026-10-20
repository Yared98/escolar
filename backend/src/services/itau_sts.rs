use aes::Aes256;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use cbc::cipher::{block_padding::Pkcs7, BlockDecryptMut, BlockEncryptMut, KeyIvInit};
use chrono::{DateTime, Utc};
use rsa::pkcs1v15::SigningKey;
use rsa::pkcs8::{DecodePrivateKey, EncodePrivateKey, EncodePublicKey, LineEnding};
use rsa::rand_core::OsRng;
use rsa::{RsaPrivateKey, RsaPublicKey};
use sha2::Sha512;
use x509_cert::builder::{Builder, RequestBuilder};
use x509_cert::der::pem::LineEnding as DerLineEnding;
use x509_cert::der::{DecodePem, EncodePem};
use x509_cert::name::Name;
use x509_cert::Certificate;

use crate::error::AppError;

type Aes256CbcDec = cbc::Decryptor<Aes256>;
type Aes256CbcEnc = cbc::Encryptor<Aes256>;

pub fn mascarar_client_id(client_id: &str) -> String {
    let s = client_id.trim();
    if s.len() >= 8 {
        format!("{}…{}", &s[..4], &s[s.len() - 4..])
    } else if s.len() >= 4 {
        format!("{}…{}", &s[..2], &s[s.len() - 2..])
    } else {
        "***".to_string()
    }
}

pub fn sanitizar_dn_ou(nome: &str) -> String {
    let s = nome
        .trim()
        .replace([',', ';', '+', '='], " ")
        .replace(['"', '\\'], "");
    let s = s.trim();
    if s.is_empty() {
        "Escola".to_string()
    } else {
        s.to_string()
    }
}

pub fn gerar_par_rsa_2048() -> Result<(String, String), AppError> {
    let mut rng = OsRng;
    let private_key = RsaPrivateKey::new(&mut rng, 2048).map_err(|e| {
        AppError::InternalServerError(format!("Falha ao gerar chave RSA 2048: {e}"))
    })?;
    let private_pem = private_key
        .to_pkcs8_pem(LineEnding::LF)
        .map_err(|e| {
            AppError::InternalServerError(format!("Falha ao codificar chave privada: {e}"))
        })?
        .to_string();
    let public_key = RsaPublicKey::from(&private_key);
    let public_pem = public_key.to_public_key_pem(LineEnding::LF).map_err(|e| {
        AppError::InternalServerError(format!("Falha ao codificar chave pública: {e}"))
    })?;
    Ok((private_pem, public_pem))
}

pub fn decodificar_base64_flexivel(input: &str) -> Result<Vec<u8>, AppError> {
    let limpo: String = input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '\r' && *c != '\n')
        .collect();
    if let Ok(b) = STANDARD.decode(&limpo) {
        return Ok(b);
    }
    if let Ok(b) = URL_SAFE_NO_PAD.decode(&limpo) {
        return Ok(b);
    }
    Err(AppError::BadRequest(
        "Valor informado não é um Base64 válido".into(),
    ))
}

pub fn decifrar_chave_sessao_rsa(
    transporte_privada_pem: &str,
    chave_sessao_cifrada_b64: &str,
) -> Result<Vec<u8>, AppError> {
    let raw_bytes = decodificar_base64_flexivel(chave_sessao_cifrada_b64)?;
    let private_key = RsaPrivateKey::from_pkcs8_pem(transporte_privada_pem)
        .map_err(|e| AppError::BadRequest(format!("Chave de transporte privada inválida: {e}")))?;
    let session_key = private_key
        .decrypt(rsa::Pkcs1v15Encrypt, &raw_bytes)
        .map_err(|e| {
            AppError::BadRequest(format!(
                "Falha ao decifrar chave de sessão com RSA PKCS#1 v1.5: {e}"
            ))
        })?;
    if session_key.len() != 32 {
        return Err(AppError::BadRequest(
            "Chave de sessão decifrada possui tamanho incompatível com AES-256 (esperado 32 bytes)"
                .into(),
        ));
    }
    Ok(session_key)
}

pub fn decifrar_aes_256_cbc(
    key: &[u8],
    iv: &[u8; 16],
    ciphertext: &[u8],
) -> Result<Vec<u8>, AppError> {
    if key.len() != 32 {
        return Err(AppError::BadRequest(
            "Tamanho inválido para chave AES-256".into(),
        ));
    }
    let mut buf = ciphertext.to_vec();
    let decryptor = Aes256CbcDec::new_from_slices(key, iv)
        .map_err(|e| AppError::BadRequest(format!("Falha ao inicializar decifrador AES: {e}")))?;
    let pt = decryptor
        .decrypt_padded_mut::<Pkcs7>(&mut buf)
        .map_err(|e| {
            AppError::BadRequest(format!(
                "Falha ao decifrar dados AES-256-CBC (padding inválido): {e}"
            ))
        })?;
    Ok(pt.to_vec())
}

pub fn cifrar_aes_256_cbc(
    key: &[u8],
    iv: &[u8; 16],
    plaintext: &[u8],
) -> Result<Vec<u8>, AppError> {
    let encryptor = Aes256CbcEnc::new_from_slices(key, iv)
        .map_err(|e| AppError::BadRequest(format!("Falha ao inicializar cifrador AES: {e}")))?;
    let pt_len = plaintext.len();
    let mut buf = vec![0u8; pt_len + 16];
    buf[..pt_len].copy_from_slice(plaintext);
    let ct = encryptor
        .encrypt_padded_b2b_mut::<Pkcs7>(plaintext, &mut buf)
        .map_err(|e| AppError::BadRequest(format!("Falha ao cifrar dados AES-256-CBC: {e}")))?;
    Ok(ct.to_vec())
}

pub fn decifrar_texto_aes_256_cbc_iv_zero(
    session_key: &[u8],
    cifrado_b64: &str,
    campo: &str,
) -> Result<String, AppError> {
    let raw = decodificar_base64_flexivel(cifrado_b64)?;
    let iv = [0u8; 16];
    let dec = decifrar_aes_256_cbc(session_key, &iv, &raw)
        .map_err(|e| AppError::BadRequest(format!("Falha ao decifrar {campo}: {e}")))?;
    String::from_utf8(dec)
        .map(|s| s.trim().to_string())
        .map_err(|_| AppError::BadRequest(format!("{campo} decifrado não é um texto UTF-8 válido")))
}

pub fn gerar_chave_e_csr_sha512(
    client_id: &str,
    organizacao: &str,
) -> Result<(RsaPrivateKey, String, String), AppError> {
    let mut rng = OsRng;
    let cert_privada = RsaPrivateKey::new(&mut rng, 2048).map_err(|e| {
        AppError::InternalServerError(format!("Falha ao gerar chave RSA do certificado: {e}"))
    })?;
    let cert_privada_pem = cert_privada
        .to_pkcs8_pem(LineEnding::LF)
        .map_err(|e| {
            AppError::InternalServerError(format!(
                "Falha ao codificar chave privada do certificado: {e}"
            ))
        })?
        .to_string();

    let clean_ou = sanitizar_dn_ou(organizacao);
    let dn = format!(
        "CN={},OU={},L=SAO PAULO,ST=SP,C=BR",
        client_id.trim(),
        clean_ou
    );
    let name: Name = dn
        .parse()
        .map_err(|e| AppError::BadRequest(format!("Falha ao compor subject do CSR: {e}")))?;

    let signing_key = SigningKey::<Sha512>::new(cert_privada.clone());
    let builder = RequestBuilder::new(name, &signing_key)
        .map_err(|e| AppError::InternalServerError(format!("Falha ao construir CSR: {e}")))?;
    let cert_req = builder
        .build::<rsa::pkcs1v15::Signature>()
        .map_err(|e| AppError::InternalServerError(format!("Falha ao assinar CSR: {e}")))?;
    let csr_pem = cert_req.to_pem(DerLineEnding::LF).map_err(|e| {
        AppError::InternalServerError(format!("Falha ao serializar CSR em PEM: {e}"))
    })?;

    Ok((cert_privada, cert_privada_pem, csr_pem))
}

pub fn parse_certificado_validade(cert_pem: &str) -> Result<DateTime<Utc>, AppError> {
    let cert = Certificate::from_pem(cert_pem)
        .map_err(|e| AppError::BadRequest(format!("Certificado PEM inválido: {e}")))?;
    let not_after = cert.tbs_certificate.validity.not_after;
    let unix_secs = not_after.to_unix_duration().as_secs() as i64;
    DateTime::from_timestamp(unix_secs, 0).ok_or_else(|| {
        AppError::InternalServerError("Timestamp de validade do certificado inválido".into())
    })
}

pub fn pode_renovar_certificado(valido_ate: Option<DateTime<Utc>>) -> bool {
    if let Some(dt) = valido_ate {
        (dt - Utc::now()).num_days() <= 30
    } else {
        false
    }
}

pub fn extrair_certificado_e_secret(body: &str) -> Result<(String, String), String> {
    let body_trimmed = body.trim();
    if let Ok(serde_json::Value::Object(map)) =
        serde_json::from_str::<serde_json::Value>(body_trimmed)
    {
        let mut cert = None;
        let mut secret = None;

        for (k, v) in map {
            let k_lower = k.to_lowercase();
            if let serde_json::Value::String(s) = v {
                if (k_lower.contains("cert") || k_lower.contains("certificado")) && cert.is_none() {
                    cert = Some(s);
                } else if (k_lower.contains("secret") || k_lower.contains("segredo"))
                    && secret.is_none()
                {
                    secret = Some(s);
                }
            }
        }

        if let (Some(c), Some(s)) = (cert, secret) {
            let formatted_cert = if c.contains("-----BEGIN CERTIFICATE-----") {
                c
            } else {
                format!(
                    "-----BEGIN CERTIFICATE-----\n{}\n-----END CERTIFICATE-----\n",
                    c.trim()
                )
            };
            return Ok((formatted_cert, s));
        }
    }

    if let (Some(start), Some(end_tag)) = (
        body_trimmed.find("-----BEGIN CERTIFICATE-----"),
        body_trimmed.find("-----END CERTIFICATE-----"),
    ) {
        let cert_part = &body_trimmed[start..end_tag + "-----END CERTIFICATE-----".len()];
        let rest = format!(
            "{}{}",
            &body_trimmed[..start],
            &body_trimmed[end_tag + "-----END CERTIFICATE-----".len()..]
        );

        for line in rest.lines() {
            let line_clean = line.trim();
            if let Some((k, v)) = line_clean.split_once(':') {
                if k.trim().to_lowercase().contains("secret") {
                    let sec = v.trim().trim_matches('"').trim();
                    if !sec.is_empty() {
                        return Ok((cert_part.to_string(), sec.to_string()));
                    }
                }
            } else if let Some((k, v)) = line_clean.split_once('=') {
                if k.trim().to_lowercase().contains("secret") {
                    let sec = v.trim().trim_matches('"').trim();
                    if !sec.is_empty() {
                        return Ok((cert_part.to_string(), sec.to_string()));
                    }
                }
            }
        }
    }

    Err("resposta inesperada do Itaú: certificado ou client_secret ausente".into())
}

pub async fn solicitar_certificado_sts(
    sts_base_url: &str,
    token_temporario: &str,
    csr_pem: &str,
) -> Result<(String, String), Result<(String, String), (axum::http::StatusCode, String)>> {
    let url = format!(
        "{}/seguranca/v1/certificado/solicitacao",
        sts_base_url.trim_end_matches('/')
    );
    let client = reqwest::Client::builder().build().map_err(|e| {
        Err((
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("Falha ao criar cliente HTTP: {e}"),
        ))
    })?;

    let resp = client
        .post(&url)
        .header("Content-Type", "text/plain")
        .header("Authorization", format!("Bearer {token_temporario}"))
        .body(csr_pem.to_string())
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "falha de conexão ao solicitar certificado no STS do Itaú");
            Err((
                axum::http::StatusCode::BAD_GATEWAY,
                format!("Falha ao conectar com o STS do Itaú: {e}"),
            ))
        })?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        tracing::error!(status = %status, "STS do Itaú recusou solicitação de certificado");
        if status.as_u16() == 403 {
            return Err(Err((
                axum::http::StatusCode::BAD_GATEWAY,
                "Acesso negado pelo Itaú (token temporário expirado ou inválido)".into(),
            )));
        }
        return Err(Err((
            axum::http::StatusCode::BAD_GATEWAY,
            format!("STS do Itaú retornou erro (status {}): {}", status, text),
        )));
    }

    extrair_certificado_e_secret(&text)
        .map_err(|err_msg| Err((axum::http::StatusCode::BAD_GATEWAY, err_msg)))
}

pub async fn testar_conexao_oauth(
    sts_base_url: &str,
    is_sandbox: bool,
    client_id: &str,
    client_secret: &str,
    cert_pem: Option<&str>,
    cert_key_pem: Option<&str>,
) -> Result<(), (axum::http::StatusCode, String)> {
    let mut builder = reqwest::Client::builder();

    let url = if is_sandbox {
        if sts_base_url.starts_with("http://127.0.0.1")
            || sts_base_url.starts_with("http://localhost")
        {
            format!("{}/api/oauth/token", sts_base_url.trim_end_matches('/'))
        } else {
            "https://sts.rdhi.com.br/api/oauth/token".to_string()
        }
    } else {
        let cert = cert_pem.ok_or_else(|| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                "Certificado digital ausente para ambiente de produção".into(),
            )
        })?;
        let key = cert_key_pem.ok_or_else(|| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                "Chave privada do certificado ausente para ambiente de produção".into(),
            )
        })?;
        let identity_pem = format!("{}\n{}", cert.trim(), key.trim());
        let identity = reqwest::Identity::from_pem(identity_pem.as_bytes()).map_err(|e| {
            (
                axum::http::StatusCode::BAD_REQUEST,
                format!("Identidade mTLS inválida: {e}"),
            )
        })?;
        builder = builder.identity(identity);

        format!("{}/as/token.oauth2", sts_base_url.trim_end_matches('/'))
    };

    let client = builder.build().map_err(|e| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("Falha ao montar cliente HTTP: {e}"),
        )
    })?;

    let form = [
        ("grant_type", "client_credentials"),
        ("client_id", client_id),
        ("client_secret", client_secret),
    ];

    let resp = client.post(&url).form(&form).send().await.map_err(|e| {
        tracing::error!(error = %e, "falha de conexão ao testar token OAuth do Itaú");
        (
            axum::http::StatusCode::BAD_GATEWAY,
            format!("Não foi possível conectar ao STS do Itaú: {e}"),
        )
    })?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        tracing::error!(status = %status, "STS do Itaú recusou teste de conexão OAuth");
        return Err((
            axum::http::StatusCode::BAD_GATEWAY,
            format!("Falha ao autenticar no Itaú (status {}): {}", status, text),
        ));
    }

    Ok(())
}

pub async fn obter_token_oauth_producao(
    sts_base_url: &str,
    client_id: &str,
    client_secret: &str,
    cert_pem: &str,
    cert_key_pem: &str,
) -> Result<String, (axum::http::StatusCode, String)> {
    let identity_pem = format!("{}\n{}", cert_pem.trim(), cert_key_pem.trim());
    let identity = reqwest::Identity::from_pem(identity_pem.as_bytes()).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("Identidade mTLS inválida: {e}"),
        )
    })?;

    let client = reqwest::Client::builder()
        .identity(identity)
        .build()
        .map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("Falha ao montar cliente HTTP: {e}"),
            )
        })?;

    let url = format!("{}/as/token.oauth2", sts_base_url.trim_end_matches('/'));
    let form = [
        ("grant_type", "client_credentials"),
        ("client_id", client_id),
        ("client_secret", client_secret),
    ];

    let resp = client.post(&url).form(&form).send().await.map_err(|e| {
        tracing::error!(error = %e, "falha ao obter token OAuth do Itaú para renovação");
        (
            axum::http::StatusCode::BAD_GATEWAY,
            format!("Não foi possível conectar ao STS do Itaú: {e}"),
        )
    })?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err((
            axum::http::StatusCode::BAD_GATEWAY,
            format!(
                "Falha ao obter token de acesso no Itaú (status {}): {}",
                status, text
            ),
        ));
    }

    #[derive(serde::Deserialize)]
    struct TokenResponse {
        access_token: String,
    }

    let parsed = serde_json::from_str::<TokenResponse>(&text).map_err(|_| {
        (
            axum::http::StatusCode::BAD_GATEWAY,
            "Resposta de token do Itaú sem access_token válido".into(),
        )
    })?;

    Ok(parsed.access_token)
}

pub async fn renovar_certificado_sts(
    sts_base_url: &str,
    access_token: &str,
    novo_csr_pem: &str,
    cert_pem: &str,
    cert_key_pem: &str,
) -> Result<String, (axum::http::StatusCode, String)> {
    let identity_pem = format!("{}\n{}", cert_pem.trim(), cert_key_pem.trim());
    let identity = reqwest::Identity::from_pem(identity_pem.as_bytes()).map_err(|e| {
        (
            axum::http::StatusCode::BAD_REQUEST,
            format!("Identidade mTLS inválida: {e}"),
        )
    })?;

    let client = reqwest::Client::builder()
        .identity(identity)
        .build()
        .map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("Falha ao montar cliente HTTP: {e}"),
            )
        })?;

    let url = format!(
        "{}/seguranca/v1/certificado/renovacao",
        sts_base_url.trim_end_matches('/')
    );

    let resp = client
        .post(&url)
        .header("Content-Type", "text/plain")
        .header("Authorization", format!("Bearer {access_token}"))
        .body(novo_csr_pem.to_string())
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "falha ao conectar no endpoint de renovação do Itaú");
            (
                axum::http::StatusCode::BAD_GATEWAY,
                format!("Falha ao conectar no endpoint de renovação do Itaú: {e}"),
            )
        })?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        tracing::error!(status = %status, "STS do Itaú recusou renovação de certificado");
        return Err((
            axum::http::StatusCode::BAD_GATEWAY,
            format!(
                "STS do Itaú retornou erro na renovação (status {}): {}",
                status, text
            ),
        ));
    }

    if let (Some(start), Some(end_tag)) = (
        text.find("-----BEGIN CERTIFICATE-----"),
        text.find("-----END CERTIFICATE-----"),
    ) {
        let cert = text[start..end_tag + "-----END CERTIFICATE-----".len()].to_string();
        return Ok(cert);
    }

    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
        if let Some(obj) = val.as_object() {
            for (k, v) in obj {
                if k.to_lowercase().contains("cert") {
                    if let Some(s) = v.as_str() {
                        let formatted = if s.contains("-----BEGIN CERTIFICATE-----") {
                            s.to_string()
                        } else {
                            format!(
                                "-----BEGIN CERTIFICATE-----\n{}\n-----END CERTIFICATE-----\n",
                                s.trim()
                            )
                        };
                        return Ok(formatted);
                    }
                }
            }
        }
    }

    Err((
        axum::http::StatusCode::BAD_GATEWAY,
        "resposta inesperada do Itaú: novo certificado ausente na renovação".into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unitario_mascara_client_id() {
        assert_eq!(mascarar_client_id("abcdef123456"), "abcd…3456");
        assert_eq!(mascarar_client_id("abcd1234"), "abcd…1234");
        assert_eq!(mascarar_client_id("abcde"), "ab…de");
        assert_eq!(mascarar_client_id("123"), "***");
    }

    #[test]
    fn unitario_decifra_aes_256_cbc_iv_zero_contra_vetor() {
        let key = [0x42u8; 32];
        let iv = [0u8; 16];
        let original = b"client_id_super_secreto_itau_2026";
        let cifrado = cifrar_aes_256_cbc(&key, &iv, original).expect("cifrar deve funcionar");
        assert_ne!(&cifrado, original);

        let decifrado = decifrar_aes_256_cbc(&key, &iv, &cifrado).expect("decifrar deve funcionar");
        assert_eq!(&decifrado, original);
    }

    #[test]
    fn unitario_csr_contem_cn() {
        let client_id = "test-client-id-xyz-999";
        let org = "Escola Exemplo, Ltda;";
        let (_priv_key, _priv_pem, csr_pem) =
            gerar_chave_e_csr_sha512(client_id, org).expect("geracao de CSR deve funcionar");

        assert!(csr_pem.contains("-----BEGIN CERTIFICATE REQUEST-----"));
        assert!(csr_pem.contains("-----END CERTIFICATE REQUEST-----"));

        let req = x509_cert::request::CertReq::from_pem(&csr_pem).expect("CSR deve ser parseavel");
        let subject_text = req.info.subject.to_string();
        assert!(
            subject_text.contains(client_id),
            "Subject '{subject_text}' deve conter o client_id '{client_id}'"
        );
    }

    #[test]
    fn unitario_extrair_certificado_e_secret_json() {
        let json_body = r#"{
            "certificado": "-----BEGIN CERTIFICATE-----\nMIIB...==\n-----END CERTIFICATE-----",
            "client_secret": "secret-12345678-abcd"
        }"#;
        let (cert, secret) = extrair_certificado_e_secret(json_body).expect("deve extrair");
        assert!(cert.contains("-----BEGIN CERTIFICATE-----"));
        assert_eq!(secret, "secret-12345678-abcd");
    }

    #[test]
    fn unitario_extrair_certificado_e_secret_texto() {
        let text_body = "client_secret: sec-text-xyz-987\n-----BEGIN CERTIFICATE-----\nFAKE_CERT_DATA\n-----END CERTIFICATE-----";
        let (cert, secret) =
            extrair_certificado_e_secret(text_body).expect("deve extrair de texto");
        assert!(cert.contains("-----BEGIN CERTIFICATE-----"));
        assert_eq!(secret, "sec-text-xyz-987");
    }
}
