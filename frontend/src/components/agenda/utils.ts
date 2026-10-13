import { AlunoResumo, MensagemAgenda, ThreadAgenda } from './types';

export interface OpcaoAlunoPrivado {
  id: string;
  rotulo: string;
}

// Mensagem privada: depois de escolher a turma, uma linha por aluno com o responsável ao lado.
// Irmãos em turmas diferentes aparecem em cada turma; a conversa fica ligada ao aluno escolhido.
export const opcoesAlunoPrivado = (alunos: AlunoResumo[], busca = ''): OpcaoAlunoPrivado[] => {
  const termo = busca.trim().toLowerCase();
  return [...alunos]
    .filter(
      (a) =>
        !termo ||
        a.nome.toLowerCase().includes(termo) ||
        (a.nome_responsavel || '').toLowerCase().includes(termo),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((a) => ({
      id: a.id,
      rotulo: `${a.nome} · ${a.nome_responsavel?.trim() || 'responsável não informado'}`,
    }));
};

export const rotuloCanal = (canal: string) => {
  switch (canal) {
    case 'mural_turma':
      return 'Mural';
    case 'professor':
      return 'Privada';
    case 'responsavel':
      return 'Família';
    case 'coordenacao':
      return 'Coordenação';
    case 'financeiro':
      return 'Financeiro';
    case 'nutricao':
      return 'Nutrição';
    default:
      return canal;
  }
};

export const estiloCanal = (canal: string) => {
  if (canal === 'mural_turma') return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200';
  if (canal === 'professor' || canal === 'responsavel') return 'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200';
  if (canal === 'coordenacao') return 'bg-salvia-100 text-salvia-900 dark:bg-salvia-900/60 dark:text-salvia-200';
  if (canal === 'financeiro') return 'bg-violet-100 text-violet-900';
  if (canal === 'nutricao') return 'bg-emerald-100 text-emerald-900';
  return 'bg-slate-200 text-slate-700';
};

export const formatarQuando = (iso: string) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  const agora = new Date();
  const diffMs = agora.getTime() - data.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Agora';
  if (min < 60) return `Há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `Há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Há ${dias} d`;
  return data.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const tituloTema = (titulo: string) => titulo.replace(/^(Re:\s*)+/i, '').trim() || titulo;

export const threadKeyOf = (m: MensagemAgenda) => m.thread_id || m.resposta_a_id || m.id;

export const agruparThreads = (msgs: MensagemAgenda[]): ThreadAgenda[] => {
  const grupos = new Map<string, MensagemAgenda[]>();
  for (const m of msgs) {
    const key = threadKeyOf(m);
    const lista = grupos.get(key) || [];
    lista.push(m);
    grupos.set(key, lista);
  }

  const threads: ThreadAgenda[] = [];
  for (const [key, lista] of grupos) {
    const ordenadas = [...lista].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const raiz =
      ordenadas.find((m) => m.id === key) ||
      ordenadas.find((m) => !m.resposta_a_id) ||
      ordenadas[0];
    const ultima = ordenadas[ordenadas.length - 1];
    threads.push({
      id: key,
      raiz,
      mensagens: ordenadas,
      respostas: Math.max(0, ordenadas.length - 1),
      ultima,
      temNaoLida: ordenadas.some((m) => !m.lida && m.id !== raiz.id),
    });
  }

  return threads.sort(
    (a, b) => new Date(b.ultima.created_at).getTime() - new Date(a.ultima.created_at).getTime(),
  );
};

function zerarHora(d: Date): Date {
  const z = new Date(d);
  z.setHours(0, 0, 0, 0);
  return z;
}

function diasEntre(inicio: Date, fim: Date): number {
  const ms = zerarHora(fim).getTime() - zerarHora(inicio).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * Formata o horário exibido na lista de conversas.
 * Hoje → "14:32"; ontem → "Ontem"; nesta semana → dia da semana (Seg, Ter…);
 * mais antigo → "12/10".
 */
export function formatarHorarioCurto(iso: string, agoraRef?: Date): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';

  const agora = agoraRef || new Date();
  const diff = diasEntre(data, agora);
  const horas = String(data.getHours()).padStart(2, '0');
  const minutos = String(data.getMinutes()).padStart(2, '0');

  if (diff === 0) return `${horas}:${minutos}`;
  if (diff === 1) return 'Ontem';
  if (diff > 1 && diff < 7) {
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return dias[data.getDay()];
  }

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
}

export function iniciaisNome(nome?: string | null): string {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function rotuloSeparadorDia(data: Date, agora: Date): string {
  const diff = diasEntre(data, agora);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${data.getDate()} de ${meses[data.getMonth()]}`;
}

export interface DiaMensagens {
  label: string;
  data: Date;
  mensagens: MensagemAgenda[];
}

/**
 * Agrupa mensagens cronologicamente por dia para exibir os separadores de data.
 */
export function agruparMensagensPorDia(
  mensagens: MensagemAgenda[],
  agoraRef?: Date,
): DiaMensagens[] {
  const agora = agoraRef || new Date();
  const mapa = new Map<string, { data: Date; mensagens: MensagemAgenda[] }>();

  const ordenadas = [...mensagens].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const m of ordenadas) {
    const data = new Date(m.created_at);
    const chave = `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
    const existente = mapa.get(chave);
    if (existente) {
      existente.mensagens.push(m);
    } else {
      mapa.set(chave, { data, mensagens: [m] });
    }
  }

  return Array.from(mapa.values()).map(({ data, mensagens: lista }) => ({
    label: rotuloSeparadorDia(data, agora),
    data,
    mensagens: lista,
  }));
}

/**
 * Retorna se a mensagem foi enviada pelo usuário logado.
 */
export function mensagemEhMinha(m: MensagemAgenda, userId?: string | null): boolean {
  return !!userId && !!m.remetente_id && m.remetente_id === userId;
}
