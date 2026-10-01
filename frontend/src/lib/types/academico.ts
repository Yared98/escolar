export type StatusPresenca = 'presente' | 'falta' | 'justificada';

export const OBSERVACAO_DIARIO_MAX = 4000;

export interface AlunoChamada {
  id: string;
  nome: string;
  status: StatusPresenca;
  justificativa?: string;
}

export interface TurmaOpcao {
  id: string;
  nome: string;
  etapa_ensino?: string;
  turno?: string;
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
  conteudo_ministrado: string;
  observacao?: string;
  presencas: SyncPresencaItem[];
}

export interface DiarioDiaResponse {
  encontrado: boolean;
  diario_id: string | null;
  turma_id: string;
  data_aula: string;
  conteudo_ministrado: string;
  observacao: string;
  presencas: SyncPresencaItem[];
}

export interface DiarioRecenteItem {
  diario_id: string;
  data_aula: string;
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
