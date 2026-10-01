'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useMensagensRealtime } from '@/lib/realtime';
import { ensurePushReady, notifyNovaMensagem } from '@/lib/push';
import {
  Megaphone,
  MessageCircle,
  Plus,
  Search,
  Send,
  Users,
  Lock,
  X,
  Inbox,
} from 'lucide-react';

interface MensagemAgenda {
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

interface ThreadAgenda {
  id: string;
  raiz: MensagemAgenda;
  mensagens: MensagemAgenda[];
  respostas: number;
  ultima: MensagemAgenda;
  temNaoLida: boolean;
}

interface AtendimentoProtocolo {
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

interface AlunoResumo {
  id: string;
  nome: string;
  nome_responsavel: string;
  responsavel_user_id?: string | null;
}

interface TurmaOpcao {
  id: string;
  nome: string;
}

type FiltroCanal = 'todos' | 'mural' | 'privado' | 'coordenacao' | 'professor';
type TipoEnvio = 'mural' | 'privado' | 'familia';

interface ContatoEscola {
  id: string;
  name: string;
  email: string;
  role: string;
}

const campo =
  'w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600';

const rotuloCanal = (canal: string) => {
  switch (canal) {
    case 'mural_turma':
      return 'Mural';
    case 'professor':
      return 'Privado';
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

const estiloCanal = (canal: string) => {
  if (canal === 'mural_turma') return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200';
  if (canal === 'professor' || canal === 'responsavel') return 'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200';
  if (canal === 'coordenacao') return 'bg-salvia-100 text-salvia-900 dark:bg-salvia-900/60 dark:text-salvia-200';
  if (canal === 'financeiro') return 'bg-violet-100 text-violet-900';
  if (canal === 'nutricao') return 'bg-emerald-100 text-emerald-900';
  return 'bg-slate-200 text-slate-700';
};

const formatarQuando = (iso: string) => {
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

const tituloTema = (titulo: string) => titulo.replace(/^(Re:\s*)+/i, '').trim() || titulo;

const threadKeyOf = (m: MensagemAgenda) => m.thread_id || m.resposta_a_id || m.id;

const agruparThreads = (msgs: MensagemAgenda[]): ThreadAgenda[] => {
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

export function AgendaDigitalSection() {
  const { user } = useAuth();
  const isResponsavel = (user?.role || '').toLowerCase() === 'responsavel';
  const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeTab: 'comunicacao' | 'whatsapp' =
    tabParam === 'whatsapp' ? 'whatsapp' : 'comunicacao';

  const [mensagens, setMensagens] = useState<MensagemAgenda[]>([]);
  const [protocolos, setProtocolos] = useState<AtendimentoProtocolo[]>([]);
  const [alunos, setAlunos] = useState<AlunoResumo[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpcao[]>([]);
  const [agendaErro, setAgendaErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [filtroCanal, setFiltroCanal] = useState<FiltroCanal>('todos');
  const [busca, setBusca] = useState('');
  const [threadIdAtiva, setThreadIdAtiva] = useState<string | null>(null);

  const [composerAberto, setComposerAberto] = useState(false);
  const [tipoEnvio, setTipoEnvio] = useState<TipoEnvio>('mural');
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [contatos, setContatos] = useState<ContatoEscola[]>([]);
  const [enviando, setEnviando] = useState(false);

  const [respostaZap, setRespostaZap] = useState<Record<string, string>>({});
  const [filtroZap, setFiltroZap] = useState<'abertos' | 'todos'>('abertos');
  const [respostaTexto, setRespostaTexto] = useState('');
  const [respondendo, setRespondendo] = useState(false);

  const loadAgendaData = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setCarregando(true);
      const [msgData, protoData, alunosData, turmasData, contatosData] = await Promise.all([
        apiFetch<MensagemAgenda[]>('/agenda/mensagens').catch(() => []),
        apiFetch<AtendimentoProtocolo[]>('/atendimento/protocolos').catch(() => []),
        apiFetch<{ items: AlunoResumo[] }>('/secretaria/alunos?status=ativo&limit=200')
          .then((page) => page.items || [])
          .catch(() => []),
        apiFetch<TurmaOpcao[]>('/secretaria/turmas').catch(() => []),
        apiFetch<ContatoEscola[]>('/agenda/contatos-escola').catch(() => []),
      ]);
      setAlunos(alunosData || []);
      setTurmas(turmasData || []);
      setMensagens(msgData || []);
      setProtocolos(protoData || []);
      setContatos(contatosData || []);
      setAgendaErro(null);
    } catch (err: unknown) {
      setAgendaErro(err instanceof Error ? err.message : 'Não foi possível carregar a agenda.');
    } finally {
      if (!opts?.silent) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    loadAgendaData();
    void ensurePushReady();
  }, [loadAgendaData]);

  useMensagensRealtime(activeTab === 'comunicacao', {
    onMensagemNova: (payload) => {
      void loadAgendaData({ silent: true });
      if (payload.remetente_id !== user?.id) {
        void notifyNovaMensagem(
          payload.titulo || 'Nova mensagem',
          payload.conteudo?.slice(0, 120) || 'Você recebeu uma nova mensagem na agenda.',
          '/?route=agenda&tab=comunicacao',
        );
      }
      if (payload.thread_id) {
        setThreadIdAtiva(payload.thread_id);
      }
    },
    onResync: () => {
      void loadAgendaData({ silent: true });
    },
  });

  const nomeTurma = useCallback(
    (id?: string | null) => {
      if (!id) return 'Toda a escola';
      return turmas.find((t) => t.id === id)?.nome || 'Turma';
    },
    [turmas],
  );

  const alunosComResponsavel = useMemo(
    () => alunos.filter((a) => a.responsavel_user_id),
    [alunos],
  );

  const alunosPrivado = useMemo(
    () => (alunosComResponsavel.length > 0 ? alunosComResponsavel : alunos),
    [alunos, alunosComResponsavel],
  );

  const threads = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todas = agruparThreads(mensagens);
    return todas.filter((t) => {
      const canalRaiz = t.raiz.canal;
      if (filtroCanal === 'mural' && canalRaiz !== 'mural_turma') return false;
      if (filtroCanal === 'privado' && canalRaiz !== 'professor' && canalRaiz !== 'responsavel') return false;
      if (filtroCanal === 'coordenacao' && canalRaiz !== 'coordenacao') return false;
      if (filtroCanal === 'professor' && canalRaiz !== 'professor' && canalRaiz !== 'responsavel') return false;
      if (!termo) return true;
      return t.mensagens.some(
        (m) =>
          m.titulo.toLowerCase().includes(termo) ||
          m.conteudo.toLowerCase().includes(termo) ||
          (m.remetente_nome || '').toLowerCase().includes(termo) ||
          tituloTema(m.titulo).toLowerCase().includes(termo),
      );
    });
  }, [mensagens, filtroCanal, busca]);

  const threadAtiva = useMemo(() => {
    if (!threadIdAtiva) return null;
    return threads.find((t) => t.id === threadIdAtiva) || null;
  }, [threads, threadIdAtiva]);

  useEffect(() => {
    if (threadIdAtiva && !threads.some((t) => t.id === threadIdAtiva)) {
      setThreadIdAtiva(threads[0]?.id || null);
    }
  }, [threads, threadIdAtiva]);

  const protocolosFiltrados = useMemo(() => {
    if (filtroZap === 'todos') return protocolos;
    return protocolos.filter((p) => p.status !== 'finalizado');
  }, [protocolos, filtroZap]);

  const abrirThread = async (thread: ThreadAgenda) => {
    setThreadIdAtiva(thread.id);
    setRespostaTexto('');
    const naoLidas = thread.mensagens.filter((m) => !m.lida);
    if (naoLidas.length === 0) return;
    try {
      await Promise.all(
        naoLidas.slice(0, 12).map((m) =>
          apiFetch(`/agenda/mensagens/${m.id}/lida`, { method: 'POST' }).catch(() => null),
        ),
      );
      const ids = new Set(naoLidas.map((m) => m.id));
      setMensagens((prev) => prev.map((item) => (ids.has(item.id) ? { ...item, lida: true } : item)));
    } catch {
      // leitura é best-effort
    }
  };

  const handleResponderMensagem = async () => {
    if (!threadAtiva || !respostaTexto.trim()) return;
    setRespondendo(true);
    setAgendaErro(null);
    try {
      await apiFetch('/agenda/mensagens', {
        method: 'POST',
        body: JSON.stringify({
          canal: isResponsavel ? 'responsavel' : 'professor',
          titulo: tituloTema(threadAtiva.raiz.titulo),
          conteudo: respostaTexto.trim(),
          destinatario_id: null,
          aluno_id: null,
          turma_id: threadAtiva.raiz.turma_id || null,
          resposta_a_id: threadAtiva.raiz.id,
          anexo_url: null,
        }),
      });
      setAviso('Resposta enviada na thread.');
      setRespostaTexto('');
      const tid = threadAtiva.id;
      await loadAgendaData();
      setThreadIdAtiva(tid);
    } catch (err: unknown) {
      setAgendaErro(err instanceof Error ? err.message : 'Não foi possível responder.');
    } finally {
      setRespondendo(false);
    }
  };

  const abrirComposer = (tipo: TipoEnvio = 'mural') => {
    setTipoEnvio(tipo);
    setTitulo('');
    setConteudo('');
    setTurmaId(turmas[0]?.id || '');
    setAlunoId('');
    setDestinatarioId(contatos[0]?.id || '');
    setComposerAberto(true);
    setAviso(null);
  };

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !conteudo.trim()) return;

    if (tipoEnvio === 'mural' && !turmaId) {
      setAgendaErro('Selecione a turma do mural.');
      return;
    }
    if (tipoEnvio === 'privado') {
      if (!alunoId) {
        setAgendaErro('Selecione o aluno do responsável.');
        return;
      }
    }
    if (tipoEnvio === 'familia' && !destinatarioId) {
      setAgendaErro('Selecione o professor ou a coordenação.');
      return;
    }

    setEnviando(true);
    setAgendaErro(null);
    try {
      const created = await apiFetch<MensagemAgenda>('/agenda/mensagens', {
        method: 'POST',
        body: JSON.stringify({
          canal:
            tipoEnvio === 'mural'
              ? 'mural_turma'
              : tipoEnvio === 'familia'
                ? 'responsavel'
                : 'professor',
          titulo: titulo.trim(),
          conteudo: conteudo.trim(),
          destinatario_id: tipoEnvio === 'familia' ? destinatarioId : null,
          aluno_id: tipoEnvio === 'privado' ? alunoId : null,
          turma_id: tipoEnvio === 'mural' ? turmaId : null,
          anexo_url: null,
        }),
      });
      setAviso(
        tipoEnvio === 'mural'
          ? 'Comunicado publicado no mural da turma.'
          : tipoEnvio === 'familia'
            ? 'Mensagem enviada à escola.'
            : 'Mensagem privada enviada ao responsável.',
      );
      setComposerAberto(false);
      setTitulo('');
      setConteudo('');
      await loadAgendaData({ silent: true });
      if (created?.thread_id || created?.id) {
        setThreadIdAtiva(created.thread_id || created.id);
      }
    } catch (err: unknown) {
      setAgendaErro(err instanceof Error ? err.message : 'Não foi possível enviar o comunicado.');
    } finally {
      setEnviando(false);
    }
  };

  const handleResponderProtocolo = async (id: string) => {
    const resp = respostaZap[id];
    if (!resp?.trim()) return;
    try {
      await apiFetch(`/atendimento/protocolos/${id}/responder`, {
        method: 'POST',
        body: JSON.stringify({ resposta: resp }),
      });
      setRespostaZap((prev) => ({ ...prev, [id]: '' }));
      setAviso('Resposta enviada e protocolo finalizado.');
      await loadAgendaData();
    } catch (err: unknown) {
      setAgendaErro(err instanceof Error ? err.message : 'Não foi possível responder o protocolo.');
    }
  };

  return (
    <section className="space-y-5 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-salvia-200 dark:border-salvia-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-salvia-50 flex items-center gap-2">
            {activeTab === 'whatsapp' ? (
              <MessageCircle className="w-6 h-6 text-emerald-600" />
            ) : (
              <Megaphone className="w-6 h-6 text-salvia-600 dark:text-salvia-400" />
            )}
            <span>{activeTab === 'whatsapp' ? 'WhatsApp' : 'Comunicados'}</span>
          </h2>
          <p className="text-xs sm:text-sm text-salvia-700 dark:text-salvia-300 mt-1 max-w-2xl">
            {activeTab === 'whatsapp'
              ? 'Fila de atendimento transferida pelo chatbot para resposta humana.'
              : isResponsavel
                ? 'Escolha um tema à esquerda e acompanhe a conversa à direita.'
                : 'Temas à esquerda; thread completa com respostas à direita.'}
          </p>
        </div>
        {activeTab === 'comunicacao' && (
          <button
            type="button"
            onClick={() => abrirComposer(isResponsavel ? 'familia' : 'mural')}
            className="bg-salvia-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-salvia-800 flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            {isResponsavel ? 'Nova mensagem à escola' : 'Novo comunicado'}
          </button>
        )}
      </div>

      {agendaErro && <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{agendaErro}</p>}
      {aviso && <p className="text-xs font-semibold text-salvia-800 dark:text-salvia-200">{aviso}</p>}

      {activeTab === 'comunicacao' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full max-w-lg overflow-x-auto">
              {([
                ['todos', 'Todos'],
                ['mural', 'Mural'],
                ['privado', 'Privadas'],
                ['coordenacao', 'Coordenação'],
              ] as const).map(([id, rotulo]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFiltroCanal(id)}
                  className={`flex-1 min-w-[4.5rem] py-1.5 px-2 text-xs font-bold rounded-lg whitespace-nowrap ${
                    filtroCanal === id ? 'bg-salvia-700 text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <label className="relative block w-full max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar temas ou mensagens…"
                className={`${campo} pl-8`}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] gap-0 xl:gap-0 items-stretch border border-salvia-200 dark:border-salvia-800 rounded-2xl overflow-hidden bg-white dark:bg-salvia-900 min-h-[28rem]">
            {/* Lista de temas */}
            <div className="border-b xl:border-b-0 xl:border-r border-salvia-200 dark:border-salvia-800 flex flex-col min-h-[14rem] max-h-[36rem]">
              <div className="px-4 py-3 border-b border-salvia-100 dark:border-salvia-800 flex justify-between items-center shrink-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Temas ({threads.length})
                </p>
                <div className="flex gap-2">
                  {isResponsavel ? (
                    <button
                      type="button"
                      onClick={() => abrirComposer('familia')}
                      className="text-[11px] font-bold text-salvia-800 dark:text-salvia-200 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Nova
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => abrirComposer('mural')}
                        className="text-[11px] font-bold text-salvia-800 dark:text-salvia-200 inline-flex items-center gap-1"
                      >
                        <Users className="w-3 h-3" /> Mural
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirComposer('privado')}
                        className="text-[11px] font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"
                      >
                        <Lock className="w-3 h-3" /> Privada
                      </button>
                    </>
                  )}
                </div>
              </div>

              {carregando ? (
                <p className="p-6 text-xs text-slate-500">Carregando conversas…</p>
              ) : threads.length === 0 ? (
                <div className="p-8 text-center space-y-2 flex-1 flex flex-col justify-center">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nada por aqui</p>
                  <p className="text-xs text-slate-500">
                    {busca || filtroCanal !== 'todos'
                      ? 'Nenhum tema com esses filtros.'
                      : 'Publique o primeiro mural ou mensagem privada.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-salvia-100 dark:divide-salvia-800 overflow-y-auto flex-1">
                  {threads.map((t) => {
                    const ativa = threadIdAtiva === t.id;
                    const preview =
                      t.respostas > 0 ? t.ultima.conteudo : t.raiz.conteudo;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => abrirThread(t)}
                          className={`w-full text-left px-4 py-3 space-y-1.5 transition-colors ${
                            ativa
                              ? 'bg-salvia-50 dark:bg-salvia-950/50 border-l-2 border-l-salvia-600'
                              : 'hover:bg-slate-50 dark:hover:bg-salvia-950/30 border-l-2 border-l-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estiloCanal(t.raiz.canal)}`}>
                                  {rotuloCanal(t.raiz.canal)}
                                </span>
                                {t.respostas > 0 && (
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {t.respostas} resp.
                                  </span>
                                )}
                                {t.temNaoLida && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                    Nova
                                  </span>
                                )}
                              </div>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {tituloTema(t.raiz.titulo)}
                              </h3>
                              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                                {t.ultima.remetente_nome ? `${t.ultima.remetente_nome}: ` : ''}
                                {preview}
                              </p>
                              {t.raiz.turma_id && (
                                <p className="text-[10px] text-slate-500">{nomeTurma(t.raiz.turma_id)}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap font-medium">
                              {formatarQuando(t.ultima.created_at)}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Painel da thread */}
            <aside className="flex flex-col min-h-[18rem] max-h-[36rem] bg-slate-50/40 dark:bg-[#0c120e]/40">
              {threadAtiva ? (
                <>
                  <div className="px-4 py-3 border-b border-salvia-100 dark:border-salvia-800 bg-white dark:bg-salvia-900 shrink-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estiloCanal(threadAtiva.raiz.canal)}`}>
                        {rotuloCanal(threadAtiva.raiz.canal)}
                      </span>
                      {threadAtiva.raiz.turma_id && (
                        <span className="text-[10px] text-slate-500">{nomeTurma(threadAtiva.raiz.turma_id)}</span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {threadAtiva.respostas} resposta{threadAtiva.respostas === 1 ? '' : 's'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {tituloTema(threadAtiva.raiz.titulo)}
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {threadAtiva.mensagens.map((m, idx) => {
                      const isRoot = idx === 0 || m.id === threadAtiva.raiz.id;
                      return (
                        <div
                          key={m.id}
                          className={`rounded-xl px-3.5 py-3 space-y-1.5 ${
                            isRoot && m.id === threadAtiva.raiz.id
                              ? 'bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 shadow-sm'
                              : 'bg-white/80 dark:bg-salvia-900/70 border border-salvia-100 dark:border-salvia-800 ml-3'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-salvia-50 truncate">
                                {m.remetente_nome || 'Usuário'}
                                {m.remetente_role ? (
                                  <span className="font-medium text-slate-500"> · {m.remetente_role}</span>
                                ) : null}
                              </p>
                              {m.id === threadAtiva.raiz.id && (
                                <span className="text-[10px] font-bold text-salvia-700 dark:text-salvia-300">
                                  Mensagem inicial
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                              {formatarQuando(m.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {m.conteudo}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-4 py-3 border-t border-salvia-100 dark:border-salvia-800 bg-white dark:bg-salvia-900 shrink-0 space-y-2">
                    <textarea
                      value={respostaTexto}
                      onChange={(e) => setRespostaTexto(e.target.value)}
                      rows={2}
                      placeholder="Responder nesta conversa…"
                      className={campo}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={respondendo || !respostaTexto.trim()}
                        onClick={handleResponderMensagem}
                        className="inline-flex items-center gap-1.5 bg-salvia-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-salvia-800 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {respondendo ? 'Enviando…' : 'Enviar na thread'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-16 px-6">
                  <MessageCircle className="w-8 h-8 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Selecione um tema</p>
                  <p className="text-xs text-slate-500 max-w-[16rem]">
                    À direita aparece a conversa completa — mensagem inicial e respostas, como no Slack.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      {activeTab === 'whatsapp' && (
        <div className="space-y-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full max-w-xs">
            <button
              type="button"
              onClick={() => setFiltroZap('abertos')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${filtroZap === 'abertos' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            >
              Em aberto
            </button>
            <button
              type="button"
              onClick={() => setFiltroZap('todos')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${filtroZap === 'todos' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            >
              Todos
            </button>
          </div>

          {protocolosFiltrados.length === 0 ? (
            <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-8 text-center space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Fila vazia</p>
              <p className="text-xs text-slate-500">Nenhum protocolo aguardando resposta humana.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {protocolosFiltrados.map((p) => (
                <article
                  key={p.id}
                  className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap justify-between gap-2 items-start">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{p.protocolo}</h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            p.status === 'finalizado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {p.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {p.telefone_contato} · {p.setor_transbordo || 'Geral'} · {formatarQuando(p.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-[#0c120e] border border-slate-100 dark:border-slate-800 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Última mensagem</p>
                    <p className="text-xs text-slate-800 dark:text-slate-200">{p.ultima_mensagem || p.assunto}</p>
                  </div>

                  {p.status === 'finalizado' ? (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Resposta enviada</p>
                      <p className="text-xs text-emerald-950 dark:text-emerald-100">{p.resposta_enviada}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        value={respostaZap[p.id] || ''}
                        onChange={(e) => setRespostaZap((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="Resposta ao responsável via WhatsApp…"
                        className={`${campo} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => handleResponderProtocolo(p.id)}
                        disabled={!respostaZap[p.id]?.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Responder
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {composerAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <form
            onSubmit={handleEnviarMensagem}
            className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {tipoEnvio === 'familia' ? 'Mensagem à escola' : 'Novo comunicado'}
              </h3>
              <button type="button" onClick={() => setComposerAberto(false)} aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isResponsavel && (
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTipoEnvio('mural')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg inline-flex items-center justify-center gap-1 ${tipoEnvio === 'mural' ? 'bg-salvia-700 text-white' : ''}`}
                >
                  <Users className="w-3.5 h-3.5" /> Mural da turma
                </button>
                <button
                  type="button"
                  onClick={() => setTipoEnvio('privado')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg inline-flex items-center justify-center gap-1 ${tipoEnvio === 'privado' ? 'bg-salvia-700 text-white' : ''}`}
                >
                  <Lock className="w-3.5 h-3.5" /> Privada 1:1
                </button>
              </div>
            )}

            {tipoEnvio === 'familia' && (
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-600">
                  Destinatário (professor da turma, gestão ou financeiro)
                </span>
                <select
                  value={destinatarioId}
                  onChange={(e) => setDestinatarioId(e.target.value)}
                  className={campo}
                  required
                >
                  <option value="">Selecione…</option>
                  {contatos.map((c) => {
                    const papel = (() => {
                      const r = (c.role || '').toLowerCase().replace(/\s+/g, '');
                      if (r === 'professor') return 'Professor(a) da turma';
                      if (r === 'financeiro') return 'Financeiro';
                      if (r === 'secretaria') return 'Secretaria';
                      if (r === 'gestor' || r === 'gestorescolar') return 'Gestão / Diretoria';
                      if (r === 'admin' || r === 'superadmin') return 'Diretoria';
                      return c.role;
                    })();
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} · {papel}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
            {tipoEnvio === 'mural' && (
              <label className="block text-[11px] font-bold">Turma
                <select required value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={`${campo} mt-1`}>
                  <option value="">Selecione</option>
                  {turmas.map((turma) => (
                    <option key={turma.id} value={turma.id}>{turma.nome}</option>
                  ))}
                </select>
              </label>
            )}
            {tipoEnvio === 'privado' && (
              <label className="block text-[11px] font-bold">Aluno / responsável
                <select required value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className={`${campo} mt-1`} disabled={alunosPrivado.length === 0}>
                  <option value="">{alunosPrivado.length === 0 ? 'Nenhum aluno disponível' : 'Selecione'}</option>
                  {alunosPrivado.map((aluno) => (
                    <option key={aluno.id} value={aluno.id}>
                      {aluno.nome_responsavel} — {aluno.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {tipoEnvio === 'privado' && alunos.length > 0 && alunosComResponsavel.length === 0 && (
              <p className="text-[11px] text-amber-800 dark:text-amber-200">
                O envio usa o vínculo do responsável na Secretaria. Se falhar, vincule o responsável ao portal.
              </p>
            )}

            <label className="block text-[11px] font-bold">Título
              <input
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Reunião de pais na sexta"
                className={`${campo} mt-1`}
              />
            </label>

            <label className="block text-[11px] font-bold">Mensagem
              <textarea
                required
                rows={5}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Escreva o comunicado com clareza. Evite jargão."
                className={`${campo} mt-1`}
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setComposerAberto(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-salvia-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {enviando ? 'Enviando…' : 'Publicar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
