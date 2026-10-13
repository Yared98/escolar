export interface Fatura {
  id: string;
  aluno_id?: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  metodo_pagamento: string;
  status: string;
  qr_code_pix?: string;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  multa_percentual?: number;
  juros_mora_mes_percentual?: number;
}

export interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_vencimento: string;
  metodo_pagamento?: string;
  status: string;
  tipo: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
}

export interface Fornecedor {
  id: string;
  razao_social: string;
  cnpj: string;
  ramo_atividade?: string;
  email?: string;
  telefone?: string;
  status?: string;
}

export interface DreReport {
  receita_bruta: number;
  despesas_totais: number;
  resultado_liquido: number;
  inadimplencia_total: number;
  total_faturas_pagas: number;
  total_faturas_pendentes: number;
  total_faturas_atrasadas?: number;
  dfc_caixa_projetado: number;
}

export interface AlunoOpcao {
  id: string;
  nome: string;
}

export interface NfseItem {
  id: string;
  fatura_id: string;
  numero_nfse?: string;
  valor_servico: number;
  status: string;
  created_at?: string;
}

export interface ReguaLog {
  id: string;
  fatura_id: string;
  canal: string;
  tipo_evento: string;
  status_envio: string;
  mensagem_corpo?: string;
  enviado_em: string;
}

export type AgingRange = '0-30' | '31-60' | '60+' | null;
