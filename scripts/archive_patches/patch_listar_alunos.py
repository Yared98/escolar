import os

with open('backend/src/handlers/secretaria.rs', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = """    let alunos = sqlx::query_as::<_, Aluno>(
        "SELECT * FROM alunos WHERE tenant_id = $1 ORDER BY nome ASC",
    )
    .bind(tenant_id)
    .fetch_all(&mut *db)
    .await?;"""

new_code = """    let alunos = if auth_user.role == "professor" {
        sqlx::query_as::<_, Aluno>(
            r#"
            SELECT DISTINCT a.* 
            FROM alunos a
            JOIN turma_alunos ta ON ta.aluno_id = a.id
            JOIN turma_professores tp ON tp.turma_id = ta.turma_id
            WHERE a.tenant_id = $1 AND tp.professor_id = $2
            ORDER BY a.nome ASC
            "#
        )
        .bind(tenant_id)
        .bind(auth_user.id)
        .fetch_all(&mut *db)
        .await?
    } else {
        sqlx::query_as::<_, Aluno>(
            "SELECT * FROM alunos WHERE tenant_id = $1 ORDER BY nome ASC",
        )
        .bind(tenant_id)
        .fetch_all(&mut *db)
        .await?
    };"""

content = content.replace(old_code, new_code)

with open('backend/src/handlers/secretaria.rs', 'w', encoding='utf-8') as f:
    f.write(content)
