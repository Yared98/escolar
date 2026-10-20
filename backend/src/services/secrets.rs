use ring::aead::{Aad as AeadAad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
use ring::rand::{SecureRandom, SystemRandom};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::config::{ChaveMestra, Config};
use crate::error::AppError;

const VERSAO_CHAVE: i32 = 1;
const MSG_CIFRAGEM: &str = "segredo não pôde ser cifrado";
const MSG_LEITURA: &str = "segredo não pôde ser lido";
const MSG_CHAVE_AUSENTE: &str = "Chave de cifragem não configurada no servidor (APP_SECRETS_KEY).";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TipoSegredo {
    TransporteChave,
    Cert,
    CertChave,
    ClientId,
    ClientSecret,
    WebhookClientSecretHash,
}

impl TipoSegredo {
    pub fn as_str(&self) -> &'static str {
        match self {
            TipoSegredo::TransporteChave => "transporte_chave",
            TipoSegredo::Cert => "cert",
            TipoSegredo::CertChave => "cert_chave",
            TipoSegredo::ClientId => "client_id",
            TipoSegredo::ClientSecret => "client_secret",
            TipoSegredo::WebhookClientSecretHash => "webhook_client_secret_hash",
        }
    }
}

pub struct Aad<'a> {
    pub tenant_id: Uuid,
    pub gateway_name: &'a str,
    pub tipo: TipoSegredo,
}

impl Aad<'_> {
    fn bytes(&self) -> Vec<u8> {
        format!(
            "{}|{}|{}",
            self.tenant_id,
            self.gateway_name,
            self.tipo.as_str()
        )
        .into_bytes()
    }
}

pub struct Selado {
    pub ciphertext: Vec<u8>,
    pub nonce: [u8; 12],
    pub key_version: i32,
}

pub fn exigir_chave(config: &Config) -> Result<&ChaveMestra, AppError> {
    config
        .app_secrets_key
        .as_ref()
        .ok_or_else(|| AppError::ServiceUnavailable(MSG_CHAVE_AUSENTE.into()))
}

fn chave_aead(chave: &ChaveMestra) -> Result<LessSafeKey, AppError> {
    let chave_crua = UnboundKey::new(&AES_256_GCM, chave.bytes())
        .map_err(|_| AppError::InternalServerError(MSG_CIFRAGEM.into()))?;
    Ok(LessSafeKey::new(chave_crua))
}

fn leitura_falhou() -> AppError {
    AppError::InternalServerError(MSG_LEITURA.into())
}

pub fn cifrar(chave: &ChaveMestra, aad: &Aad, texto: &[u8]) -> Result<Selado, AppError> {
    let mut nonce = [0u8; 12];
    SystemRandom::new()
        .fill(&mut nonce)
        .map_err(|_| AppError::InternalServerError(MSG_CIFRAGEM.into()))?;
    let aad_bytes = aad.bytes();
    let mut ciphertext = texto.to_vec();
    chave_aead(chave)?
        .seal_in_place_append_tag(
            Nonce::assume_unique_for_key(nonce),
            AeadAad::from(aad_bytes.as_slice()),
            &mut ciphertext,
        )
        .map_err(|_| AppError::InternalServerError(MSG_CIFRAGEM.into()))?;
    Ok(Selado {
        ciphertext,
        nonce,
        key_version: VERSAO_CHAVE,
    })
}

pub fn decifrar(chave: &ChaveMestra, aad: &Aad, selado: &Selado) -> Result<Vec<u8>, AppError> {
    if selado.key_version != VERSAO_CHAVE {
        return Err(leitura_falhou());
    }
    let aad_bytes = aad.bytes();
    let mut buffer = selado.ciphertext.clone();
    let texto = chave_aead(chave)?
        .open_in_place(
            Nonce::assume_unique_for_key(selado.nonce),
            AeadAad::from(aad_bytes.as_slice()),
            &mut buffer,
        )
        .map_err(|_| leitura_falhou())?;
    Ok(texto.to_vec())
}

pub async fn salvar(
    conn: &mut PgConnection,
    chave: &ChaveMestra,
    tenant_id: Uuid,
    gateway: &str,
    tipo: TipoSegredo,
    texto: &[u8],
    created_by: Option<Uuid>,
) -> Result<(), AppError> {
    let selado = cifrar(
        chave,
        &Aad {
            tenant_id,
            gateway_name: gateway,
            tipo,
        },
        texto,
    )?;
    sqlx::query(
        r#"
        INSERT INTO tenant_gateway_secrets
            (tenant_id, gateway_name, tipo, ciphertext, nonce, key_version, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (tenant_id, gateway_name, tipo) DO UPDATE SET
            ciphertext = EXCLUDED.ciphertext,
            nonce = EXCLUDED.nonce,
            key_version = EXCLUDED.key_version,
            updated_at = NOW()
        "#,
    )
    .bind(tenant_id)
    .bind(gateway)
    .bind(tipo.as_str())
    .bind(selado.ciphertext)
    .bind(selado.nonce.to_vec())
    .bind(selado.key_version)
    .bind(created_by)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

pub async fn ler(
    conn: &mut PgConnection,
    chave: &ChaveMestra,
    tenant_id: Uuid,
    gateway: &str,
    tipo: TipoSegredo,
) -> Result<Option<Vec<u8>>, AppError> {
    let linha: Option<(Vec<u8>, Vec<u8>, i32)> = sqlx::query_as(
        "SELECT ciphertext, nonce, key_version FROM tenant_gateway_secrets WHERE tenant_id = $1 AND gateway_name = $2 AND tipo = $3",
    )
    .bind(tenant_id)
    .bind(gateway)
    .bind(tipo.as_str())
    .fetch_optional(&mut *conn)
    .await?;

    let Some((ciphertext, nonce, key_version)) = linha else {
        return Ok(None);
    };
    let nonce: [u8; 12] = nonce.try_into().map_err(|_| leitura_falhou())?;
    let selado = Selado {
        ciphertext,
        nonce,
        key_version,
    };
    decifrar(
        chave,
        &Aad {
            tenant_id,
            gateway_name: gateway,
            tipo,
        },
        &selado,
    )
    .map(Some)
}

pub async fn existe(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    gateway: &str,
    tipo: TipoSegredo,
) -> Result<bool, AppError> {
    let existe: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM tenant_gateway_secrets WHERE tenant_id = $1 AND gateway_name = $2 AND tipo = $3)",
    )
    .bind(tenant_id)
    .bind(gateway)
    .bind(tipo.as_str())
    .fetch_one(&mut *conn)
    .await?;
    Ok(existe)
}

