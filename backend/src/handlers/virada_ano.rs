use axum::{
    extract::{Json, Query, State},
    Extension,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Acquire, Row};
use uuid::Uuid;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    handlers::academico::boletim::status_boletim,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit},
        tenant::ActiveTenant,
    },
};

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct PreviaViradaQuery {
    pub ano_origem: i32,
    pub ano_destino: i32,
}

#[derive(Debug, Serialize)]
pub struct PreviaViradaResponse {
    pub ano_origem: i32,
    pub ano_destino: i32,
    pub ja_executada: bool,
    pub turmas: Vec<PreviaTurmaDto>,
}

#[derive(Debug, Serialize)]
pub struct PreviaTurmaDto {
    pub turma_origem_id: Uuid,
    pub turma_origem_nome: String,
    pub etapa_ensino: String,
    pub serie: Option<String>,
    pub turno: String,
    pub sala_id: Option<Uuid>,
    pub capacidade_maxima: i32,
    pub sugestao_proxima_serie: Option<String>,
    pub sugestao_proxima_etapa: Option<String>,
    pub sugestao_nome_turma: Option<String>,
    pub turma_destino_existente_id: Option<Uuid>,
    pub total_alunos: usize,
    pub alunos: Vec<PreviaAlunoDto>,
}

#[derive(Debug, Serialize)]
pub struct PreviaAlunoDto {
    pub aluno_id: Uuid,
    pub nome: String,
    pub numero_chamada: Option<i32>,
    pub status_boletim: String,
    pub acao_sugerida: String, // 'promover' | 'reter' | 'decidir'
    pub media_geral: f64,
    pub frequencia_pct: f64,
}

#[derive(Debug, Deserialize)]
pub struct ExecutarViradaDto {
    pub ano_origem: i32,
    pub ano_destino: i32,
    #[serde(default)]
    pub copiar_professores: bool,
    #[serde(default)]
    pub gerar_contratos: bool,
    pub turmas: Vec<TurmaViradaInputDto>,
    pub alunos: Vec<AlunoViradaInputDto>,
}

