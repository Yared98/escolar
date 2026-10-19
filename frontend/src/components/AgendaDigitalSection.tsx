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

import { formatarListaNomes } from '@/lib/types/academico';
import { MensagemAgenda, ThreadAgenda, AtendimentoProtocolo, AlunoResumo, TurmaOpcao, FiltroCanal, TipoEnvio, ContatoEscola, tituloTema, agruparThreads, opcoesAlunoPrivado, WhatsappPanel, ComunicacaoPanel, ComposerModal } from './agenda';

const campo =
  'w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600';

export function AgendaDigitalSection() {
  const { user } = useAuth();
  const isResponsavel = (user?.role || '').toLowerCase() === 'responsavel';
  const isProfessor = (user?.role || '').toLowerCase() === 'professor';
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
  const [turmas, setTurmas] = useState<TurmaOpcao[]>([]);
  // Mensagem privada: primeiro a turma, depois o aluno (com o responsável ao lado).
  const [turmaPrivadoId, setTurmaPrivadoId] = useState('');
  const [alunosTurma, setAlunosTurma] = useState<AlunoResumo[]>([]);
  const [carregandoAlunos, setCarregandoAlunos] = useState(false);
  const [buscaAluno, setBuscaAluno] = useState('');
  const [agendaErro, setAgendaErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [filtroCanal, setFiltroCanal] = useState<FiltroCanal>('todos');
  const [busca, setBusca] = useState('');
  // A conversa aberta mora só na URL (&conversa=<id>): o botão voltar do celular funciona e não
  // há estado duplicado para ficar brigando com a URL. Abrir empilha no histórico; fechar substitui.
  const conversaUrl = searchParams ? searchParams.get('conversa') : null;
  const setThreadIdAtiva = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(window.location.search);
      if (id) params.set('conversa', id);
      else params.delete('conversa');
      const q = params.toString();
      const target = q ? `${pathname}?${q}` : pathname;
      if (target === `${window.location.pathname}${window.location.search}`) return;
      if (id) router.push(target, { scroll: false });
      else router.replace(target, { scroll: false });
    },
    [pathname, router],
  );

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
      const [msgData, protoData, turmasData, contatosData] = await Promise.all([
        apiFetch<MensagemAgenda[]>('/agenda/mensagens').catch(() => []),
        apiFetch<AtendimentoProtocolo[]>('/atendimento/protocolos').catch(() => []),
        // Professor só escreve para as próprias turmas; gestão e secretaria veem todas.
        isProfessor
          ? apiFetch<{ turma_id: string; turma_nome: string }[]>('/professor/minhas-turmas')
              .then((lista) => (lista || []).map((t) => ({ id: t.turma_id, nome: t.turma_nome })))
              .catch(() => [])
          : apiFetch<TurmaOpcao[]>('/secretaria/turmas').catch(() => []),
        apiFetch<ContatoEscola[]>('/agenda/contatos-escola').catch(() => []),
      ]);
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
  }, [isProfessor]);

  useEffect(() => {
    if (!composerAberto || tipoEnvio !== 'privado' || !turmaPrivadoId) {
      setAlunosTurma([]);
      return;
    }
    let ativo = true;
    setCarregandoAlunos(true);
    // Lista da turma traz os responsáveis com acesso ao portal (quem recebe de fato a mensagem).
    apiFetch<
      {
        aluno_id: string;
        nome: string;
        nome_responsavel: string;
        responsavel_user_id?: string | null;
        responsavel_nome?: string | null;
        responsaveis_com_acesso?: { id: string; nome: string }[];
      }[]
    >(`/secretaria/turmas/${encodeURIComponent(turmaPrivadoId)}/alunos`)
      .then((lista) => {
        if (!ativo) return;
        setAlunosTurma(
          (lista || []).map((a) => ({
            id: a.aluno_id,
            nome: a.nome,
            nome_responsavel: a.responsavel_nome || a.nome_responsavel,
            responsavel_user_id: a.responsavel_user_id ?? null,
            responsaveis_com_acesso: a.responsaveis_com_acesso,
          })),
        );
      })
      .catch((err: unknown) => {
        if (!ativo) return;
        setAlunosTurma([]);
        setAgendaErro(err instanceof Error ? err.message : 'Não foi possível carregar os alunos da turma.');
      })
      .finally(() => {
        if (ativo) setCarregandoAlunos(false);
      });
    return () => {
      ativo = false;
    };
  }, [composerAberto, tipoEnvio, turmaPrivadoId]);

  const opcoesPrivado = useMemo(
    () => opcoesAlunoPrivado(alunosTurma, buscaAluno),
    [alunosTurma, buscaAluno],
  );

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
      // Mensagem nova só atualiza a lista: não troca a conversa que a pessoa está lendo.
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

  // Conversa aberta = a da URL; sem ela, o desktop mostra a primeira e o celular mostra a lista.
  const threadIdAtiva = conversaUrl ?? (!isMobile && threads.length > 0 ? threads[0].id : null);

  const threadAtiva = useMemo(() => {
    if (!threadIdAtiva) return null;
    return threads.find((t) => t.id === threadIdAtiva) || null;
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
    setTurmaPrivadoId('');
    setBuscaAluno('');
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
      let avisoTexto: string;
      if (tipoEnvio === 'mural') {
        avisoTexto = 'Comunicado publicado no mural da turma.';
      } else if (tipoEnvio === 'familia') {
        avisoTexto = 'Mensagem enviada à escola.';
      } else {
        const nomes =
          created?.destinatarios && created.destinatarios.length > 0
            ? formatarListaNomes(created.destinatarios.map((d) => d.nome))
            : '';
        avisoTexto = nomes
          ? `Mensagem privada enviada para ${nomes}.`
          : 'Mensagem privada enviada aos responsáveis.';
      }
      setAviso(avisoTexto);
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
            <span>{activeTab === 'whatsapp' ? 'WhatsApp' : 'Recados'}</span>
          </h2>
          <p className="text-xs sm:text-sm text-salvia-700 dark:text-salvia-300 mt-1 max-w-2xl">
            {activeTab === 'whatsapp'
              ? 'Fila de atendimento transferida pelo chatbot para resposta humana.'
              : isResponsavel
                ? 'Mensagens com a escola e avisos da turma.'
                : 'Avisos para as turmas e conversas com as famílias.'}
          </p>
        </div>
        {/* Novo recado fica no topo da lista (desktop) e no botão + flutuante (celular), dentro do painel. */}
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
          turmaPrivadoId={turmaPrivadoId}
          setTurmaPrivadoId={(id) => {
            setTurmaPrivadoId(id);
            setAlunoId('');
            setBuscaAluno('');
          }}
          opcoesPrivado={opcoesPrivado}
          totalAlunosTurma={alunosTurma.length}
          carregandoAlunos={carregandoAlunos}
          buscaAluno={buscaAluno}
          setBuscaAluno={setBuscaAluno}
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
