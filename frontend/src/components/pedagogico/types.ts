// --- INTERFACES ---

export interface Disciplina {
  id: string;
  codigo: string;
  nome: string;
  area_conhecimento: string;
  carga_horaria_semanal: number;
  carga_horaria_anual: number;
  descricao?: string;
  status: string;
}

export interface Turma {
  id: string;
  nome: string;
  codigo?: string;
  etapa_ensino?: string;
  serie?: string;
  turno?: string;
  ano_letivo: number;
  capacidade_maxima: number;
  alunos_matriculados?: number;
  vagas_restantes?: number;
  sala_nome?: string;
  professor_regente_nome?: string;
}

export interface TurmaDisciplinaDetalhada {
  id: string;
  turma_id: string;
  disciplina_id: string;
  disciplina_codigo: string;
  disciplina_nome: string;
  area_conhecimento: string;
  carga_horaria_semanal: number;
  carga_horaria_anual: number;
  professor_id?: string;
  professor_nome?: string;
}

export interface HorarioTurmaDetalhado {
  id: string;
  turma_id: string;
  disciplina_id: string;
  disciplina_nome: string;
  professor_id?: string;
  professor_nome?: string;
  sala_id?: string;
  sala_nome?: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

export interface ProfessorItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface SalaItem {
  id: string;
  nome: string;
  capacidade: number;
}

export interface SimuladoTri {
  id: string;
  titulo: string;
  descricao?: string;
  disciplina: string;
  data_aplicacao: string;
  total_itens: number;
}

export interface ProjetoEducacional {
  id: string;
  titulo: string;
  objetivo: string;
  habilidades_bncc?: string;
  data_inicio: string;
  data_fim: string;
  status: string;
}

/** Mesmo contrato de GET /secretaria/turmas/:id/alunos (vínculo ativo + aluno ativo). */
export interface AlunoTurmaRoster {
  id: string;
  aluno_id: string;
  nome: string;
  numero_chamada?: number | null;
  status: string;
}

export type PeriodoFechamento =
  | '1_bimestre'
  | '2_bimestre'
  | '3_bimestre'
  | '4_bimestre'
  | '1_trimestre'
  | '2_trimestre'
  | '3_trimestre'
  | 'recuperacao';

export interface FechamentoPeriodo {
  periodo: PeriodoFechamento;
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
