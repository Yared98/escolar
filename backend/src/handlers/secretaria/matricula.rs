use axum::{
    extract::{Json, State},
    Extension,
};
use serde_json::json;
use sqlx::Acquire;

use crate::{
    config::AppState,
    db::TenantDb,
    error::AppError,
    middleware::{
        auth::AuthUser,
        rbac::{check_roles, log_audit},
        tenant::ActiveTenant,
    },
    models::secretaria::{Aluno, CreateAlunoDto, STATUS_ALUNO_VALIDOS},
};

pub(super) fn normalizar_status_aluno(status: &str) -> Result<String, AppError> {
    let normalized = status.trim().to_ascii_lowercase();
    if STATUS_ALUNO_VALIDOS.contains(&normalized.as_str()) {
        Ok(normalized)
    } else {
        Err(AppError::BadRequest(format!(
            "Status inválido '{}'. Valores aceitos: {}.",
            status,
            STATUS_ALUNO_VALIDOS.join(", ")
        )))
    }
}

pub fn limpar_cpf(cpf: &str) -> String {
    cpf.chars().filter(|c| c.is_ascii_digit()).collect()
}

pub fn validar_cpf_brasileiro(cpf: &str) -> bool {
    let digits: Vec<u32> = cpf.chars().filter_map(|c| c.to_digit(10)).collect();
    if digits.len() != 11 {
        return false;
    }
    // Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11)
    if digits.iter().all(|&d| d == digits[0]) {
        return false;
    }

    // Primeiro dígito verificador (Módulo 11 Receita Federal)
    let soma1: u32 = digits
        .iter()
        .take(9)
        .enumerate()
        .map(|(i, &d)| d * (10 - i as u32))
        .sum();
    let resto1 = soma1 % 11;
    let d1 = if resto1 < 2 { 0 } else { 11 - resto1 };
    if digits[9] != d1 {
        return false;
    }

    // Segundo dígito verificador (Módulo 11 Receita Federal)
    let soma2: u32 = digits
        .iter()
        .take(10)
        .enumerate()
        .map(|(i, &d)| d * (11 - i as u32))
        .sum();
    let resto2 = soma2 % 11;
    let d2 = if resto2 < 2 { 0 } else { 11 - resto2 };
    digits[10] == d2
}

pub fn validar_telefone_brasileiro(tel: &str) -> bool {
    let digits: String = tel.chars().filter(|c| c.is_ascii_digit()).collect();
    digits.len() >= 10 && digits.len() <= 11
}

pub fn espelhar_responsavel_financeiro(
    dto: &CreateAlunoDto,
) -> (String, Option<String>, String, String, String) {
    if dto.responsavel_financeiro_igual_legal {
        (
            dto.nome_responsavel.clone(),
            dto.cpf_responsavel_legal.clone(),
            dto.email_responsavel.clone(),
            dto.telefone_responsavel.clone(),
            dto.parentesco_responsavel_legal
                .clone()
                .unwrap_or_else(|| "Mãe/Pai/Tutor Legal".to_string()),
        )
    } else {
        let nome = dto
            .nome_responsavel_financeiro
            .clone()
            .unwrap_or_else(|| dto.nome_responsavel.clone());
        let email = dto
            .email_responsavel_financeiro
            .clone()
            .unwrap_or_else(|| dto.email_responsavel.clone());
        let tel = dto
            .telefone_responsavel_financeiro
            .clone()
            .unwrap_or_else(|| dto.telefone_responsavel.clone());
        let parentesco = dto
            .parentesco_responsavel_financeiro
            .clone()
            .unwrap_or_else(|| "Responsável Financeiro".to_string());
        (
            nome,
            dto.cpf_responsavel_financeiro.clone(),
            email,
            tel,
            parentesco,
        )
    }
}

pub fn validar_tipo_sanguineo(tipo: &str) -> bool {
    let t = tipo.trim().to_uppercase();
    matches!(
        t.as_str(),
        "A+" | "A-"
            | "B+"
            | "B-"
            | "AB+"
            | "AB-"
            | "O+"
            | "O-"
            | "NÃO INFORMADO"
            | "NAO INFORMADO"
            | ""
    )
}

