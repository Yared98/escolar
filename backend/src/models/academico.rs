use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DiarioClasse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub turma_id: Uuid,
    pub professor_id: Uuid,
    pub disciplina_id: Option<Uuid>,
    pub horario_id: Option<Uuid>,
    pub data_aula: NaiveDate,
    pub conteudo_ministrado: String,
    pub created_at: DateTime<Utc>,
    pub observacao: String,
}

#[derive(Debug, Deserialize)]
pub struct SyncPresencaItemDto {
    pub aluno_id: Uuid,
    pub presente: bool,
    pub justificativa: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SyncDiarioDto {
    pub turma_id: Uuid,
    pub data_aula: NaiveDate,
    pub disciplina_id: Option<Uuid>,
    pub horario_id: Option<Uuid>,
    pub conteudo_ministrado: String,
    pub presencas: Vec<SyncPresencaItemDto>,
    pub observacao: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConsultarDiarioQuery {
    pub turma_id: Uuid,
    pub data_aula: NaiveDate,
    pub disciplina_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct DiariosRecentesQuery {
    pub turma_id: Uuid,
    pub disciplina_id: Option<Uuid>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PresencaDiaDto {
    pub aluno_id: Uuid,
    pub presente: bool,
    pub justificativa: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiarioDiaResponse {
    pub encontrado: bool,
    pub diario_id: Option<Uuid>,
    pub turma_id: Uuid,
    pub disciplina_id: Option<Uuid>,
    pub disciplina_nome: Option<String>,
    pub horario_id: Option<Uuid>,
    pub hora_inicio: Option<String>,
    pub hora_fim: Option<String>,
    pub data_aula: NaiveDate,
    pub conteudo_ministrado: String,
    pub observacao: String,
    pub presencas: Vec<PresencaDiaDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DiarioRecenteItem {
    pub diario_id: Uuid,
    pub data_aula: NaiveDate,
    pub disciplina_id: Option<Uuid>,
    pub disciplina_nome: Option<String>,
    pub conteudo_ministrado: String,
    pub observacao: String,
    pub total_presencas: i64,
    pub total_presentes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Nota {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub disciplina_nome: String,
    pub nota: f64,
    pub periodo: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoletimDisciplinaDto {
    pub nome: String,
    pub nota_1_bim: Option<f64>,
    pub nota_2_bim: Option<f64>,
    pub nota_3_bim: Option<f64>,
    pub nota_4_bim: Option<f64>,
    pub media: f64,
    pub frequencia_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoletimCompletoDto {
    pub aluno_id: Uuid,
    pub nome_aluno: String,
    pub disciplinas: Vec<BoletimDisciplinaDto>,
    pub media_geral: f64,
    pub status_aprovacao: String,
    pub periodos_fechados: Vec<String>,
    pub pareceres: Vec<ParecerBoletimDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ParecerBoletimDto {
    pub periodo: String,
    pub parecer: String,
    pub encaminhamento: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProjetoEducacional {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub turma_id: Uuid,
    pub professor_id: Option<Uuid>,
    pub titulo: String,
    pub objetivo: String,
    pub habilidades_bncc: Option<String>,
    pub data_inicio: NaiveDate,
    pub data_fim: NaiveDate,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjetoEducacionalDto {
    pub turma_id: Uuid,
    pub titulo: String,
    pub objetivo: String,
    pub habilidades_bncc: Option<String>,
    pub data_inicio: NaiveDate,
    pub data_fim: NaiveDate,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Cardapio {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub turma_id: Option<Uuid>,
    pub semana_ano: String,
    pub data_dia: NaiveDate,
    pub tipo_refeicao: String,
    pub titulo_menu: String,
    pub descricao_ingredientes: String,
    pub alergicos_atencao: Option<String>,
    pub nutricionista_id: Option<Uuid>,
    pub nutricionista_responsavel: String,
    pub prato_id: Option<Uuid>,
    pub recorrencia_id: Option<Uuid>,
    pub origem: String,
    pub editado_manualmente: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Prato {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub titulo: String,
    pub descricao_ingredientes: String,
    pub alergicos_atencao: Option<String>,
    pub tipo_refeicao: Option<String>,
    pub ativo: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertPratoDto {
    pub titulo: String,
    pub descricao_ingredientes: String,
    pub alergicos_atencao: Option<String>,
    pub tipo_refeicao: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecorrenciaCardapioDto {
    pub prato_id: Option<Uuid>,
    pub titulo_menu: String,
    pub descricao_ingredientes: String,
    pub alergicos_atencao: Option<String>,
    pub turma_id: Option<Uuid>,
    pub tipo_refeicao: String,
    pub dias_semana: Vec<i16>,
    pub data_inicio: NaiveDate,
    pub data_fim: NaiveDate,
    pub nutricionista_id: Uuid,
    pub pular_feriados: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct EditarCardapioDto {
    pub escopo: String,
    pub titulo_menu: String,
    pub descricao_ingredientes: String,
    pub alergicos_atencao: Option<String>,
    pub tipo_refeicao: Option<String>,
    pub data_dia: Option<NaiveDate>,
    pub turma_id: Option<Uuid>,
    pub limpar_turma: Option<bool>,
    pub nutricionista_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCardapioDto {
    pub turma_id: Option<Uuid>,
    pub semana_ano: String,
    pub data_dia: NaiveDate,
    pub tipo_refeicao: String,
    pub titulo_menu: String,
    pub descricao_ingredientes: String,
    pub alergicos_atencao: Option<String>,
    pub nutricionista_id: Uuid,
}

// Modelagem TRI & Leitura Ótica de Gabaritos
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SimuladoTri {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub titulo: String,
    pub descricao: Option<String>,
    pub disciplina: String,
    pub data_aplicacao: NaiveDate,
    pub total_itens: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SimuladoItem {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub simulado_id: Uuid,
    pub numero_item: i32,
    pub gabarito_correto: String,
    pub parametro_a: f64,
    pub parametro_b: f64,
    pub parametro_c: f64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SimuladoResposta {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub simulado_id: Uuid,
    pub aluno_id: Uuid,
    pub respostas_marcadas: serde_json::Value,
    pub total_acertos: i32,
    pub proficiencia_theta: f64,
    pub escala_enem: f64,
    pub coerencia_pedagogica_score: f64,
    pub status_diagnostico: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSimuladoItemDto {
    pub numero_item: i32,
    pub gabarito_correto: String,
    pub parametro_a: f64,
    pub parametro_b: f64,
    pub parametro_c: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateSimuladoDto {
    pub titulo: String,
    pub descricao: Option<String>,
    pub disciplina: String,
    pub data_aplicacao: NaiveDate,
    pub itens: Vec<CreateSimuladoItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RespostaMarcadaDto {
    pub numero_item: i32,
    pub resposta: String,
}

#[derive(Debug, Deserialize)]
pub struct ApuracaoGabaritoDto {
    pub simulado_id: Uuid,
    pub aluno_id: Uuid,
    pub respostas: Vec<RespostaMarcadaDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultadoTriDto {
    pub simulado_id: Uuid,
    pub aluno_id: Uuid,
    pub total_itens: usize,
    pub total_acertos: usize,
    pub proficiencia_theta: f64,
    pub escala_enem: f64,
    pub coerencia_pedagogica_score: f64,
    pub status_diagnostico: String,
    pub recomendacao_pedagogica: String,
}

// --- CADASTRO PEDAGÓGICO: DISCIPLINAS & COMPONENTES CURRICULARES (BNCC) ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Disciplina {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub codigo: String,
    pub nome: String,
    pub area_conhecimento: String,
    pub carga_horaria_semanal: i32,
    pub carga_horaria_anual: i32,
    pub descricao: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDisciplinaDto {
    pub codigo: String,
    pub nome: String,
    pub area_conhecimento: Option<String>,
    pub carga_horaria_semanal: Option<i32>,
    pub carga_horaria_anual: Option<i32>,
    pub descricao: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDisciplinaDto {
    pub codigo: Option<String>,
    pub nome: Option<String>,
    pub area_conhecimento: Option<String>,
    pub carga_horaria_semanal: Option<i32>,
    pub carga_horaria_anual: Option<i32>,
    pub descricao: Option<String>,
    pub status: Option<String>,
}

// --- VÍNCULOS: MATRIZ CURRICULAR DA TURMA ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TurmaDisciplina {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub carga_horaria_semanal: i32,
    pub carga_horaria_anual: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurmaDisciplinaDetalhada {
    pub id: Uuid,
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub disciplina_codigo: String,
    pub disciplina_nome: String,
    pub area_conhecimento: String,
    pub carga_horaria_semanal: i32,
    pub carga_horaria_anual: i32,
    pub professor_id: Option<Uuid>,
    pub professor_nome: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AdicionarDisciplinaTurmaDto {
    pub disciplina_id: Uuid,
    pub carga_horaria_semanal: Option<i32>,
    pub carga_horaria_anual: Option<i32>,
}

// --- VÍNCULOS: ATRIBUIÇÃO DOCENTE (PROFESSOR <-> TURMA <-> DISCIPLINA) ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TurmaProfessor {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub professor_id: Uuid,
    pub ano_letivo: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurmaProfessorDetalhado {
    pub id: Uuid,
    pub turma_id: Uuid,
    pub turma_nome: String,
    pub disciplina_id: Uuid,
    pub disciplina_nome: String,
    pub professor_id: Uuid,
    pub professor_nome: String,
    pub professor_email: String,
    pub ano_letivo: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AtribuirProfessorDto {
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub professor_id: Uuid,
    pub ano_letivo: Option<i32>,
}

// --- VÍNCULOS: GRADE HORÁRIA & QUADRO SEMANAL COM DETECÇÃO DE CHOQUES ---

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HorarioTurma {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub professor_id: Option<Uuid>,
    pub sala_id: Option<Uuid>,
    pub dia_semana: i32,
    pub hora_inicio: String,
    pub hora_fim: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorarioTurmaDetalhado {
    pub id: Uuid,
    pub turma_id: Uuid,
    pub disciplina_id: Uuid,
    pub disciplina_nome: String,
    pub professor_id: Option<Uuid>,
    pub professor_nome: Option<String>,
    pub sala_id: Option<Uuid>,
    pub sala_nome: Option<String>,
    pub dia_semana: i32,
    pub hora_inicio: String,
    pub hora_fim: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateHorarioTurmaDto {
    pub disciplina_id: Uuid,
    pub professor_id: Option<Uuid>,
    pub sala_id: Option<Uuid>,
    pub dia_semana: i32,
    pub hora_inicio: String,
    pub hora_fim: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PortfolioInfantil {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub aluno_id: Uuid,
    pub professor_id: Uuid,
    pub turma_id: Option<Uuid>,
    pub data_registro: chrono::NaiveDate,
    pub titulo: String,
    pub descricao: String,
    pub midia_url: Option<String>,
    pub campos_experiencia_bncc: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePortfolioInfantilDto {
    pub aluno_id: Uuid,
    pub turma_id: Option<Uuid>,
    pub data_registro: Option<chrono::NaiveDate>,
    pub titulo: String,
    pub descricao: String,
    pub midia_url: Option<String>,
    pub campos_experiencia_bncc: Option<String>,
}