#[derive(Debug, Deserialize)]
pub struct TurmaViradaInputDto {
    pub turma_origem_id: Uuid,
    pub nova_turma: Option<NovaTurmaInputDto>,
    pub turma_destino_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct NovaTurmaInputDto {
    pub id: Option<Uuid>,
    pub nome: String,
    pub serie: Option<String>,
    pub etapa_ensino: Option<String>,
    pub turno: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AlunoViradaInputDto {
    pub aluno_id: Uuid,
    pub acao: String, // 'promover' | 'reter' | 'nao_rematricular'
    pub turma_destino_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ExecutarViradaResponse {
    pub sucesso: bool,
    pub mensagem: String,
    pub ano_origem: i32,
    pub ano_destino: i32,
    pub turmas_criadas: usize,
    pub alunos_promovidos: usize,
    pub alunos_retidos: usize,
    pub alunos_nao_rematriculados: usize,
    pub contratos_gerados: usize,
}

// ============================================================================
// FUNÇÕES PURAS (COM TESTES UNITÁRIOS)
// ============================================================================

/// Sugere a próxima série e etapa de ensino a partir da etapa e série atuais.
/// Se não for possível inferir, retorna None.
pub fn sugerir_proxima_serie(etapa_ensino: &str, serie: &str) -> Option<(String, String)> {
    let s = serie.trim().to_lowercase();
    let etapa = etapa_ensino.trim().to_lowercase();

    // 1. Educação Infantil
    if etapa.contains("infantil")
        || s.contains("infantil")
        || s.contains("maternal")
        || s.contains("berçário")
        || s.contains("bercario")
    {
        if s.contains("berçário i") || s.contains("bercario 1") || s.contains("bercario i") {
            return Some(("Berçário II".to_string(), "educacao_infantil".to_string()));
        }
        if s.contains("berçário ii") || s.contains("bercario 2") || s.contains("bercario ii") {
            return Some(("Maternal I".to_string(), "educacao_infantil".to_string()));
        }
        if s.contains("maternal i") || s.contains("maternal 1") {
            return Some(("Maternal II".to_string(), "educacao_infantil".to_string()));
        }
        if s.contains("maternal ii") || s.contains("maternal 2") {
            return Some(("Infantil 4".to_string(), "educacao_infantil".to_string()));
        }
        if s.contains("infantil 1") {
            return Some(("Infantil 2".to_string(), "educacao_infantil".to_string()));
        }
        if s.contains("infantil 2") {
            return Some(("Infantil 3".to_string(), "educacao_infantil".to_string()));
        }
        if s.contains("infantil 3") {
            return Some(("Infantil 4".to_string(), "educacao_infantil".to_string()));
        }
        if s.contains("infantil 4")
            || s.contains("pré i")
            || s.contains("pre 1")
            || s.contains("pre i")
        {
            return Some(("Infantil 5".to_string(), "educacao_infantil".to_string()));
        }
        if s.contains("infantil 5")
            || s.contains("pré ii")
            || s.contains("pre 2")
            || s.contains("pre ii")
        {
            return Some(("1º Ano".to_string(), "fundamental_1".to_string()));
        }
    }

    // 2. Fundamental 1 (1º ao 5º Ano)
    if etapa == "fundamental_1" || s.contains("fundamental 1") {
        if s.contains('1') {
            return Some(("2º Ano".to_string(), "fundamental_1".to_string()));
        }
        if s.contains('2') {
            return Some(("3º Ano".to_string(), "fundamental_1".to_string()));
        }
        if s.contains('3') {
            return Some(("4º Ano".to_string(), "fundamental_1".to_string()));
        }
        if s.contains('4') {
            return Some(("5º Ano".to_string(), "fundamental_1".to_string()));
        }
        if s.contains('5') {
            return Some(("6º Ano".to_string(), "fundamental_2".to_string()));
        }
    }

    // 3. Fundamental 2 (6º ao 9º Ano)
    if etapa == "fundamental_2" || s.contains("fundamental 2") {
        if s.contains('6') {
            return Some(("7º Ano".to_string(), "fundamental_2".to_string()));
        }
        if s.contains('7') {
            return Some(("8º Ano".to_string(), "fundamental_2".to_string()));
        }
        if s.contains('8') {
            return Some(("9º Ano".to_string(), "fundamental_2".to_string()));
        }
        if s.contains('9') {
            return Some(("1ª Série".to_string(), "medio".to_string()));
        }
    }

    // 4. Ensino Médio (1ª à 3ª Série)
    if etapa == "medio" || etapa == "ensino_medio" || s.contains("médio") || s.contains("medio") {
        if s.contains('1') {
            return Some(("2ª Série".to_string(), "medio".to_string()));
        }
        if s.contains('2') {
            return Some(("3ª Série".to_string(), "medio".to_string()));
        }
        if s.contains('3') {
            // Formando / concluinte
            return None;
        }
    }

    // 5. Fallback por número extraído no texto caso a etapa não seja estrita
    let digit = s
        .chars()
        .find(|c| c.is_ascii_digit())
        .and_then(|c| c.to_digit(10));
    if let Some(d) = digit {
        match d {
            1 if etapa == "fundamental_1" => {
                Some(("2º Ano".to_string(), "fundamental_1".to_string()))
            }
            2 if etapa == "fundamental_1" => {
                Some(("3º Ano".to_string(), "fundamental_1".to_string()))
            }
            3 if etapa == "fundamental_1" => {
                Some(("4º Ano".to_string(), "fundamental_1".to_string()))
            }
            4 if etapa == "fundamental_1" => {
                Some(("5º Ano".to_string(), "fundamental_1".to_string()))
            }
            5 if etapa == "fundamental_1" => {
                Some(("6º Ano".to_string(), "fundamental_2".to_string()))
            }
            6 if etapa == "fundamental_2" => {
                Some(("7º Ano".to_string(), "fundamental_2".to_string()))
            }
            7 if etapa == "fundamental_2" => {
                Some(("8º Ano".to_string(), "fundamental_2".to_string()))
            }
            8 if etapa == "fundamental_2" => {
                Some(("9º Ano".to_string(), "fundamental_2".to_string()))
            }
            9 if etapa == "fundamental_2" => Some(("1ª Série".to_string(), "medio".to_string())),
            1 if etapa == "medio" || etapa == "ensino_medio" => {
                Some(("2ª Série".to_string(), "medio".to_string()))
            }
            2 if etapa == "medio" || etapa == "ensino_medio" => {
                Some(("3ª Série".to_string(), "medio".to_string()))
            }
            3 if etapa == "medio" || etapa == "ensino_medio" => None,
            _ => None,
        }
    } else {
        None
    }
}

/// Sugere o nome da nova turma mantendo a letra/identificador (ex: "1º Ano A" -> "2º Ano A").
pub fn sugerir_nome_turma(
    turma_origem_nome: &str,
    serie_origem: Option<&str>,
    proxima_serie: &str,
) -> String {
    if let Some(serie) = serie_origem {
        if !serie.is_empty() && turma_origem_nome.contains(serie) {
            return turma_origem_nome.replace(serie, proxima_serie);
        }
    }

    // Se o nome terminar com uma letra (ex: "A", "B", "Turma A")
    let partes: Vec<&str> = turma_origem_nome.split_whitespace().collect();
    if let Some(last) = partes.last() {
        if last.len() == 1 && last.chars().next().is_some_and(|c| c.is_ascii_alphabetic()) {
            return format!("{} {}", proxima_serie, last.to_ascii_uppercase());
        }
    }

    format!("{} - {}", proxima_serie, turma_origem_nome)
}

/// Sugere a decisão de rematrícula para o aluno baseado na situação do boletim:
/// - Aprovado -> "promover"
/// - Reprovado -> "reter"
/// - Em Recuperação / Em andamento / Sem notas -> "decidir"
pub fn sugerir_decisao_aluno(status_boletim_str: &str) -> &'static str {
    let s = status_boletim_str.trim().to_lowercase();
    if s == "aprovado" {
        "promover"
    } else if s == "reprovado" {
        "reter"
    } else {
        "decidir"
    }
}

/// Calcula a situação do boletim, média geral e frequência para um aluno.
pub fn calcular_boletim_aluno(
    notas: &[(String, String, f64)], // (disciplina_nome, periodo, nota)
    presencas: (i64, i64),           // (presentes, total)
) -> (String, f64, f64) {
    let freq_geral = if presencas.1 > 0 {
        ((presencas.0 as f64 / presencas.1 as f64) * 1000.0).round() / 10.0
    } else {
        100.0
    };

    let sem_notas = notas.is_empty();

    type BimestresNotas = (Option<f64>, Option<f64>, Option<f64>, Option<f64>);
    let mut disciplinas_map: std::collections::BTreeMap<String, BimestresNotas> =
        std::collections::BTreeMap::new();

    for (disc, periodo, nota) in notas {
        let entry = disciplinas_map
            .entry(disc.clone())
            .or_insert((None, None, None, None));
        match periodo.as_str() {
            "1_bimestre" => entry.0 = Some(*nota),
            "2_bimestre" => entry.1 = Some(*nota),
            "3_bimestre" => entry.2 = Some(*nota),
            "4_bimestre" => entry.3 = Some(*nota),
            _ => {
                if entry.0.is_none() {
                    entry.0 = Some(*nota);
                } else if entry.1.is_none() {
                    entry.1 = Some(*nota);
                } else if entry.2.is_none() {
                    entry.2 = Some(*nota);
                } else {
                    entry.3 = Some(*nota);
                }
            }
        }
    }

    let mut soma_medias = 0.0;
    let mut disc_count = 0;
    let mut all_four = true;

    for (n1, n2, n3, n4) in disciplinas_map.values() {
        let mut count = 0;
        let mut sum = 0.0;
        if let Some(v) = n1 {
            sum += v;
            count += 1;
        }
        if let Some(v) = n2 {
            sum += v;
            count += 1;
        }
        if let Some(v) = n3 {
            sum += v;
            count += 1;
        }
        if let Some(v) = n4 {
            sum += v;
            count += 1;
        }

        if n1.is_none() || n2.is_none() || n3.is_none() || n4.is_none() {
            all_four = false;
        }

        let media = if count > 0 { sum / count as f64 } else { 0.0 };
        soma_medias += media;
        disc_count += 1;
    }

    let media_geral = if disc_count > 0 {
        ((soma_medias / disc_count as f64) * 100.0).round() / 100.0
    } else {
        0.0
    };

    let ano_completo = !disciplinas_map.is_empty() && all_four;
    let status = status_boletim(sem_notas, ano_completo, media_geral, freq_geral);

    (status, media_geral, freq_geral)
}

// ============================================================================
// HANDLERS
// ============================================================================

/// GET /api/v1/secretaria/virada-ano/previa?ano_origem=2026&ano_destino=2027
/// Retorna a prévia com turmas ativas do ano de origem, turmas sugeridas para o novo ano
/// e a situação do boletim com sugestão de decisão para cada aluno.
pub async fn obter_previa_virada_ano(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Query(query): Query<PreviaViradaQuery>,
) -> Result<Json<PreviaViradaResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    if query.ano_destino <= query.ano_origem {
        return Err(AppError::BadRequest(
            "O ano de destino deve ser posterior ao ano de origem.".to_string(),
        ));
    }

    // Checar se já foi executada para esses anos
    let ja_executada = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM viradas_ano_letivo
            WHERE tenant_id = $1 AND ano_origem = $2 AND ano_destino = $3
        )
        "#,
    )
    .bind(tenant_id)
    .bind(query.ano_origem)
    .bind(query.ano_destino)
    .fetch_one(&mut *db)
    .await?;

    // Turmas ativas do ano de origem
    let turmas_origem_rows = sqlx::query(
        r#"
        SELECT id, nome, etapa_ensino, serie, turno, sala_id, capacidade_maxima
        FROM turmas
        WHERE tenant_id = $1 AND ano_letivo = $2 AND status = 'ativo'
        ORDER BY nome ASC
        "#,
    )
    .bind(tenant_id)
    .bind(query.ano_origem)
    .fetch_all(&mut *db)
    .await?;

    // Turmas existentes no ano de destino (caso já existam turmas criadas)
    let turmas_destino_rows = sqlx::query(
        r#"
        SELECT id, nome, serie, etapa_ensino
        FROM turmas
        WHERE tenant_id = $1 AND ano_letivo = $2 AND status = 'ativo'
        "#,
    )
    .bind(tenant_id)
    .bind(query.ano_destino)
    .fetch_all(&mut *db)
    .await?;

    struct DestinoExistente {
        id: Uuid,
        nome: String,
        serie: Option<String>,
    }

    let turmas_destino_existentes: Vec<DestinoExistente> = turmas_destino_rows
        .into_iter()
        .map(|r| DestinoExistente {
            id: r.get("id"),
            nome: r.get("nome"),
            serie: r.get("serie"),
        })
        .collect();

    let mut previa_turmas = Vec::new();

    for t_row in turmas_origem_rows {
        let t_id: Uuid = t_row.get("id");
        let t_nome: String = t_row.get("nome");
        let t_etapa: String = t_row.get("etapa_ensino");
        let t_serie: Option<String> = t_row.get("serie");
        let t_turno: String = t_row.get("turno");
        let t_sala_id: Option<Uuid> = t_row.get("sala_id");
        let t_capacidade: i32 = t_row.get("capacidade_maxima");

        let (sugestao_serie, sugestao_etapa) = match t_serie.as_deref() {
            Some(s) => match sugerir_proxima_serie(&t_etapa, s) {
                Some((prox_s, prox_e)) => (Some(prox_s), Some(prox_e)),
                None => (None, None),
            },
            None => (None, None),
        };

        let sugestao_nome = sugestao_serie
            .as_ref()
            .map(|prox_s| sugerir_nome_turma(&t_nome, t_serie.as_deref(), prox_s));

        // Procurar se já existe turma correspondente no ano de destino
        let turma_destino_existente_id = turmas_destino_existentes
            .iter()
            .find(|td| {
                if let Some(ref sn) = sugestao_nome {
                    if td.nome.eq_ignore_ascii_case(sn) {
                        return true;
                    }
                }
                if let Some(ref ss) = sugestao_serie {
                    if td.serie.as_deref().unwrap_or("").eq_ignore_ascii_case(ss) {
                        return true;
                    }
                }
                false
            })
            .map(|td| td.id);

        // Alunos ativos da turma
        let alunos_turma_rows = sqlx::query(
            r#"
            SELECT ta.aluno_id, a.nome, ta.numero_chamada
            FROM turma_alunos ta
            JOIN alunos a ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
            WHERE ta.tenant_id = $1 AND ta.turma_id = $2 AND ta.status = 'ativo' AND a.status = 'ativo'
            ORDER BY COALESCE(ta.numero_chamada, 9999) ASC, a.nome ASC
            "#,
        )
        .bind(tenant_id)
        .bind(t_id)
        .fetch_all(&mut *db)
        .await?;

        let mut previa_alunos = Vec::new();

        for al_row in alunos_turma_rows {
            let aluno_id: Uuid = al_row.get("aluno_id");
            let aluno_nome: String = al_row.get("nome");
            let numero_chamada: Option<i32> = al_row.get("numero_chamada");

            // Notas do aluno
            let notas = sqlx::query_as::<_, (String, String, f64)>(
                r#"
                SELECT disciplina_nome, periodo, nota
                FROM notas
                WHERE tenant_id = $1 AND aluno_id = $2
                "#,
            )
            .bind(tenant_id)
            .bind(aluno_id)
            .fetch_all(&mut *db)
            .await?;

            // Presenças do aluno
            let presenca_row = sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
                r#"
                SELECT
                    COUNT(*) FILTER (WHERE presente = true) AS presentes,
                    COUNT(*) AS total
                FROM presencas
                WHERE tenant_id = $1 AND aluno_id = $2
                "#,
            )
            .bind(tenant_id)
            .bind(aluno_id)
            .fetch_one(&mut *db)
            .await?;

            let presentes = presenca_row.0.unwrap_or(0);
            let total = presenca_row.1.unwrap_or(0);

            let (status, media, freq) = calcular_boletim_aluno(&notas, (presentes, total));
            let acao = sugerir_decisao_aluno(&status);

            previa_alunos.push(PreviaAlunoDto {
                aluno_id,
                nome: aluno_nome,
                numero_chamada,
                status_boletim: status,
                acao_sugerida: acao.to_string(),
                media_geral: media,
                frequencia_pct: freq,
            });
        }

        let total_alunos = previa_alunos.len();

        previa_turmas.push(PreviaTurmaDto {
            turma_origem_id: t_id,
            turma_origem_nome: t_nome,
            etapa_ensino: t_etapa,
            serie: t_serie,
            turno: t_turno,
            sala_id: t_sala_id,
            capacidade_maxima: t_capacidade,
            sugestao_proxima_serie: sugestao_serie,
            sugestao_proxima_etapa: sugestao_etapa,
            sugestao_nome_turma: sugestao_nome,
            turma_destino_existente_id,
            total_alunos,
            alunos: previa_alunos,
        });
    }

    Ok(Json(PreviaViradaResponse {
        ano_origem: query.ano_origem,
        ano_destino: query.ano_destino,
        ja_executada,
        turmas: previa_turmas,
    }))
}

