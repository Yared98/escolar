export type StatusPresenca = 'presente' | 'falta' | 'justificada';

export const OBSERVACAO_DIARIO_MAX = 4000;

export interface AlunoChamada {
  id: string;
  nome: string;
  status: StatusPresenca;
  justificativa?: string;
  responsavel_user_id?: string | null;
  responsavel_nome?: string;
}

export const alunoTemResponsavel = (
  aluno: Pick<AlunoChamada, 'responsavel_user_id'>,
): boolean => Boolean(aluno.responsavel_user_id);

export const dicaRecadoFamilia = (
  aluno: Pick<AlunoChamada, 'responsavel_user_id'>,
): string =>
  alunoTemResponsavel(aluno)
    ? 'Enviar recado à família'
    : 'Aluno sem responsável cadastrado';

export const formatarAvisoRecadoEnviado = (responsavelNome?: string): string => {
  const nome = (responsavelNome || '').trim();
  return nome ? `Recado enviado para ${nome}` : 'Recado enviado para os responsáveis';
};

export const urlConversaAgenda = (conversaId: string): string =>
  `/?route=agenda&tab=comunicacao&conversa=${encodeURIComponent(conversaId)}`;

export interface TurmaOpcao {
  id: string;
  nome: string;
  etapa_ensino?: string;
  turno?: string;
  /** Disciplinas do professor nesta turma (só vem de /professor/minhas-turmas). */
  disciplinas?: { disciplina_id: string; disciplina_nome: string }[];
}

export const isTurmaInfantil = (turma?: Pick<TurmaOpcao, 'etapa_ensino'> | null): boolean =>
  (turma?.etapa_ensino || '').toLowerCase().includes('infantil');

export interface SyncPresencaItem {
  aluno_id: string;
  presente: boolean;
  justificativa: string | null;
}

export interface SyncDiarioPayload {
  turma_id: string;
  data_aula: string;
  disciplina_id?: string;
  horario_id?: string;
  conteudo_ministrado: string;
  observacao?: string;
  presencas: SyncPresencaItem[];
}

export interface DiarioDiaResponse {
  encontrado: boolean;
  diario_id: string | null;
  turma_id: string;
  disciplina_id?: string | null;
  disciplina_nome?: string | null;
  horario_id?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  data_aula: string;
  conteudo_ministrado: string;
  observacao: string;
  presencas: SyncPresencaItem[];
}

export interface DiarioRecenteItem {
  diario_id: string;
  data_aula: string;
  disciplina_id?: string | null;
  disciplina_nome?: string | null;
  conteudo_ministrado: string;
  observacao: string;
  total_presencas: number;
  total_presentes: number;
}

export interface CreateRotinaPayload {
  aluno_id: string;
  data: string;
  refeicao_status: string;
  sono_minutos: number;
  fraldas_trocas: number;
  humor: string;
  medicamento_ministrado: string | null;
  observacao_pedagogica: string | null;
  refeicoes: RefeicaoRotina[];
}

export type StatusRefeicao = 'tudo' | 'metade' | 'pouco' | 'recusou';

export interface RefeicaoRotina {
  tipo_refeicao: string;
  status: StatusRefeicao;
}

export interface CardapioDia {
  tipo_refeicao: string;
  titulo_menu: string;
  descricao_ingredientes: string;
  alergicos_atencao: string | null;
}

export type PresencaDia = StatusPresenca | 'sem_registro';

export interface RotinaInfantilDia {
  refeicao_status: string;
  sono_minutos: number;
  fraldas_trocas: number;
  humor: string;
  medicamento_ministrado: string | null;
  observacao_pedagogica: string | null;
  refeicoes: RefeicaoRotina[];
}

export interface DiarioInfantilDia {
  aluno_id: string;
  data: string;
  turma: { id: string; nome: string; etapa_ensino: string } | null;
  presenca: PresencaDia;
  justificativa: string | null;
  rotina: RotinaInfantilDia | null;
  cardapio: CardapioDia[];
}

