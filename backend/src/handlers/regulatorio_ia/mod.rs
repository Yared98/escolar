use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Extension, Json,
};
use serde_json::json;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_aluno_ownership, check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::regulatorio_ia::{
        CadastrarCredencialPerimetralDto, DetalhesEvasao, DiplomaDigital, EducacensoExportResponse,
        EmitirDiplomaDto, EmitirDiplomaResponse, LgpdTermo, PerimetroCredencial,
        PredizerEvasaoResponse, RegistrarConsentimentoLgpdDto, ValidarAcessoPerimetralDto,
        ValidarAcessoPerimetralResponse, ValidarDiplomaResponse,
    },
};

// ==========================================
// 1. REGULATÓRIO & CENSO ESCOLAR (EDUCACENSO / INEP)

mod censo;
mod diploma;
mod evasao;
mod lgpd;
mod perimetro;

pub use censo::*;
pub use diploma::*;
pub use evasao::*;
pub use lgpd::*;
pub use perimetro::*;
