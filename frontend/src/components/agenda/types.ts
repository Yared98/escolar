export interface MensagemAgenda {
  id: string;
  canal: string;
  titulo: string;
  conteudo: string;
  lida: boolean;
  created_at: string;
  turma_id?: string | null;
  destinatario_id?: string | null;
  remetente_id?: string;
  remetente_nome?: string | null;
  remetente_role?: string | null;
  resposta_a_id?: string | null;
  thread_id?: string | null;
}

export interface ThreadAgenda {
  id: string;
  raiz: MensagemAgenda;
  mensagens: MensagemAgenda[];
  respostas: number;
  ultima: MensagemAgenda;
  temNaoLida: boolean;
}

export interface AtendimentoProtocolo {
  id: string;
  protocolo: string;
  telefone_contato: string;
  assunto: string;
  status: string;
  setor_transbordo?: string;
  ultima_mensagem?: string;
  resposta_enviada?: string;
  created_at: string;
}

export interface AlunoResumo {
  id: string;
  nome: string;
  nome_responsavel: string;
  responsavel_user_id?: string | null;
}

export interface TurmaOpcao {
  id: string;
  nome: string;
}

export type FiltroCanal = 'todos' | 'mural' | 'privado' | 'coordenacao' | 'professor';
export type TipoEnvio = 'mural' | 'privado' | 'familia';

export interface ContatoEscola {
  id: string;
  name: string;
  email: string;
  role: string;
}