export const STATUS_REFEICAO_LABEL: Record<StatusRefeicao, string> = {
  tudo: 'Comeu tudo',
  metade: 'Metade',
  pouco: 'Pouco',
  recusou: 'Recusou',
};

export const resumoRefeicoes = (refeicoes: RefeicaoRotina[]): string => {
  if (refeicoes.length === 0) return 'excelente';
  if (refeicoes.every((r) => r.status === 'tudo')) return 'excelente';
  if (refeicoes.every((r) => r.status === 'recusou')) return 'recusou';
  return 'parcial';
};

export interface CreatePortfolioPayload {
  aluno_id: string;
  turma_id?: string;
  data_registro: string;
  titulo: string;
  descricao: string;
  midia_url?: string | null;
  campos_experiencia_bncc?: string | null;
}

export type ToastMsg = { text: string; type: 'success' | 'warn' };

export interface MinhaTurmaDisciplina {
  disciplina_id: string;
  disciplina_nome: string;
}

export interface MinhaTurma {
  turma_id: string;
  turma_nome: string;
  etapa_ensino: string;
  total_alunos: number;
  disciplinas: MinhaTurmaDisciplina[];
}

export interface AulaDia {
  horario_id: string;
  turma_id: string;
  turma_nome: string;
  disciplina_id: string;
  disciplina_nome: string;
  sala_nome?: string | null;
  hora_inicio: string;
  hora_fim: string;
  chamada_registrada: boolean;
  plano_semana_feito?: boolean;
}

export interface NotaAluno {
  aluno_id: string;
  aluno_nome: string;
  numero_chamada?: number | null;
  nota?: number | null;
}

export type TipoAvaliacao = 'prova' | 'trabalho' | 'atividade';

export const TIPOS_AVALIACAO: { value: TipoAvaliacao; label: string }[] = [
  { value: 'prova', label: 'Prova' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'atividade', label: 'Atividade' },
];

/** Avaliação (prova, trabalho ou atividade) marcada no calendário de uma turma. */
export interface AvaliacaoCalendario {
  id: string;
  titulo: string;
  descricao: string | null;
  /** Data no formato YYYY-MM-DD. */
  data: string;
  tipo: TipoAvaliacao;
  turma_id: string;
  turma_nome: string;
  disciplina_id: string | null;
  disciplina_nome: string | null;
}

/** Dados que o professor envia para marcar uma nova avaliação. */
export interface NovaAvaliacaoPayload {
  turma_id: string;
  disciplina_id: string;
  titulo: string;
  descricao?: string | null;
  data: string;
  tipo: TipoAvaliacao;
}

export type PeriodoNota =
  | '1_bimestre'
  | '2_bimestre'
  | '3_bimestre'
  | '4_bimestre'
  | '1_trimestre'
  | '2_trimestre'
  | '3_trimestre'
  | 'recuperacao';

export const PERIODOS_NOTA: { value: PeriodoNota; label: string }[] = [
  { value: '1_bimestre', label: '1º Bimestre' },
  { value: '2_bimestre', label: '2º Bimestre' },
  { value: '3_bimestre', label: '3º Bimestre' },
  { value: '4_bimestre', label: '4º Bimestre' },
  { value: 'recuperacao', label: 'Recuperação' },
];

export interface LoteNotasPayload {
  turma_id: string;
  disciplina_id: string;
  periodo: PeriodoNota;
  notas: { aluno_id: string; nota: number | null }[];
}

// ---------------------------------------------------------------------------
// Ocorrências e observações do aluno
// ---------------------------------------------------------------------------

/** Tipos oferecidos no Diário do Fundamental (nomes que a escola usa). */
export type TipoOcorrenciaFundamental =
  | 'comportamento'
  | 'atraso'
  | 'falta_material'
  | 'saude'
  | 'elogio'
  | 'outros';

/** Tipo gravado no banco (inclui os tipos históricos da Educação Infantil). */
export type TipoOcorrencia =
  | TipoOcorrenciaFundamental
  | 'febre'
  | 'indisposicao'
  | 'queda_arranhao'
  | 'atrito_colega'
  | 'outro';

