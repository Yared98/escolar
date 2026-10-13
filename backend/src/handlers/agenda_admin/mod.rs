pub(crate) use axum::{
    extract::{Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
    Extension, Json,
};
pub(crate) use chrono::NaiveDate;
pub(crate) use futures_util::stream::{Stream, StreamExt};
pub(crate) use serde::Serialize;
pub(crate) use serde_json::{json, Value};
pub(crate) use sqlx::Row;
pub(crate) use std::{convert::Infallible, time::Duration};
pub(crate) use tokio_stream::wrappers::BroadcastStream;
pub(crate) use uuid::Uuid;

pub(crate) use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_aluno_ownership, check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::agenda_admin::{
        AuditLog, CreateFornecedorDto, CreateFuncionarioDto, CreateMensagemAgendaDto,
        CreateOcorrenciaDto, CreateRotinaDiariaDto, DiarioInfantilQuery, Fornecedor, Funcionario,
        MensagemAgenda, MensagemAgendaView, OcorrenciaAluno, RotinaDiariaInfantil,
        UpdateFornecedorDto, UpdateFuncionarioDto,
    },
};

pub mod administrativo;
pub mod calendario;
pub mod contatos;
pub mod mensagens;
pub mod ocorrencias;
pub mod rotina;
pub mod stream;

pub use administrativo::*;
pub use calendario::*;
pub use contatos::*;
pub use mensagens::*;
pub use ocorrencias::*;
pub use rotina::*;
pub use stream::*;
