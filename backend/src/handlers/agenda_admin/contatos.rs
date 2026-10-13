use super::{
    check_roles, ActiveTenant, AppError, AppState, AuthUser, Extension, Json, Row, Serialize,
    State, TenantDb, Uuid,
};

#[derive(Debug, Serialize)]
pub struct ContatoEscolaDto {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
}

/// Contatos da escola para iniciar conversa.
/// Responsável: gestão/diretoria, financeiro e professores das turmas dos filhos.
pub async fn listar_contatos_escola(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<ContatoEscolaDto>>, AppError> {
    check_roles(
        &auth_user,
        &[
            "admin",
            "gestor",
            "secretaria",
            "professor",
            "nutricionista",
            "financeiro",
            "responsavel",
        ],
    )?;
    let tenant_id = active_tenant.0;
    let is_responsavel = auth_user.role.eq_ignore_ascii_case("responsavel");

    let rows = if is_responsavel {
        sqlx::query(
            r#"
            SELECT u.id, u.name, u.email, u.role
            FROM users u
            WHERE u.tenant_id = $1
              AND u.id <> $2
              AND (
                lower(replace(u.role, ' ', '')) IN (
                  'admin', 'gestor', 'gestorescolar', 'secretaria', 'superadmin', 'financeiro'
                )
                OR (
                  lower(u.role) = 'professor'
                  AND u.id IN (
                    SELECT t.professor_regente_id
                    FROM turmas t
                    JOIN turma_alunos ta
                      ON ta.turma_id = t.id AND ta.tenant_id = t.tenant_id AND ta.status = 'ativo'
                    JOIN alunos a
                      ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                    LEFT JOIN responsaveis_alunos ra
                      ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                    WHERE t.tenant_id = $1
                      AND t.professor_regente_id IS NOT NULL
                      AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)

                    UNION

                    SELECT tp.professor_id
                    FROM turma_professores tp
                    JOIN turma_alunos ta
                      ON ta.turma_id = tp.turma_id AND ta.tenant_id = tp.tenant_id AND ta.status = 'ativo'
                    JOIN alunos a
                      ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                    LEFT JOIN responsaveis_alunos ra
                      ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                    WHERE tp.tenant_id = $1
                      AND (a.responsavel_user_id = $2 OR ra.responsavel_user_id = $2)
                  )
                )
              )
            ORDER BY
              CASE lower(replace(u.role, ' ', ''))
                WHEN 'professor' THEN 0
                WHEN 'secretaria' THEN 1
                WHEN 'gestor' THEN 2
                WHEN 'gestorescolar' THEN 2
                WHEN 'financeiro' THEN 3
                WHEN 'admin' THEN 4
                ELSE 5
              END,
              u.name ASC
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        sqlx::query(
            r#"
            SELECT id, name, email, role
            FROM users
            WHERE tenant_id = $1
              AND lower(replace(role, ' ', '')) IN (
                'professor', 'gestor', 'gestorescolar', 'secretaria', 'admin',
                'nutricionista', 'financeiro', 'superadmin'
              )
              AND id <> $2
            ORDER BY
              CASE lower(replace(role, ' ', ''))
                WHEN 'professor' THEN 0
                WHEN 'secretaria' THEN 1
                WHEN 'gestor' THEN 2
                WHEN 'gestorescolar' THEN 2
                WHEN 'financeiro' THEN 3
                WHEN 'admin' THEN 4
                ELSE 5
              END,
              name ASC
            "#,
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    };

    let contatos = rows
        .into_iter()
        .map(|r| ContatoEscolaDto {
            id: r.get("id"),
            name: r.get("name"),
            email: r.get("email"),
            role: r.get("role"),
        })
        .collect();
    Ok(Json(contatos))
}

pub(crate) async fn responsavel_pode_falar_com(
    db: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    responsavel_id: Uuid,
    destinatario_id: Uuid,
) -> Result<bool, AppError> {
    let ok = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
          SELECT 1 FROM users u
          WHERE u.tenant_id = $1
            AND u.id = $2
            AND (
              lower(replace(u.role, ' ', '')) IN (
                'admin', 'gestor', 'gestorescolar', 'secretaria', 'superadmin', 'financeiro'
              )
              OR (
                lower(u.role) = 'professor'
                AND u.id IN (
                  SELECT t.professor_regente_id
                  FROM turmas t
                  JOIN turma_alunos ta
                    ON ta.turma_id = t.id AND ta.tenant_id = t.tenant_id AND ta.status = 'ativo'
                  JOIN alunos a
                    ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                  LEFT JOIN responsaveis_alunos ra
                    ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                  WHERE t.tenant_id = $1
                    AND t.professor_regente_id IS NOT NULL
                    AND (a.responsavel_user_id = $3 OR ra.responsavel_user_id = $3)

                  UNION

                  SELECT tp.professor_id
                  FROM turma_professores tp
                  JOIN turma_alunos ta
                    ON ta.turma_id = tp.turma_id AND ta.tenant_id = tp.tenant_id AND ta.status = 'ativo'
                  JOIN alunos a
                    ON a.id = ta.aluno_id AND a.tenant_id = ta.tenant_id
                  LEFT JOIN responsaveis_alunos ra
                    ON ra.aluno_id = a.id AND ra.tenant_id = a.tenant_id
                  WHERE tp.tenant_id = $1
                    AND (a.responsavel_user_id = $3 OR ra.responsavel_user_id = $3)
                )
              )
            )
        )
        "#,
    )
    .bind(tenant_id)
    .bind(destinatario_id)
    .bind(responsavel_id)
    .fetch_one(&mut *db)
    .await?;
    Ok(ok)
}
