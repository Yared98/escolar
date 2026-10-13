use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::{DateTime, Datelike, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit},
        tenant::ActiveTenant,
    },
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DadosEscolaDocumento {
    pub nome: String,
    pub cnpj: Option<String>,
    pub endereco: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurmaDocumento {
    pub id: Uuid,
    pub nome: String,
    pub codigo: Option<String>,
    pub etapa_ensino: Option<String>,
    pub serie: Option<String>,
    pub turno: Option<String>,
    pub ano_letivo: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlunoDocumento {
    pub id: Uuid,
    pub nome: String,
    pub data_nascimento: NaiveDate,
    pub cpf: Option<String>,
    pub matricula: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrequenciaDocumento {
    pub total_aulas: i64,
    pub presencas: i64,
    pub percentual: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotaHistorico {
    pub disciplina: String,
    pub periodo: String,
    pub nota: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisciplinaHistorico {
    pub disciplina: String,
    pub notas: Vec<NotaHistorico>,
    pub media: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentoResponse {
    pub tipo: String,
    pub escola: DadosEscolaDocumento,
    pub aluno: AlunoDocumento,
    pub turma: Option<TurmaDocumento>,
    pub situacao_matricula: String,
    pub frequencia: Option<FrequenciaDocumento>,
    pub historico: Option<Vec<DisciplinaHistorico>>,
    pub emitido_em: DateTime<Utc>,
    pub codigo_verificacao: String,
}

#[derive(Debug, Deserialize)]
pub struct DocumentoQuery {
    pub tipo: String,
}

#[derive(Debug, Clone, FromRow)]
struct AlunoRow {
    id: Uuid,
    nome: String,
    cpf: String,
    data_nascimento: NaiveDate,
    status: String,
}

#[derive(Debug, Clone, FromRow)]
struct TurmaAlunoRow {
    turma_id: Uuid,
    turma_nome: String,
    turma_codigo: Option<String>,
    turma_etapa_ensino: Option<String>,
    turma_serie: Option<String>,
    turma_turno: Option<String>,
    turma_ano_letivo: i32,
}

#[derive(Debug, Clone, FromRow)]
pub(crate) struct NotaRow {
    disciplina_nome: String,
    periodo: String,
    nota: f64,
}

fn parse_tipo_documento(tipo: &str) -> Result<&str, AppError> {
    match tipo.trim().to_ascii_lowercase().as_str() {
        "declaracao_matricula" | "declaracao_frequencia" | "historico" => Ok(tipo.trim()),
        _ => Err(AppError::BadRequest(
            "Tipo de documento inválido. Use declaracao_matricula, declaracao_frequencia ou historico.".into(),
        )),
    }
}

pub fn calcular_codigo_verificacao(
    tenant_id: Uuid,
    aluno_id: Uuid,
    tipo: &str,
    emitido_em: DateTime<Utc>,
) -> String {
    let base = format!(
        "{}:{}:{}:{}",
        tenant_id,
        aluno_id,
        tipo,
        emitido_em.timestamp()
    );
    let hash = Sha256::digest(base.as_bytes());
    format!("{:x}", hash)[..16].to_string()
}

fn calcular_percentual_presenca(total: i64, presencas: i64) -> f64 {
    if total <= 0 {
        0.0
    } else {
        let pct = (presencas as f64 / total as f64) * 100.0;
        (pct * 10.0).round() / 10.0
    }
}

pub fn calcular_frequencia(total: i64, presencas: i64) -> FrequenciaDocumento {
    FrequenciaDocumento {
        total_aulas: total,
        presencas,
        percentual: calcular_percentual_presenca(total, presencas),
    }
}

pub(crate) fn agrupar_historico(notas: Vec<NotaRow>) -> Vec<DisciplinaHistorico> {
    use std::collections::BTreeMap;
    let mut por_disciplina: BTreeMap<String, Vec<NotaHistorico>> = BTreeMap::new();
    for n in notas {
        por_disciplina
            .entry(n.disciplina_nome.clone())
            .or_default()
            .push(NotaHistorico {
                disciplina: n.disciplina_nome,
                periodo: n.periodo,
                nota: n.nota,
            });
    }

    por_disciplina
        .into_iter()
        .map(|(disciplina, notas)| {
            let media = if notas.is_empty() {
                0.0
            } else {
                let soma: f64 = notas.iter().map(|n| n.nota).sum();
                (soma / notas.len() as f64 * 10.0).round() / 10.0
            };
            DisciplinaHistorico {
                disciplina,
                notas,
                media,
            }
        })
        .collect()
}

pub async fn emitir_documento(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Path(aluno_id): Path<Uuid>,
    Query(query): Query<DocumentoQuery>,
) -> Result<Json<DocumentoResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;

    let tipo = parse_tipo_documento(&query.tipo)?;
    let tenant_id = active_tenant.0;
    let emitido_em = Utc::now();

    // Dados da escola (tenant). A tabela tenants não possui RLS no schema atual;
    // usamos o tenant ativo e filtramos explicitamente pelo id.
    let escola: (String, Option<String>) =
        sqlx::query_as("SELECT name, cnpj FROM tenants WHERE id = $1")
            .bind(tenant_id)
            .fetch_one(&mut *db)
            .await?;

    // Dados do aluno (valida existência no tenant via RLS).
    let aluno: AlunoRow = sqlx::query_as(
        r#"
        SELECT id, nome, cpf, data_nascimento, status
        FROM alunos
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
        "#,
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Turma ativa mais recente do aluno.
    let turma: Option<TurmaAlunoRow> = sqlx::query_as(
        r#"
        SELECT
            t.id AS turma_id,
            t.nome AS turma_nome,
            t.codigo AS turma_codigo,
            t.etapa_ensino AS turma_etapa_ensino,
            t.serie AS turma_serie,
            t.turno AS turma_turno,
            t.ano_letivo AS turma_ano_letivo
        FROM turma_alunos ta
        JOIN turmas t ON t.id = ta.turma_id AND t.tenant_id = ta.tenant_id
        WHERE ta.aluno_id = $1
          AND ta.tenant_id = $2
          AND ta.status = 'ativo'
        ORDER BY t.ano_letivo DESC, t.nome ASC
        LIMIT 1
        "#,
    )
    .bind(aluno_id)
    .bind(tenant_id)
    .fetch_optional(&mut *db)
    .await?;

    let ano_letivo_referencia = turma
        .as_ref()
        .map(|t| t.turma_ano_letivo)
        .unwrap_or_else(|| {
            // Se não houver turma ativa, usa o ano calendário atual.
            emitido_em.year()
        });

    let frequencia = if tipo == "declaracao_frequencia" {
        // Total de aulas no ano letivo = registros de presença do aluno em diários daquele ano.
        let total: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint
            FROM presencas p
            JOIN diarios_classe dc ON dc.id = p.diario_id AND dc.tenant_id = p.tenant_id
            WHERE p.aluno_id = $1
              AND p.tenant_id = $2
              AND EXTRACT(YEAR FROM dc.data_aula)::int = $3
            "#,
        )
        .bind(aluno_id)
        .bind(tenant_id)
        .bind(ano_letivo_referencia)
        .fetch_one(&mut *db)
        .await?;

        let presencas: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint
            FROM presencas p
            JOIN diarios_classe dc ON dc.id = p.diario_id AND dc.tenant_id = p.tenant_id
            WHERE p.aluno_id = $1
              AND p.tenant_id = $2
              AND EXTRACT(YEAR FROM dc.data_aula)::int = $3
              AND p.presente = true
            "#,
        )
        .bind(aluno_id)
        .bind(tenant_id)
        .bind(ano_letivo_referencia)
        .fetch_one(&mut *db)
        .await?;

        Some(calcular_frequencia(total, presencas))
    } else {
        None
    };

    let historico = if tipo == "historico" {
        let notas: Vec<NotaRow> = sqlx::query_as(
            r#"
            SELECT disciplina_nome, periodo, nota
            FROM notas
            WHERE aluno_id = $1
              AND tenant_id = $2
            ORDER BY disciplina_nome ASC, periodo ASC
            "#,
        )
        .bind(aluno_id)
        .bind(tenant_id)
        .fetch_all(&mut *db)
        .await?;

        Some(agrupar_historico(notas))
    } else {
        None
    };

    let codigo_verificacao = calcular_codigo_verificacao(tenant_id, aluno_id, tipo, emitido_em);

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "DOCUMENTO_EMITIDO",
        "alunos",
        Some(aluno_id.to_string()),
        Some(serde_json::json!({
            "tipo": tipo,
            "aluno_id": aluno_id.to_string(),
            "codigo_verificacao": codigo_verificacao
        })),
    )
    .await;

    Ok(Json(DocumentoResponse {
        tipo: tipo.to_string(),
        escola: DadosEscolaDocumento {
            nome: escola.0,
            cnpj: escola.1,
            endereco: None,
        },
        aluno: AlunoDocumento {
            id: aluno.id,
            nome: aluno.nome,
            data_nascimento: aluno.data_nascimento,
            cpf: Some(aluno.cpf),
            matricula: None,
        },
        turma: turma.map(|t| TurmaDocumento {
            id: t.turma_id,
            nome: t.turma_nome,
            codigo: t.turma_codigo,
            etapa_ensino: t.turma_etapa_ensino,
            serie: t.turma_serie,
            turno: t.turma_turno,
            ano_letivo: t.turma_ano_letivo,
        }),
        situacao_matricula: aluno.status,
        frequencia,
        historico,
        emitido_em,
        codigo_verificacao,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use uuid::Uuid;

    #[test]
    fn test_codigo_verificacao_curto_16_hex() {
        let tenant_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let aluno_id = Uuid::parse_str("6ba7b810-9dad-11d1-80b4-00c04fd430c8").unwrap();
        let emitido_em = Utc.with_ymd_and_hms(2026, 10, 13, 14, 30, 0).unwrap();

        let codigo =
            calcular_codigo_verificacao(tenant_id, aluno_id, "declaracao_matricula", emitido_em);
        assert_eq!(codigo.len(), 16);
        assert!(codigo.chars().all(|c| c.is_ascii_hexdigit()));

        // Mesmos dados devem gerar mesmo código
        let codigo2 =
            calcular_codigo_verificacao(tenant_id, aluno_id, "declaracao_matricula", emitido_em);
        assert_eq!(codigo, codigo2);

        // Tipo diferente deve gerar código diferente
        let codigo3 = calcular_codigo_verificacao(tenant_id, aluno_id, "historico", emitido_em);
        assert_ne!(codigo, codigo3);
    }

    #[test]
    fn test_calcular_frequencia() {
        let f = calcular_frequencia(100, 90);
        assert_eq!(f.total_aulas, 100);
        assert_eq!(f.presencas, 90);
        assert_eq!(f.percentual, 90.0);

        let f_zero = calcular_frequencia(0, 0);
        assert_eq!(f_zero.percentual, 0.0);

        let f_arredondamento = calcular_frequencia(30, 29);
        assert_eq!(f_arredondamento.percentual, 96.7);
    }

    #[test]
    fn test_agrupar_historico_e_media() {
        let notas = vec![
            NotaRow {
                disciplina_nome: "Matemática".into(),
                periodo: "1_bimestre".into(),
                nota: 8.0,
            },
            NotaRow {
                disciplina_nome: "Matemática".into(),
                periodo: "2_bimestre".into(),
                nota: 9.0,
            },
            NotaRow {
                disciplina_nome: "Português".into(),
                periodo: "1_bimestre".into(),
                nota: 7.5,
            },
        ];

        let historico = agrupar_historico(notas);
        assert_eq!(historico.len(), 2);

        let mat = historico
            .iter()
            .find(|h| h.disciplina == "Matemática")
            .unwrap();
        assert_eq!(mat.notas.len(), 2);
        assert_eq!(mat.media, 8.5);

        let port = historico
            .iter()
            .find(|h| h.disciplina == "Português")
            .unwrap();
        assert_eq!(port.notas.len(), 1);
        assert_eq!(port.media, 7.5);
    }

    #[test]
    fn test_parse_tipo_documento() {
        assert!(parse_tipo_documento("declaracao_matricula").is_ok());
        assert!(parse_tipo_documento("DECLARACAO_FREQUENCIA").is_ok());
        assert!(parse_tipo_documento("Historico").is_ok());
        assert!(parse_tipo_documento("invalido").is_err());
    }
}