/// POST /api/v1/secretaria/virada-ano/executar
/// Executa a virada de ano letivo e rematrícula em transação atômica idempotente.
pub async fn executar_virada_ano(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<ExecutarViradaDto>,
) -> Result<Json<ExecutarViradaResponse>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    if dto.ano_destino <= dto.ano_origem {
        return Err(AppError::BadRequest(
            "O ano de destino deve ser posterior ao ano de origem.".to_string(),
        ));
    }

    let mut tx = (&mut *db).begin().await?;

    // Idempotência: verificar se virada já foi executada para esses anos
    let ja_executada = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM viradas_ano_letivo
            WHERE tenant_id = $1 AND ano_origem = $2 AND ano_destino = $3
        )
        "#,
    )
    .bind(tenant_id)
    .bind(dto.ano_origem)
    .bind(dto.ano_destino)
    .fetch_one(&mut *tx)
    .await?;

    if ja_executada {
        return Err(AppError::Conflict(format!(
            "A virada do ano letivo de {} para {} já foi executada para esta instituição.",
            dto.ano_origem, dto.ano_destino
        )));
    }

    let mut map_origem_para_destino: std::collections::HashMap<Uuid, Uuid> =
        std::collections::HashMap::new();
    let mut turmas_criadas_count = 0;

    // 1. Processar Turmas
    for turma_item in &dto.turmas {
        let origem_row = sqlx::query(
            r#"
            SELECT id, sala_id, codigo, nome, etapa_ensino, serie, turno, capacidade_maxima, professor_regente_id
            FROM turmas
            WHERE id = $1 AND tenant_id = $2
            "#,
        )
        .bind(turma_item.turma_origem_id)
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await?;

        let origem = match origem_row {
            Some(o) => o,
            None => {
                return Err(AppError::BadRequest(format!(
                    "Turma de origem {} não encontrada.",
                    turma_item.turma_origem_id
                )));
            }
        };

        let origem_sala_id: Option<Uuid> = origem.get("sala_id");
        let origem_codigo: Option<String> = origem.get("codigo");
        let origem_etapa: String = origem.get("etapa_ensino");
        let origem_serie: Option<String> = origem.get("serie");
        let origem_turno: String = origem.get("turno");
        let origem_capacidade: i32 = origem.get("capacidade_maxima");
        let origem_regente_id: Option<Uuid> = origem.get("professor_regente_id");

        let destino_turma_id: Uuid;

        if let Some(ref nova) = turma_item.nova_turma {
            let new_id = nova.id.unwrap_or_else(Uuid::new_v4);
            let etapa = nova.etapa_ensino.clone().unwrap_or(origem_etapa);
            let serie = nova.serie.clone().or(origem_serie);
            let turno = nova.turno.clone().unwrap_or(origem_turno);
            let regente_id = if dto.copiar_professores {
                origem_regente_id
            } else {
                None
            };

            sqlx::query(
                r#"
                INSERT INTO turmas (
                    id, tenant_id, sala_id, codigo, nome, etapa_ensino,
                    serie, turno, ano_letivo, capacidade_maxima,
                    professor_regente_id, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ativo')
                "#,
            )
            .bind(new_id)
            .bind(tenant_id)
            .bind(origem_sala_id)
            .bind(origem_codigo)
            .bind(&nova.nome)
            .bind(etapa)
            .bind(serie)
            .bind(turno)
            .bind(dto.ano_destino)
            .bind(origem_capacidade)
            .bind(regente_id)
            .execute(&mut *tx)
            .await?;

            destino_turma_id = new_id;
            turmas_criadas_count += 1;
        } else if let Some(dest_id) = turma_item.turma_destino_id {
            let existe = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM turmas WHERE id = $1 AND tenant_id = $2)",
            )
            .bind(dest_id)
            .bind(tenant_id)
            .fetch_one(&mut *tx)
            .await?;

            if !existe {
                return Err(AppError::BadRequest(format!(
                    "Turma de destino {} não encontrada.",
                    dest_id
                )));
            }
            destino_turma_id = dest_id;
        } else {
            return Err(AppError::BadRequest(format!(
                "Turma de destino ou dados para criação de nova turma não informados para turma {}.",
                turma_item.turma_origem_id
            )));
        }

        map_origem_para_destino.insert(turma_item.turma_origem_id, destino_turma_id);

        // Copiar Matriz de Disciplinas da turma de origem
        sqlx::query(
            r#"
            INSERT INTO turma_disciplinas (tenant_id, turma_id, disciplina_id, carga_horaria_semanal, carga_horaria_anual)
            SELECT tenant_id, $2, disciplina_id, carga_horaria_semanal, carga_horaria_anual
            FROM turma_disciplinas
            WHERE tenant_id = $1 AND turma_id = $3
            ON CONFLICT (tenant_id, turma_id, disciplina_id) DO NOTHING
            "#,
        )
        .bind(tenant_id)
        .bind(destino_turma_id)
        .bind(turma_item.turma_origem_id)
        .execute(&mut *tx)
        .await?;

        // Se solicitado, copiar atribuições docentes
        if dto.copiar_professores {
            sqlx::query(
                r#"
                INSERT INTO turma_professores (tenant_id, turma_id, disciplina_id, professor_id, ano_letivo)
                SELECT tenant_id, $2, disciplina_id, professor_id, $4
                FROM turma_professores
                WHERE tenant_id = $1 AND turma_id = $3
                ON CONFLICT (tenant_id, turma_id, disciplina_id, professor_id) DO NOTHING
                "#,
            )
            .bind(tenant_id)
            .bind(destino_turma_id)
            .bind(turma_item.turma_origem_id)
            .bind(dto.ano_destino)
            .execute(&mut *tx)
            .await?;
        }
    }

    // 2. Processar Alunos
    let mut alunos_promovidos = 0;
    let mut alunos_retidos = 0;
    let mut alunos_nao_rematriculados = 0;
    let mut contratos_gerados = 0;

    for aluno_item in &dto.alunos {
        let aluno_id = aluno_item.aluno_id;

        // Buscar a turma ativa do aluno no ano de origem
        let turma_origem_aluno = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT ta.turma_id
            FROM turma_alunos ta
            JOIN turmas t ON t.id = ta.turma_id AND t.tenant_id = ta.tenant_id
            WHERE ta.tenant_id = $1 AND ta.aluno_id = $2 AND t.ano_letivo = $3 AND ta.status = 'ativo'
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(aluno_id)
        .bind(dto.ano_origem)
        .fetch_optional(&mut *tx)
        .await?;

        // Encerrar enturmação antiga (sem apagar, apenas atualiza status para 'concluido')
        sqlx::query(
            r#"
            UPDATE turma_alunos
            SET status = 'concluido'
            WHERE tenant_id = $1 AND aluno_id = $2 AND turma_id IN (
                SELECT id FROM turmas WHERE tenant_id = $1 AND ano_letivo = $3
            ) AND status = 'ativo'
            "#,
        )
        .bind(tenant_id)
        .bind(aluno_id)
        .bind(dto.ano_origem)
        .execute(&mut *tx)
        .await?;

        match aluno_item.acao.as_str() {
            "promover" | "reter" => {
                let dest_id = if let Some(target) = aluno_item.turma_destino_id {
                    target
                } else if let Some(origem_id) = turma_origem_aluno {
                    match map_origem_para_destino.get(&origem_id) {
                        Some(&id) => id,
                        None => {
                            return Err(AppError::BadRequest(format!(
                                "Nenhuma turma de destino mapeada para o aluno {}.",
                                aluno_id
                            )));
                        }
                    }
                } else {
                    return Err(AppError::BadRequest(format!(
                        "Turma de destino não informada para o aluno {}.",
                        aluno_id
                    )));
                };

                // Enturmar aluno na nova turma
                sqlx::query(
                    r#"
                    INSERT INTO turma_alunos (tenant_id, turma_id, aluno_id, data_matricula, status)
                    VALUES ($1, $2, $3, CURRENT_DATE, 'ativo')
                    ON CONFLICT (turma_id, aluno_id) DO UPDATE SET status = 'ativo'
                    "#,
                )
                .bind(tenant_id)
                .bind(dest_id)
                .bind(aluno_id)
                .execute(&mut *tx)
                .await?;

                // Se solicitado, gerar contrato para o novo ano
                if dto.gerar_contratos {
                    let contrato_anterior = sqlx::query_scalar::<_, f64>(
                        r#"
                        SELECT valor_total
                        FROM contratos
                        WHERE tenant_id = $1 AND aluno_id = $2
                        ORDER BY ano_letivo DESC, created_at DESC
                        LIMIT 1
                        "#,
                    )
                    .bind(tenant_id)
                    .bind(aluno_id)
                    .fetch_optional(&mut *tx)
                    .await?;

                    if let Some(valor) = contrato_anterior {
                        let contrato_ja_existe = sqlx::query_scalar::<_, bool>(
                            r#"
                            SELECT EXISTS(
                                SELECT 1 FROM contratos
                                WHERE tenant_id = $1 AND aluno_id = $2 AND ano_letivo = $3
                            )
                            "#,
                        )
                        .bind(tenant_id)
                        .bind(aluno_id)
                        .bind(dto.ano_destino)
                        .fetch_one(&mut *tx)
                        .await?;

                        if !contrato_ja_existe {
                            sqlx::query(
                                r#"
                                INSERT INTO contratos (tenant_id, aluno_id, ano_letivo, valor_total, status)
                                VALUES ($1, $2, $3, $4, 'pendente_assinatura')
                                "#,
                            )
                            .bind(tenant_id)
                            .bind(aluno_id)
                            .bind(dto.ano_destino)
                            .bind(valor)
                            .execute(&mut *tx)
                            .await?;

                            contratos_gerados += 1;
                        }
                    }
                }

                if aluno_item.acao == "promover" {
                    alunos_promovidos += 1;
                } else {
                    alunos_retidos += 1;
                }
            }
            "nao_rematricular" => {
                alunos_nao_rematriculados += 1;
            }
            outra => {
                return Err(AppError::BadRequest(format!(
                    "Ação '{}' inválida. Use 'promover', 'reter' ou 'nao_rematricular'.",
                    outra
                )));
            }
        }
    }

    // Registrar histórico da virada para garantir idempotência e rastreabilidade
    let detalhes = json!({
        "copiar_professores": dto.copiar_professores,
        "gerar_contratos": dto.gerar_contratos,
        "total_turmas_processadas": dto.turmas.len(),
        "turmas_criadas": turmas_criadas_count,
        "total_alunos_processados": dto.alunos.len(),
        "alunos_promovidos": alunos_promovidos,
        "alunos_retidos": alunos_retidos,
        "alunos_nao_rematriculados": alunos_nao_rematriculados,
        "contratos_gerados": contratos_gerados
    });

    sqlx::query(
        r#"
        INSERT INTO viradas_ano_letivo (tenant_id, ano_origem, ano_destino, executado_por, detalhes)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(tenant_id)
    .bind(dto.ano_origem)
    .bind(dto.ano_destino)
    .bind(auth_user.id)
    .bind(detalhes.clone())
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "VIRADA_ANO_LETIVO",
        "viradas_ano_letivo",
        None,
        Some(detalhes),
    )
    .await;

    Ok(Json(ExecutarViradaResponse {
        sucesso: true,
        mensagem: format!(
            "Virada do ano letivo de {} para {} executada com sucesso.",
            dto.ano_origem, dto.ano_destino
        ),
        ano_origem: dto.ano_origem,
        ano_destino: dto.ano_destino,
        turmas_criadas: turmas_criadas_count,
        alunos_promovidos,
        alunos_retidos,
        alunos_nao_rematriculados,
        contratos_gerados,
    }))
}

