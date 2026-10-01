export type AlunoStatus =
  | 'pre_matricula'
  | 'ativo'
  | 'trancado'
  | 'transferido'
  | 'inativo'
  | string;

export interface Aluno {
  id: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  nome_responsavel: string;
  cpf_responsavel_legal?: string;
  email_responsavel: string;
  telefone_responsavel: string;
  parentesco_responsavel_legal?: string;
  responsavel_financeiro_igual_legal: boolean;
  nome_responsavel_financeiro?: string;
  cpf_responsavel_financeiro?: string;
  email_responsavel_financeiro?: string;
  telefone_responsavel_financeiro?: string;
  parentesco_responsavel_financeiro?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  telefone_secundario?: string;
  contato_emergencia_nome?: string;
  contato_emergencia_telefone?: string;
  contato_emergencia_parentesco?: string;
  status: AlunoStatus;
  turma_atual_id?: string | null;
  turma_atual_nome?: string | null;
  turma_atual_codigo?: string | null;
  numero_chamada?: number | null;
}

export interface AlunoStatusContagem {
  status: string;
  total: number;
}

export interface AlunosPage {
  items: Aluno[];
  total: number;
  page: number;
  page_size: number;
  contagem_status: AlunoStatusContagem[];
}

export const ALUNO_STATUS_LABELS: Record<string, string> = {
  pre_matricula: 'Pré-matrícula',
  ativo: 'Ativo',
  trancado: 'Trancado',
  transferido: 'Transferido',
  inativo: 'Inativo',
};

export function labelStatusAluno(status: string): string {
  return ALUNO_STATUS_LABELS[status] || status;
}

export function statusAlunoBadgeClass(status: string): string {
  switch (status) {
    case 'ativo':
      return 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300';
    case 'pre_matricula':
      return 'bg-sky-100 dark:bg-sky-950/60 border-sky-300 dark:border-sky-500/40 text-sky-900 dark:text-sky-300';
    case 'trancado':
      return 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300';
    case 'transferido':
      return 'bg-violet-100 dark:bg-violet-950/60 border-violet-300 dark:border-violet-500/40 text-violet-900 dark:text-violet-300';
    case 'inativo':
      return 'bg-slate-200 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300';
    default:
      return 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300';
  }
}

/** Próximas transições úteis a partir do status atual. */
export function proximasAcoesStatus(status: string): { status: AlunoStatus; label: string }[] {
  switch (status) {
    case 'pre_matricula':
      return [
        { status: 'ativo', label: 'Ativar matrícula' },
        { status: 'inativo', label: 'Cancelar pré-matrícula' },
      ];
    case 'ativo':
      return [
        { status: 'trancado', label: 'Trancar matrícula' },
        { status: 'transferido', label: 'Marcar transferido' },
        { status: 'inativo', label: 'Inativar' },
      ];
    case 'trancado':
      return [
        { status: 'ativo', label: 'Reativar' },
        { status: 'inativo', label: 'Inativar' },
      ];
    case 'transferido':
      return [
        { status: 'ativo', label: 'Reativar (retorno)' },
        { status: 'inativo', label: 'Inativar' },
      ];
    case 'inativo':
      return [
        { status: 'ativo', label: 'Reativar' },
        { status: 'pre_matricula', label: 'Voltar para pré-matrícula' },
      ];
    default:
      return [{ status: 'ativo', label: 'Definir como ativo' }];
  }
}

export interface ProntuarioData {
  id?: string;
  tenant_id?: string;
  aluno_id?: string;
  tipo_sanguineo?: string;
  alergias?: string;
  restricoes_alimentares?: string;
  medicamentos_continuos?: string;
  cuidados_especiais?: string;
  historico_observacoes?: string;
  updated_at?: string;
}

export interface Turma {
  id: string;
  sala_id?: string;
  sala_nome?: string;
  codigo?: string;
  nome: string;
  etapa_ensino?: string;
  serie?: string;
  turno?: string;
  ano_letivo: number;
  capacidade_maxima: number;
  professor_regente_id?: string;
  professor_regente_nome?: string;
  status?: string;
  alunos_matriculados?: number;
  vagas_restantes?: number;
}

export interface AlunoTurmaDetalhado {
  id: string;
  aluno_id: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  numero_chamada?: number;
  nome_responsavel: string;
  telefone_responsavel: string;
  status: string;
  data_matricula: string;
}

export interface Sala {
  id: string;
  nome: string;
  capacidade: number;
}

export interface ProfessorItem {
  id: string;
  name: string;
  email: string;
  role?: string;
}