/** Tamanho máximo da descrição de uma ocorrência. */
export const OCORRENCIA_DESCRICAO_MAX = 1000;

/** Nomes amigáveis de todos os tipos aceitos pelo sistema. */
export const TIPO_OCORRENCIA_LABEL: Record<string, string> = {
  comportamento: 'Comportamento',
  atraso: 'Atraso',
  falta_material: 'Falta de material',
  saude: 'Saúde',
  elogio: 'Elogio',
  outros: 'Outros',
  outro: 'Outros',
  febre: 'Febre ou indisposição',
  indisposicao: 'Indisposição',
  queda_arranhao: 'Queda / arranhão',
  atrito_colega: 'Atrito com colega',
};

/** Traduz o tipo gravado para a linguagem da escola. */
export const tipoOcorrenciaLabel = (tipo: string): string =>
  TIPO_OCORRENCIA_LABEL[tipo] ?? 'Outros';

/** Tipos que o professor escolhe no Diário do Fundamental. */
export const TIPOS_OCORRENCIA_FUNDAMENTAL: { value: TipoOcorrenciaFundamental; label: string }[] = [
  { value: 'comportamento', label: 'Comportamento' },
  { value: 'atraso', label: 'Atraso' },
  { value: 'falta_material', label: 'Falta de material' },
  { value: 'saude', label: 'Saúde' },
  { value: 'elogio', label: 'Elogio' },
  { value: 'outros', label: 'Outros' },
];

/**
 * Prioridade sugerida por tipo. O professor não escolhe prioridade: um elogio
 * não é urgente e um caso de saúde precisa de atenção da coordenação.
 */
export const PRIORIDADE_OCORRENCIA: Record<string, string> = {
  comportamento: 'alta',
  atraso: 'media',
  falta_material: 'media',
  saude: 'alta',
  elogio: 'baixa',
  outros: 'media',
  febre: 'urgente',
  indisposicao: 'urgente',
  queda_arranhao: 'urgente',
  atrito_colega: 'alta',
};

/** Ocorrência registrada pela escola sobre um aluno. */
export interface OcorrenciaAluno {
  id: string;
  aluno_id: string;
  turma_id: string | null;
  tipo_ocorrencia: string;
  descricao: string;
  prioridade: string;
  notificado_responsavel: boolean;
  lido_pelo_responsavel: boolean;
  created_at: string;
}

/** Dados enviados pelo professor ao registrar uma observação. */
export interface NovaOcorrenciaPayload {
  aluno_id: string;
  turma_id: string | null;
  tipo_ocorrencia: string;
  descricao: string;
  prioridade: string;
  notificado_responsavel: boolean;
}

export interface FechamentoPeriodo {
  periodo: PeriodoNota;
  fechado: boolean;
  fechado_por?: string | null;
  fechado_em?: string | null;
}

export interface AlunoConselho {
  aluno_id: string;
  aluno_nome: string;
  numero_chamada?: number | null;
  media_periodo?: number | null;
  parecer?: string | null;
  encaminhamento?: 'recuperacao' | 'acompanhamento' | 'sem_pendencias' | null;
}

export interface ParecerBoletim {
  periodo: string;
  parecer: string;
  encaminhamento?: 'recuperacao' | 'acompanhamento' | 'sem_pendencias' | null;
}

export interface PlanoAula {
  id: string;
  turma_id: string;
  disciplina_id: string;
  disciplina_nome?: string;
  professor_id: string;
  professor_nome?: string;
  semana_inicio: string;
  objetivos: string;
  conteudos: string;
  habilidades_bncc: string[];
  atividades: string;
  avaliacao?: string | null;
  comentario_coordenacao?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalvarPlanoAulaPayload {
  turma_id: string;
  disciplina_id: string;
  semana_inicio: string;
  objetivos: string;
  conteudos: string;
  habilidades_bncc: string[];
  atividades: string;
  avaliacao?: string | null;
}
