export interface AlunoVinculado {
  id: string;
  nome: string;
  cpf?: string;
}

export interface DisciplinaBoletim {
  nome: string;
  nota_1_bim?: number;
  nota_2_bim?: number;
  media: number;
  frequencia_pct: number;
}


export interface PortfolioInfantil {
  id: string;
  titulo: string;
  descricao: string;
  data_registro: string;
  midia_url?: string;
  campos_experiencia_bncc: string[];
}

export interface BoletimData {
  aluno_id: string;
  nome_aluno: string;
  disciplinas: DisciplinaBoletim[];
  media_geral: number;
  status_aprovacao: string;
}

export interface FaturaData {
  id: string;
  aluno_id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  metodo_pagamento: string;
  qr_code_pix?: string;
  linha_digitavel?: string;
}

export interface DiplomaData {
  id: string;
  aluno_id: string;
  curso_nome: string;
  hash_xades: string;
  carimbo_tempo: string;
  codigo_validacao: string;
  status: string;
  qr_code_validacao_url?: string;
  rvdd_pdf_url?: string;
}

export interface MensagemPortal {
  id: string;
  canal: string;
  titulo: string;
  conteudo: string;
  lida: boolean;
  created_at: string;
  turma_id?: string | null;
  remetente_nome?: string | null;
  remetente_role?: string | null;
  resposta_a_id?: string | null;
  thread_id?: string | null;
}

export interface ThreadPortal {
  id: string;
  raiz: MensagemPortal;
  mensagens: MensagemPortal[];
  respostas: number;
  ultima: MensagemPortal;
}
