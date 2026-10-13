'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useMensagensRealtime } from '@/lib/realtime';
import { ensurePushReady, notifyNovaMensagem } from '@/lib/push';
import { useAuth } from '@/context/AuthContext';
import {
  Camera,
  Baby,
  ChevronDown,
  Star,
  Sparkles,
  AlertCircle,
  FileText,
  CreditCard,
  Award,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import type { DiarioInfantilDia } from '@/lib/types/academico';

import { AlunoVinculado, DisciplinaBoletim, PortfolioInfantil, BoletimData, FaturaData, DiplomaData, MensagemPortal, ThreadPortal, tituloTemaPortal, agruparThreadsPortal, BoletimTab, FinanceiroTab, PixModal, DiplomaTab, RotinaTab, AvaliacoesTab } from './portal_aluno';
import type { AvaliacaoCalendario } from '@/lib/types/academico';

import { useSearchParams } from 'next/navigation';

export function PortalAlunoSection() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeTab: 'portal_boletim' | 'portal_financeiro' | 'portal_diploma' | 'portal_rotina' | 'portal_portfolio' | 'portal_avaliacoes' =
    tabParam === 'portal_financeiro' || tabParam === 'portal_diploma' || tabParam === 'portal_rotina' || tabParam === 'portal_portfolio' || tabParam === 'portal_avaliacoes'
      ? tabParam
      : 'portal_boletim';
  const [alunos, setAlunos] = useState<AlunoVinculado[]>([]);
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>('');
  const [selectedAlunoNome, setSelectedAlunoNome] = useState<string>('Carregando aluno...');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dados específicos
  const [boletim, setBoletim] = useState<BoletimData | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioInfantil[]>([]);
  const [faturas, setFaturas] = useState<FaturaData[]>([]);
  const [diploma, setDiploma] = useState<DiplomaData | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const agora = new Date();
    return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  });
  const [mensagens, setMensagens] = useState<MensagemPortal[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoCalendario[]>([]);
  const [diarioInfantil, setDiarioInfantil] = useState<DiarioInfantilDia | null>(null);
  const [threadIdAtiva, setThreadIdAtiva] = useState<string | null>(null);
  const [respostaTexto, setRespostaTexto] = useState('');
  const [enviandoResposta, setEnviandoResposta] = useState(false);
  const [avisoMsg, setAvisoMsg] = useState<string | null>(null);

  // Modal Pix
  const [pixModalFatura, setPixModalFatura] = useState<FaturaData | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [filtroStatusFatura, setFiltroStatusFatura] = useState<'abertas' | 'pagas' | 'todas'>('abertas');

  // 1. Carregar dependentes do responsável
  const loadAlunos = useCallback(async () => {
    try {
      const data = await apiFetch<AlunoVinculado[]>('/secretaria/alunos/meus');
      if (data && data.length > 0) {
        setAlunos(data);
        setSelectedAlunoId(data[0].id);
        setSelectedAlunoNome(data[0].nome);
        setErrorMsg(null);
      } else {
        setAlunos([]);
        setSelectedAlunoId('');
        setSelectedAlunoNome('Nenhum aluno vinculado');
      }
    } catch (err: unknown) {
      setAlunos([]);
      setSelectedAlunoId('');
      setSelectedAlunoNome('Nenhum aluno vinculado');
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível carregar os alunos vinculados.');
    }
  }, []);

  useEffect(() => {
    loadAlunos();
  }, [loadAlunos]);

  // 2. Carregar dados da aba ativa quando aluno selecionado mudar
  const loadTabData = useCallback(async () => {
    if (!selectedAlunoId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      if (activeTab === 'portal_boletim') {
        const data = await apiFetch<BoletimData>(`/academico/boletim/${selectedAlunoId}`);
        setBoletim(data);
      } else if (activeTab === 'portal_portfolio') {
        try {
          const data = await apiFetch<PortfolioInfantil[]>(`/pedagogico/portfolio/${selectedAlunoId}`);
          setPortfolios(data);
        } catch (err: unknown) {
          setPortfolios([]);
          setErrorMsg(err instanceof Error ? err.message : 'Não foi possível carregar o portfólio.');
        }
      } else if (activeTab === 'portal_financeiro') {
        const data = await apiFetch<FaturaData[]>('/financeiro/faturas');
        setFaturas(data || []);
      } else if (activeTab === 'portal_diploma') {
        const data = await apiFetch<{ status: string; diploma?: DiplomaData }>(
          `/regulatorio/diploma-digital/${selectedAlunoId}`
        );
        if (data && data.diploma) {
          setDiploma(data.diploma);
        } else {
          setDiploma(null);
        }
      } else if (activeTab === 'portal_avaliacoes') {
        // O servidor já devolve só as avaliações das turmas dos filhos.
        // Se falhar, a lista fica vazia e o erro aparece no aviso da seção.
        setAvaliacoes([]);
        const data = await apiFetch<AvaliacaoCalendario[]>('/avaliacoes');
        setAvaliacoes(data || []);
      } else if (activeTab === 'portal_rotina') {
        const [diario, msgs] = await Promise.all([
          apiFetch<DiarioInfantilDia>(
            `/agenda/diario-infantil/${selectedAlunoId}?data=${encodeURIComponent(selectedDate)}`
          ),
          apiFetch<MensagemPortal[]>('/agenda/mensagens').catch(() => []),
        ]);
        setDiarioInfantil(diario);
        setMensagens(msgs || []);
        // Marca privadas não lidas como lidas ao abrir a aba
        const naoLidas = (msgs || []).filter((m) => !m.lida && m.canal !== 'mural_turma');
        if (naoLidas.length > 0) {
          await Promise.all(
            naoLidas.slice(0, 8).map((m) =>
              apiFetch(`/agenda/mensagens/${m.id}/lida`, { method: 'POST' }).catch(() => null),
            ),
          );
          setMensagens((prev) =>
            prev.map((m) => (naoLidas.some((n) => n.id === m.id) ? { ...m, lida: true } : m)),
          );
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedAlunoId, activeTab, selectedDate]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  useEffect(() => {
    if (activeTab === 'portal_rotina') {
      void ensurePushReady();
    }
  }, [activeTab]);

  useMensagensRealtime(activeTab === 'portal_rotina', {
    onMensagemNova: (payload) => {
      void apiFetch<MensagemPortal[]>('/agenda/mensagens')
        .then((msgs) => setMensagens(msgs || []))
        .catch(() => undefined);
      if (payload.remetente_id !== user?.id) {
        void notifyNovaMensagem(
          payload.titulo || 'Nova mensagem da escola',
          payload.conteudo?.slice(0, 120) || 'Há um novo recado no portal.',
          '/?route=portal_aluno&tab=portal_rotina',
        );
      }
      if (payload.thread_id) setThreadIdAtiva(payload.thread_id);
    },
    onResync: () => {
      void apiFetch<MensagemPortal[]>('/agenda/mensagens')
        .then((msgs) => setMensagens(msgs || []))
        .catch(() => undefined);
    },
  });

  const handleSelectAluno = (aluno: AlunoVinculado) => {
    setSelectedAlunoId(aluno.id);
    setSelectedAlunoNome(aluno.nome);
  };

  const threadsPortal = useMemo(() => agruparThreadsPortal(mensagens), [mensagens]);

  const faturasAbertas = useMemo(
    () => faturas.filter((f) => f.status === 'pendente' || f.status === 'atrasado'),
    [faturas]
  );
  const faturasPagas = useMemo(
    () => faturas.filter((f) => f.status === 'pago'),
    [faturas]
  );
  const faturasExibidas = useMemo(() => {
    if (filtroStatusFatura === 'abertas') return faturasAbertas;
    if (filtroStatusFatura === 'pagas') return faturasPagas;
    return faturas;
  }, [filtroStatusFatura, faturasAbertas, faturasPagas, faturas]);

  const threadPortalAtiva = useMemo(() => {
    if (!threadIdAtiva) return null;
    return threadsPortal.find((t) => t.id === threadIdAtiva) || null;
  }, [threadsPortal, threadIdAtiva]);

  useEffect(() => {
    if (threadIdAtiva && !threadsPortal.some((t) => t.id === threadIdAtiva)) {
      setThreadIdAtiva(threadsPortal[0]?.id || null);
    } else if (!threadIdAtiva && threadsPortal.length > 0) {
      setThreadIdAtiva(threadsPortal[0].id);
    }
  }, [threadsPortal, threadIdAtiva]);

  const handleCopyPix = (pixCode: string) => {
    navigator.clipboard.writeText(pixCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleResponderThread = async () => {
    if (!threadPortalAtiva || !respostaTexto.trim()) return;
    setEnviandoResposta(true);
    setAvisoMsg(null);
    setErrorMsg(null);
    try {
      await apiFetch('/agenda/mensagens', {
        method: 'POST',
        body: JSON.stringify({
          canal: 'responsavel',
          titulo: tituloTemaPortal(threadPortalAtiva.raiz.titulo),
          conteudo: respostaTexto.trim(),
          destinatario_id: null,
          aluno_id: null,
          turma_id: threadPortalAtiva.raiz.turma_id || null,
          resposta_a_id: threadPortalAtiva.raiz.id,
          anexo_url: null,
        }),
      });
      setAvisoMsg('Resposta enviada na conversa.');
      setRespostaTexto('');
      const tid = threadPortalAtiva.id;
      const msgs = await apiFetch<MensagemPortal[]>('/agenda/mensagens').catch(() => []);
      setMensagens(msgs || []);
      setThreadIdAtiva(tid);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível enviar a resposta.');
    } finally {
      setEnviandoResposta(false);
    }
  };

  const formatarQuando = (iso: string) => {
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return iso;
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <section
      id="portal-aluno"
      className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 sm:p-6 shadow-sm transition-all space-y-6 max-w-5xl mx-auto"
    >
      {/* 1. Header do Portal com Seletor de Dependentes */}
      <div className="bg-salvia-50/80 dark:bg-salvia-950/80 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="p-3 bg-salvia-200 dark:bg-salvia-800 rounded-2xl text-salvia-800 dark:text-salvia-200 shrink-0">
            <GraduationCap className="w-6 h-6 text-salvia-700 dark:text-salvia-300" />
          </div>

          {/* Se houver mais de um dependente cadastrado, renderiza o dropdown interativo */}
          {alunos.length > 1 ? (
            <div className="relative flex-1 sm:w-72">
              <label className="text-[10px] font-bold text-salvia-600 dark:text-salvia-400 uppercase tracking-wider block">
                Filho(a) / Dependente Selecionado
              </label>
              <select
                value={selectedAlunoId}
                onChange={(e) => {
                  const target = alunos.find((a) => a.id === e.target.value);
                  if (target) handleSelectAluno(target);
                }}
                className="w-full mt-1 bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-salvia-50 shadow-sm focus:outline-none focus:border-salvia-600 cursor-pointer"
              >
                {alunos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} {a.cpf ? `(${a.cpf})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-bold text-salvia-600 dark:text-salvia-400 uppercase tracking-wider block">
                Portal da Família • Estudante
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">{selectedAlunoNome}</h3>
            </div>
          )}
        </div>

        {/* Badge Institucional */}
        <div className="flex items-center space-x-2 text-xs font-semibold text-salvia-700 dark:text-salvia-300 bg-salvia-100/70 dark:bg-salvia-800/60 px-3.5 py-1.5 rounded-full border border-salvia-200 dark:border-salvia-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{selectedAlunoId ? 'Matrícula Ativa • Ano Letivo 2026' : 'Nenhum aluno selecionado'}</span>
        </div>
      </div>


      {/* Navigation is managed by the Sidebar submenus */}


      {/* Alerta de erro caso ocorra */}
      {errorMsg && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. CONTEÚDO DAS ABAS */}
      {loading ? (
        <div className="py-12 text-center text-xs text-salvia-600 dark:text-salvia-400 font-medium">
          Carregando informações do estudante...
        </div>
      ) : (
        <>
          {/* ABA 1: BOLETIM & DESEMPENHO */}
          {activeTab === 'portal_boletim' && (
            <BoletimTab boletim={boletim} />
          )}

          {/* ABA 2: FINANCEIRO & MENSALIDADES */}
          {activeTab === 'portal_financeiro' && (
            <FinanceiroTab
              faturas={faturas}
              faturasAbertas={faturasAbertas}
              faturasPagas={faturasPagas}
              faturasExibidas={faturasExibidas}
              filtroStatusFatura={filtroStatusFatura}
              setFiltroStatusFatura={setFiltroStatusFatura}
              setPixModalFatura={setPixModalFatura}
            />
          )}

          {/* ABA 3: DOCUMENTOS & DIPLOMA DIGITAL MEC */}
          {activeTab === 'portal_diploma' && (
            <DiplomaTab diploma={diploma} />
          )}

          {/* ABA 4: ROTINA & DIÁRIO DE BORDO */}
          {activeTab === 'portal_rotina' && (
            <RotinaTab
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedAlunoId={selectedAlunoId}
              selectedAlunoNome={selectedAlunoNome}
              diarioInfantil={diarioInfantil}
              threadsPortal={threadsPortal}
              avisoMsg={avisoMsg}
              threadIdAtiva={threadIdAtiva}
              setThreadIdAtiva={setThreadIdAtiva}
              setRespostaTexto={setRespostaTexto}
              setAvisoMsg={setAvisoMsg}
              formatarQuando={formatarQuando}
              threadPortalAtiva={threadPortalAtiva}
              respostaTexto={respostaTexto}
              enviandoResposta={enviandoResposta}
              handleResponderThread={handleResponderThread}
            />
          )}

          {/* ABA 5: PROVAS E TRABALHOS DAS TURMAS DOS FILHOS */}
          {activeTab === 'portal_avaliacoes' && (
            <AvaliacoesTab
              avaliacoes={avaliacoes}
              loading={loading}
              erro={errorMsg}
              onTentarNovamente={() => {
                void loadTabData();
              }}
            />
          )}
        </>
      )}

      {/* 4. MODAL DE PAGAMENTO VIA PIX (2ª VIA LOCAL) */}
      {pixModalFatura && pixModalFatura.status !== 'pago' && (
        <PixModal
          pixModalFatura={pixModalFatura}
          setPixModalFatura={setPixModalFatura}
          handleCopyPix={handleCopyPix}
          copiedPix={copiedPix}
        />
      )}
    </section>
  );
}