pub async fn criar_matricula(
    State(_state): State<AppState>,
    TenantDb(mut db): TenantDb,
    Extension(active_tenant): Extension<ActiveTenant>,
    Extension(auth_user): Extension<AuthUser>,
    Json(dto): Json<CreateAlunoDto>,
) -> Result<Json<Aluno>, AppError> {
    check_roles(&auth_user, &["admin", "gestor", "secretaria"])?;
    let tenant_id = active_tenant.0;

    let cpf_limpo = limpar_cpf(&dto.cpf);
    if !validar_cpf_brasileiro(&cpf_limpo) {
        return Err(AppError::BadRequest(
            "CPF informado é inválido segundo as regras de validação da Receita Federal."
                .to_string(),
        ));
    }

    if !validar_telefone_brasileiro(&dto.telefone_responsavel) {
        return Err(AppError::BadRequest(
            "Telefone do responsável legal inválido. Deve conter DDD e 8 ou 9 dígitos.".to_string(),
        ));
    }

    if let Some(ref ts) = dto.tipo_sanguineo {
        if !validar_tipo_sanguineo(ts) {
            return Err(AppError::BadRequest(
                "Tipo sanguíneo informado é inválido. Valores aceitos: A+, A-, B+, B-, AB+, AB-, O+, O- ou Não informado.".to_string(),
            ));
        }
    }

    // Regra de Duplo Responsável: Se a flag for true (único pai/mesmo responsável), espelha os dados
    let (nome_fin, cpf_fin, email_fin, tel_fin, parentesco_fin) =
        espelhar_responsavel_financeiro(&dto);

    // Checar duplicidade de CPF no mesmo tenant para retornar HTTP 409 Conflict
    let cpf_duplicado = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM alunos WHERE tenant_id = $1 AND cpf = $2)",
    )
    .bind(tenant_id)
    .bind(&dto.cpf)
    .fetch_one(&mut *db)
    .await?;

    if cpf_duplicado {
        return Err(AppError::UserAlreadyExists);
    }

    let status_inicial = match dto.status.as_deref() {
        Some(s) => normalizar_status_aluno(s)?,
        None => "ativo".to_string(),
    };
    if status_inicial != "ativo" && status_inicial != "pre_matricula" {
        return Err(AppError::BadRequest(
            "Na criação, o status inicial deve ser 'ativo' ou 'pre_matricula'.".to_string(),
        ));
    }

    let mut tx = (&mut *db).begin().await?;

    let aluno = match sqlx::query_as::<_, Aluno>(
        r#"
        INSERT INTO alunos (
            tenant_id, nome, cpf, data_nascimento,
            nome_responsavel, cpf_responsavel_legal, email_responsavel, telefone_responsavel, parentesco_responsavel_legal,
            responsavel_financeiro_igual_legal, nome_responsavel_financeiro, cpf_responsavel_financeiro,
            email_responsavel_financeiro, telefone_responsavel_financeiro, parentesco_responsavel_financeiro,
            cep, logradouro, numero, complemento, bairro, cidade, estado,
            telefone_secundario, contato_emergencia_nome, contato_emergencia_telefone, contato_emergencia_parentesco,
            status, responsavel_user_id
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22,
            $23, $24, $25, $26,
            $27, $28
        )
        RETURNING *
        "#,
    )
    .bind(tenant_id)
    .bind(&dto.nome)
    .bind(&dto.cpf)
    .bind(dto.data_nascimento)
    .bind(&dto.nome_responsavel)
    .bind(&dto.cpf_responsavel_legal)
    .bind(&dto.email_responsavel)
    .bind(&dto.telefone_responsavel)
    .bind(&dto.parentesco_responsavel_legal)
    .bind(dto.responsavel_financeiro_igual_legal)
    .bind(&nome_fin)
    .bind(&cpf_fin)
    .bind(&email_fin)
    .bind(&tel_fin)
    .bind(&parentesco_fin)
    .bind(&dto.cep)
    .bind(&dto.logradouro)
    .bind(&dto.numero)
    .bind(&dto.complemento)
    .bind(&dto.bairro)
    .bind(&dto.cidade)
    .bind(&dto.estado)
    .bind(&dto.telefone_secundario)
    .bind(&dto.contato_emergencia_nome)
    .bind(&dto.contato_emergencia_telefone)
    .bind(&dto.contato_emergencia_parentesco)
    .bind(&status_inicial)
    .bind(dto.responsavel_user_id)
    .fetch_one(&mut *tx)
    .await {
        Ok(a) => a,
        Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => {
            return Err(AppError::UserAlreadyExists);
        }
        Err(e) => return Err(AppError::DatabaseError(e)),
    };

    // Inicialização do Prontuário Médico & Observações
    sqlx::query(
        r#"
        INSERT INTO prontuarios (
            tenant_id, aluno_id, tipo_sanguineo, alergias, restricoes_alimentares,
            medicamentos_continuos, cuidados_especiais, historico_observacoes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (tenant_id, aluno_id) DO UPDATE SET
            tipo_sanguineo = COALESCE(EXCLUDED.tipo_sanguineo, prontuarios.tipo_sanguineo),
            alergias = COALESCE(EXCLUDED.alergias, prontuarios.alergias),
            restricoes_alimentares = COALESCE(EXCLUDED.restricoes_alimentares, prontuarios.restricoes_alimentares),
            medicamentos_continuos = COALESCE(EXCLUDED.medicamentos_continuos, prontuarios.medicamentos_continuos),
            cuidados_especiais = COALESCE(EXCLUDED.cuidados_especiais, prontuarios.cuidados_especiais),
            historico_observacoes = COALESCE(EXCLUDED.historico_observacoes, prontuarios.historico_observacoes),
            updated_at = NOW()
        "#,
    )
    .bind(tenant_id)
    .bind(aluno.id)
    .bind(&dto.tipo_sanguineo)
    .bind(&dto.alergias)
    .bind(&dto.restricoes_alimentares)
    .bind(&dto.medicamentos_continuos)
    .bind(&dto.cuidados_especiais)
    .bind(&dto.historico_observacoes)
    .execute(&mut *tx)
    .await?;

    if let Some(resp_id) = dto.responsavel_user_id {
        sqlx::query(
            r#"
            INSERT INTO responsaveis_alunos (tenant_id, responsavel_user_id, aluno_id, parentesco)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (tenant_id, responsavel_user_id, aluno_id) DO NOTHING
            "#,
        )
        .bind(tenant_id)
        .bind(resp_id)
        .bind(aluno.id)
        .bind(
            dto.parentesco_responsavel_legal
                .unwrap_or_else(|| "Pai/Mãe/Responsável Legal".to_string()),
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    log_audit(
        &mut *db,
        tenant_id,
        Some(auth_user.id),
        "CRIAR_MATRICULA",
        "aluno",
        Some(aluno.id.to_string()),
        Some(json!({
            "nome": aluno.nome,
            "cpf": aluno.cpf,
            "responsavel_financeiro_igual_legal": aluno.responsavel_financeiro_igual_legal,
            "cidade": aluno.cidade
        })),
    )
    .await;

    Ok(Json(aluno))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validar_cpf_brasileiro_valido() {
        assert!(validar_cpf_brasileiro("52998224725"));
        assert!(validar_cpf_brasileiro("12345678909"));
        assert!(validar_cpf_brasileiro(&limpar_cpf("529.982.247-25")));
        assert!(validar_cpf_brasileiro(&limpar_cpf("123.456.789-09")));
    }

    #[test]
    fn test_validar_cpf_brasileiro_invalido() {
        // Dígitos verificadores incorretos
        assert!(!validar_cpf_brasileiro("52998224724"));
        // Todos os dígitos repetidos
        assert!(!validar_cpf_brasileiro("11111111111"));
        assert!(!validar_cpf_brasileiro("00000000000"));
        // Comprimento inválido
        assert!(!validar_cpf_brasileiro("1234567890"));
    }

    #[test]
    fn test_validar_telefone_brasileiro() {
        assert!(validar_telefone_brasileiro("(11) 98765-4321"));
        assert!(validar_telefone_brasileiro("11987654321"));
        assert!(validar_telefone_brasileiro("(11) 3456-7890")); // Fixo (10 dígitos)
        assert!(!validar_telefone_brasileiro("1234567")); // Muito curto
    }

    #[test]
    fn test_espelhar_responsavel_financeiro_quando_flag_true() {
        let dto = CreateAlunoDto {
            nome: "Aluno Teste".to_string(),
            cpf: "123.456.789-09".to_string(),
            data_nascimento: chrono::NaiveDate::from_ymd_opt(2015, 6, 1).unwrap(),
            nome_responsavel: "Mariana Souza".to_string(),
            cpf_responsavel_legal: Some("529.982.247-25".to_string()),
            email_responsavel: "mariana@email.com".to_string(),
            telefone_responsavel: "(11) 98765-4321".to_string(),
            parentesco_responsavel_legal: Some("Mãe".to_string()),
            responsavel_financeiro_igual_legal: true,
            nome_responsavel_financeiro: None,
            cpf_responsavel_financeiro: None,
            email_responsavel_financeiro: None,
            telefone_responsavel_financeiro: None,
            parentesco_responsavel_financeiro: None,
            cep: Some("01310-100".to_string()),
            logradouro: Some("Avenida Paulista".to_string()),
            numero: Some("1000".to_string()),
            complemento: None,
            bairro: Some("Bela Vista".to_string()),
            cidade: Some("São Paulo".to_string()),
            estado: Some("SP".to_string()),
            telefone_secundario: Some("(11) 3333-4444".to_string()),
            contato_emergencia_nome: Some("Vovó Clara".to_string()),
            contato_emergencia_telefone: Some("(11) 91111-2222".to_string()),
            contato_emergencia_parentesco: Some("Avó".to_string()),
            responsavel_user_id: None,
            status: None,
            tipo_sanguineo: Some("O+".to_string()),
            alergias: Some("Amendoim".to_string()),
            restricoes_alimentares: None,
            medicamentos_continuos: None,
            cuidados_especiais: None,
            historico_observacoes: None,
        };

        let (nome, cpf, email, tel, parentesco) = espelhar_responsavel_financeiro(&dto);
        assert_eq!(nome, "Mariana Souza");
        assert_eq!(cpf, Some("529.982.247-25".to_string()));
        assert_eq!(email, "mariana@email.com");
        assert_eq!(tel, "(11) 98765-4321");
        assert_eq!(parentesco, "Mãe");
    }

    #[test]
    fn test_espelhar_responsavel_financeiro_quando_flag_false_com_dados_distintos() {
        let dto = CreateAlunoDto {
            nome: "Aluno Teste 2".to_string(),
            cpf: "123.456.789-09".to_string(),
            data_nascimento: chrono::NaiveDate::from_ymd_opt(2015, 6, 1).unwrap(),
            nome_responsavel: "Mariana Souza".to_string(),
            cpf_responsavel_legal: Some("529.982.247-25".to_string()),
            email_responsavel: "mariana@email.com".to_string(),
            telefone_responsavel: "(11) 98765-4321".to_string(),
            parentesco_responsavel_legal: Some("Mãe".to_string()),
            responsavel_financeiro_igual_legal: false,
            nome_responsavel_financeiro: Some("Roberto Silva (Pai)".to_string()),
            cpf_responsavel_financeiro: Some("111.444.777-35".to_string()),
            email_responsavel_financeiro: Some("roberto.financeiro@email.com".to_string()),
            telefone_responsavel_financeiro: Some("(11) 99999-8888".to_string()),
            parentesco_responsavel_financeiro: Some("Pai / Resp. Financeiro".to_string()),
            cep: None,
            logradouro: None,
            numero: None,
            complemento: None,
            bairro: None,
            cidade: None,
            estado: None,
            telefone_secundario: None,
            contato_emergencia_nome: None,
            contato_emergencia_telefone: None,
            contato_emergencia_parentesco: None,
            responsavel_user_id: None,
            status: None,
            tipo_sanguineo: None,
            alergias: None,
            restricoes_alimentares: None,
            medicamentos_continuos: None,
            cuidados_especiais: None,
            historico_observacoes: None,
        };

        let (nome, cpf, email, tel, parentesco) = espelhar_responsavel_financeiro(&dto);
        assert_eq!(nome, "Roberto Silva (Pai)");
        assert_eq!(cpf, Some("111.444.777-35".to_string()));
        assert_eq!(email, "roberto.financeiro@email.com");
        assert_eq!(tel, "(11) 99999-8888");
        assert_eq!(parentesco, "Pai / Resp. Financeiro");
    }

    #[test]
    fn test_validar_tipo_sanguineo_padroes_e_invalido() {
        assert!(validar_tipo_sanguineo("O+"));
        assert!(validar_tipo_sanguineo("a-"));
        assert!(validar_tipo_sanguineo("AB+"));
        assert!(validar_tipo_sanguineo("Não informado"));
        assert!(validar_tipo_sanguineo(""));
        assert!(!validar_tipo_sanguineo("C+"));
        assert!(!validar_tipo_sanguineo("XYZ"));
    }
}
