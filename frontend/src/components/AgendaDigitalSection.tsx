'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useMensagensRealtime } from '@/lib/realtime';
import { ensurePushReady, notifyNovaMensagem } from '@/lib/push';
import {
  Megaphone,
  MessageCircle,
  Plus,
} from 'lucide-react';

import { MensagemAgenda, ThreadAgenda, AtendimentoProtocolo, AlunoResumo, TurmaOpcao, FiltroCanal, TipoEnvio, ContatoEscola, tituloTema, agruparThreads, WhatsappPanel, ComunicacaoPanel, ComposerModal } from './agenda';

const campo =
  'w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600';

export function AgendaDigitalSection() {
  const { user } = useAuth();
  const isResponsavel = (user?.role || '').toLowerCase() === 'responsavel';
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeTab: 'comunicacao' | 'whatsapp' =
    tabParam === 'whatsapp' ? 'whatsapp' : 'comunicacao';

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    setIsMobile(media.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

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

  // Sincroniza conversa aberta com a URL (&conversa=<id>)
  const queryString = searchParams ? searchParams.toString() : '';
  useEffect(() => {
    const params = new URLSearchParams(queryString);
    const idFromUrl = params.get('conversa');

    if (idFromUrl && threads.some((t) => t.id === idFromUrl)) {
      setThreadIdAtiva(idFromUrl);
    } else if (!idFromUrl) {
      // No desktop mantém auto-seleção da primeira conversa; no celular fica vazio.
      if (!isMobile && threads.length > 0) {
        setThreadIdAtiva(threads[0].id);
      } else {
        setThreadIdAtiva(null);
      }
    } else {
      setThreadIdAtiva(null);
    }
  }, [queryString, threads, isMobile]);

  useEffect(() => {
    if (!router || !searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    if (threadIdAtiva) {
      params.set('conversa', threadIdAtiva);
    } else {
      params.delete('conversa');
    }
    const targetUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (targetUrl !== currentUrl) {
      router.replace(targetUrl, { scroll: false });
    }
  }, [threadIdAtiva, router, searchParams, pathname]);

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

  const voltarParaLista = () => {
    setThreadIdAtiva(null);
    setRespostaTexto('');
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
                ? 'Escolha uma conversa à esquerda e acompanhe as mensagens à direita.'
                : 'Conversas à esquerda; mensagens completas à direita.'}
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
        <ComunicacaoPanel
          filtroCanal={filtroCanal}
          setFiltroCanal={setFiltroCanal}
          busca={busca}
          setBusca={setBusca}
          threads={threads}
          isResponsavel={isResponsavel}
          abrirComposer={abrirComposer}
          carregando={carregando}
          threadIdAtiva={threadIdAtiva}
          abrirThread={abrirThread}
          nomeTurma={nomeTurma}
          threadAtiva={threadAtiva}
          respostaTexto={respostaTexto}
          setRespostaTexto={setRespostaTexto}
          respondendo={respondendo}
          handleResponderMensagem={handleResponderMensagem}
          onVoltar={voltarParaLista}
          isMobile={isMobile}
        />
      )}

      {activeTab === 'whatsapp' && (
        <WhatsappPanel
          filtroZap={filtroZap}
          setFiltroZap={setFiltroZap}
          protocolosFiltrados={protocolosFiltrados}
          respostaZap={respostaZap}
          setRespostaZap={setRespostaZap}
          handleResponderProtocolo={handleResponderProtocolo}
          campo={campo}
        />
      )}

      {composerAberto && (
        <ComposerModal
          composerAberto={composerAberto}
          setComposerAberto={setComposerAberto}
          handleEnviarMensagem={handleEnviarMensagem}
          tipoEnvio={tipoEnvio}
          setTipoEnvio={setTipoEnvio}
          isResponsavel={isResponsavel}
          destinatarioId={destinatarioId}
          setDestinatarioId={setDestinatarioId}
          contatos={contatos}
          turmaId={turmaId}
          setTurmaId={setTurmaId}
          turmas={turmas}
          alunoId={alunoId}
          setAlunoId={setAlunoId}
          alunosPrivado={alunosPrivado}
          alunos={alunos}
          alunosComResponsavel={alunosComResponsavel}
          titulo={titulo}
          setTitulo={setTitulo}
          conteudo={conteudo}
          setConteudo={setConteudo}
          enviando={enviando}
          campo={campo}
        />
      )}
    </section>
  );
}