pub async fn apagar(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    gateway: &str,
    tipo: TipoSegredo,
) -> Result<(), AppError> {
    sqlx::query(
        "DELETE FROM tenant_gateway_secrets WHERE tenant_id = $1 AND gateway_name = $2 AND tipo = $3",
    )
    .bind(tenant_id)
    .bind(gateway)
    .bind(tipo.as_str())
    .execute(&mut *conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const HEX_A: &str = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
    const HEX_B: &str = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";

    fn chave(hex: &str) -> ChaveMestra {
        ChaveMestra::from_hex(hex).expect("chave de teste")
    }

    fn aad(tenant_id: Uuid, tipo: TipoSegredo) -> Aad<'static> {
        Aad {
            tenant_id,
            gateway_name: "itau",
            tipo,
        }
    }

    #[test]
    fn cifra_e_decifra_devolve_o_original() {
        let tenant = Uuid::new_v4();
        let texto = b"-----BEGIN PRIVATE KEY-----segredo";
        let selado = cifrar(
            &chave(HEX_A),
            &aad(tenant, TipoSegredo::ClientSecret),
            texto,
        )
        .unwrap();
        assert_ne!(selado.ciphertext, texto.to_vec());
        let lido = decifrar(
            &chave(HEX_A),
            &aad(tenant, TipoSegredo::ClientSecret),
            &selado,
        )
        .unwrap();
        assert_eq!(lido, texto.to_vec());
    }

    #[test]
    fn chave_errada_falha() {
        let tenant = Uuid::new_v4();
        let selado = cifrar(&chave(HEX_A), &aad(tenant, TipoSegredo::Cert), b"cert").unwrap();
        assert!(decifrar(&chave(HEX_B), &aad(tenant, TipoSegredo::Cert), &selado).is_err());
    }

    #[test]
    fn ciphertext_adulterado_falha() {
        let tenant = Uuid::new_v4();
        let mut selado = cifrar(&chave(HEX_A), &aad(tenant, TipoSegredo::Cert), b"cert").unwrap();
        selado.ciphertext[0] ^= 0x01;
        assert!(decifrar(&chave(HEX_A), &aad(tenant, TipoSegredo::Cert), &selado).is_err());
    }

    #[test]
    fn aad_de_outro_tenant_ou_tipo_falha() {
        let tenant = Uuid::new_v4();
        let selado = cifrar(&chave(HEX_A), &aad(tenant, TipoSegredo::ClientId), b"id").unwrap();
        let outro_tenant = Uuid::new_v4();
        assert!(decifrar(
            &chave(HEX_A),
            &aad(outro_tenant, TipoSegredo::ClientId),
            &selado
        )
        .is_err());
        assert!(decifrar(
            &chave(HEX_A),
            &aad(tenant, TipoSegredo::ClientSecret),
            &selado
        )
        .is_err());
    }

    #[test]
    fn nonce_unico_a_cada_cifragem() {
        let tenant = Uuid::new_v4();
        let primeiro = cifrar(&chave(HEX_A), &aad(tenant, TipoSegredo::Cert), b"mesmo").unwrap();
        let segundo = cifrar(&chave(HEX_A), &aad(tenant, TipoSegredo::Cert), b"mesmo").unwrap();
        assert_ne!(primeiro.nonce, segundo.nonce);
        assert_ne!(primeiro.ciphertext, segundo.ciphertext);
    }

    #[test]
    fn versao_de_chave_desconhecida_falha() {
        let tenant = Uuid::new_v4();
        let mut selado = cifrar(&chave(HEX_A), &aad(tenant, TipoSegredo::Cert), b"cert").unwrap();
        selado.key_version = 99;
        assert!(decifrar(&chave(HEX_A), &aad(tenant, TipoSegredo::Cert), &selado).is_err());
    }

    #[test]
    fn exigir_chave_sem_configuracao_responde_503() {
        let config = Config::default();
        match exigir_chave(&config) {
            Err(AppError::ServiceUnavailable(msg)) => {
                assert!(msg.contains("APP_SECRETS_KEY"));
            }
            _ => panic!("esperado ServiceUnavailable"),
        }
    }
}