// ============================================================================
// TESTES UNITÁRIOS DE FUNÇÕES PURAS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sugerir_proxima_serie_fundamental_1() {
        assert_eq!(
            sugerir_proxima_serie("fundamental_1", "1º Ano"),
            Some(("2º Ano".to_string(), "fundamental_1".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("fundamental_1", "2º Ano"),
            Some(("3º Ano".to_string(), "fundamental_1".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("fundamental_1", "3º Ano"),
            Some(("4º Ano".to_string(), "fundamental_1".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("fundamental_1", "4º Ano"),
            Some(("5º Ano".to_string(), "fundamental_1".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("fundamental_1", "5º Ano"),
            Some(("6º Ano".to_string(), "fundamental_2".to_string()))
        );
    }

    #[test]
    fn test_sugerir_proxima_serie_fundamental_2() {
        assert_eq!(
            sugerir_proxima_serie("fundamental_2", "6º Ano"),
            Some(("7º Ano".to_string(), "fundamental_2".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("fundamental_2", "7º Ano"),
            Some(("8º Ano".to_string(), "fundamental_2".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("fundamental_2", "8º Ano"),
            Some(("9º Ano".to_string(), "fundamental_2".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("fundamental_2", "9º Ano"),
            Some(("1ª Série".to_string(), "medio".to_string()))
        );
    }

    #[test]
    fn test_sugerir_proxima_serie_medio() {
        assert_eq!(
            sugerir_proxima_serie("medio", "1ª Série"),
            Some(("2ª Série".to_string(), "medio".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("medio", "2ª Série"),
            Some(("3ª Série".to_string(), "medio".to_string()))
        );
        // 3ª série é concluinte / formando
        assert_eq!(sugerir_proxima_serie("medio", "3ª Série"), None);
    }

    #[test]
    fn test_sugerir_proxima_serie_infantil() {
        assert_eq!(
            sugerir_proxima_serie("educacao_infantil", "Infantil 4"),
            Some(("Infantil 5".to_string(), "educacao_infantil".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("educacao_infantil", "Infantil 5"),
            Some(("1º Ano".to_string(), "fundamental_1".to_string()))
        );
        assert_eq!(
            sugerir_proxima_serie("educacao_infantil", "Maternal I"),
            Some(("Maternal II".to_string(), "educacao_infantil".to_string()))
        );
    }

    #[test]
    fn test_sugerir_proxima_serie_invalida() {
        assert_eq!(sugerir_proxima_serie("curso_livre", "Sem Padrão"), None);
    }

    #[test]
    fn test_sugerir_nome_turma() {
        assert_eq!(
            sugerir_nome_turma("1º Ano A", Some("1º Ano"), "2º Ano"),
            "2º Ano A"
        );
        assert_eq!(
            sugerir_nome_turma("5º Ano B", Some("5º Ano"), "6º Ano"),
            "6º Ano B"
        );
        assert_eq!(sugerir_nome_turma("Turma A", None, "2º Ano"), "2º Ano A");
    }

    #[test]
    fn test_sugerir_decisao_aluno() {
        assert_eq!(sugerir_decisao_aluno("Aprovado"), "promover");
        assert_eq!(sugerir_decisao_aluno("Reprovado"), "reter");
        assert_eq!(sugerir_decisao_aluno("Em Recuperação"), "decidir");
        assert_eq!(sugerir_decisao_aluno("Em andamento"), "decidir");
        assert_eq!(
            sugerir_decisao_aluno("Em andamento (precisa de atenção)"),
            "decidir"
        );
        assert_eq!(sugerir_decisao_aluno("Sem notas lançadas"), "decidir");
    }

    #[test]
    fn test_calcular_boletim_aluno_aprovado() {
        let notas = vec![
            ("Matemática".to_string(), "1_bimestre".to_string(), 8.0),
            ("Matemática".to_string(), "2_bimestre".to_string(), 8.0),
            ("Matemática".to_string(), "3_bimestre".to_string(), 9.0),
            ("Matemática".to_string(), "4_bimestre".to_string(), 9.0),
        ];
        let presencas = (95, 100);
        let (status, media, freq) = calcular_boletim_aluno(&notas, presencas);
        assert_eq!(status, "Aprovado");
        assert_eq!(media, 8.5);
        assert_eq!(freq, 95.0);
        assert_eq!(sugerir_decisao_aluno(&status), "promover");
    }

    #[test]
    fn test_calcular_boletim_aluno_reprovado() {
        let notas = vec![
            ("Matemática".to_string(), "1_bimestre".to_string(), 3.0),
            ("Matemática".to_string(), "2_bimestre".to_string(), 4.0),
            ("Matemática".to_string(), "3_bimestre".to_string(), 3.0),
            ("Matemática".to_string(), "4_bimestre".to_string(), 4.0),
        ];
        let presencas = (90, 100);
        let (status, media, _freq) = calcular_boletim_aluno(&notas, presencas);
        assert_eq!(status, "Reprovado");
        assert_eq!(media, 3.5);
        assert_eq!(sugerir_decisao_aluno(&status), "reter");
    }

    #[test]
    fn test_calcular_boletim_aluno_incompleto() {
        let notas = vec![
            ("Matemática".to_string(), "1_bimestre".to_string(), 9.0),
            ("Matemática".to_string(), "2_bimestre".to_string(), 9.0),
        ];
        let presencas = (100, 100);
        let (status, media, freq) = calcular_boletim_aluno(&notas, presencas);
        assert_eq!(status, "Em andamento");
        assert_eq!(media, 9.0);
        assert_eq!(freq, 100.0);
        assert_eq!(sugerir_decisao_aluno(&status), "decidir");
    }
}
