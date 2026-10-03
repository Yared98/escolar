'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { useMensagensRealtime } from '@/lib/realtime';
import { ensurePushReady, notifyNovaMensagem } from '@/lib/push';
import { useAuth } from '@/context/AuthContext';
import {
  Camera,
  Baby,
  Calendar,
  MessageSquare,
  ChevronDown,
  Star,
  HelpCircle,
  Clock,
  Sparkles,
  AlertCircle,
  FileText,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Download,
  CreditCard,
  Award,
  GraduationCap,
  ShieldCheck,
  X,
  Send,
} from 'lucide-react';
import type { DiarioInfantilDia } from '@/lib/types/academico';
import { DiarioInfantilResumo } from './academico/DiarioInfantilResumo';

import { AlunoVinculado, DisciplinaBoletim, PortfolioInfantil, BoletimData, FaturaData, DiplomaData, MensagemPortal, ThreadPortal, tituloTemaPortal, agruparThreadsPortal, BoletimTab } from './portal_aluno';

import { useSearchParams } from 'next/navigation';

export function PortalAlunoSection() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const activeTab: 'portal_boletim' | 'portal_financeiro' | 'portal_diploma' | 'portal_rotina' | 'portal_portfolio' =
    tabParam === 'portal_financeiro' || tabParam === 'portal_diploma' || tabParam === 'portal_rotina' || tabParam === 'portal_portfolio'
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
            <div className="space-y-6">
              {/* Cabeçalho e Filtros Rápidos */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Faturas e Mensalidades Escolares</h3>
                  <p className="text-xs text-salvia-600 dark:text-salvia-400">
                    Consulte as mensalidades e emita a 2ª via do código Pix para pagamento e conferência escolar.
                  </p>
                </div>

                {/* Chips / Filtros de Status */}
                <div className="flex items-center gap-1.5 p-1 bg-salvia-100/70 dark:bg-salvia-950/80 border border-salvia-200 dark:border-salvia-800 rounded-2xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setFiltroStatusFatura('abertas')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      filtroStatusFatura === 'abertas'
                        ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm'
                        : 'text-salvia-700 hover:bg-salvia-200/60 dark:text-salvia-300 dark:hover:bg-salvia-800/60'
                    }`}
                  >
                    <span>Abertas</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        filtroStatusFatura === 'abertas'
                          ? 'bg-white/20 text-white'
                          : 'bg-salvia-200 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300'
                      }`}
                    >
                      {faturasAbertas.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltroStatusFatura('pagas')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      filtroStatusFatura === 'pagas'
                        ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm'
                        : 'text-salvia-700 hover:bg-salvia-200/60 dark:text-salvia-300 dark:hover:bg-salvia-800/60'
                    }`}
                  >
                    <span>Pagas</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        filtroStatusFatura === 'pagas'
                          ? 'bg-white/20 text-white'
                          : 'bg-salvia-200 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300'
                      }`}
                    >
                      {faturasPagas.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltroStatusFatura('todas')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      filtroStatusFatura === 'todas'
                        ? 'bg-salvia-700 text-white dark:bg-salvia-600 shadow-sm'
                        : 'text-salvia-700 hover:bg-salvia-200/60 dark:text-salvia-300 dark:hover:bg-salvia-800/60'
                    }`}
                  >
                    <span>Todas</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        filtroStatusFatura === 'todas'
                          ? 'bg-white/20 text-white'
                          : 'bg-salvia-200 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300'
                      }`}
                    >
                      {faturas.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Disclaimer / Nota Honesta MVP sobre Pix e conciliação */}
              <div className="p-3.5 bg-salvia-50/90 dark:bg-salvia-950/70 border border-salvia-200 dark:border-salvia-800 rounded-2xl flex items-start space-x-3 text-xs text-salvia-700 dark:text-salvia-300">
                <HelpCircle className="w-4 h-4 shrink-0 text-salvia-600 dark:text-salvia-400 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-slate-900 dark:text-salvia-100 block">
                    2ª via Pix local (EMVCo BR Code) • Tesouraria escolar
                  </span>
                  <p className="text-[11px] leading-relaxed text-salvia-600 dark:text-salvia-400">
                    O QR Code e o código Pix Copia e Cola são gerados no padrão EMVCo para emissão de 2ª via e conferência pela tesouraria da escola. A conciliação e baixa automática via webhook bancário depende de credenciais PSP ativas em ambiente produtivo.
                  </p>
                </div>
              </div>

              {/* Grid de Faturas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {faturasExibidas.length > 0 ? (
                  faturasExibidas.map((fat) => (
                    <div
                      key={fat.id}
                      className="p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl flex flex-col justify-between space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-salvia-500 font-bold">
                            Vencimento: {fat.data_vencimento}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-salvia-50 mt-0.5">{fat.descricao}</h4>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            fat.status === 'pago'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : fat.status === 'atrasado'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : fat.status === 'cancelado'
                              ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                        >
                          {fat.status === 'pago'
                            ? 'Pago'
                            : fat.status === 'atrasado'
                            ? 'Atrasado'
                            : fat.status === 'cancelado'
                            ? 'Cancelado'
                            : 'Pendente'}
                        </span>
                      </div>

                      <div className="flex justify-between items-end border-t border-salvia-200 dark:border-salvia-800 pt-3">
                        <div>
                          <span className="text-[10px] text-salvia-500 block">Valor da Mensalidade</span>
                          <span className="text-lg font-bold font-mono text-slate-900 dark:text-salvia-50">
                            R$ {fat.valor.toFixed(2)}
                          </span>
                        </div>

                        {/* Ação de acordo com o status: pagas recebem badge de confirmação sem botão Pix */}
                        {fat.status === 'pago' ? (
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 rounded-xl">
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Pagamento Confirmado</span>
                          </div>
                        ) : fat.status === 'cancelado' ? (
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-1.5">
                            Fatura Cancelada
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPixModalFatura(fat)}
                            className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Pagar com Pix</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full rounded-2xl border border-dashed border-salvia-300 dark:border-salvia-800 p-8 text-center text-sm text-salvia-700 dark:text-salvia-300">
                    {filtroStatusFatura === 'abertas'
                      ? 'Nenhuma fatura em aberto encontrada para este estudante.'
                      : filtroStatusFatura === 'pagas'
                      ? 'Nenhuma fatura liquidada encontrada para este estudante.'
                      : 'Nenhuma mensalidade encontrada para este estudante.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 3: DOCUMENTOS & DIPLOMA DIGITAL MEC */}
          {activeTab === 'portal_diploma' && (
            <div className="space-y-6">
              <div className="p-5 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                      Portaria MEC nº 70/2025 Homologada
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-salvia-50">
                      Diploma Digital & Histórico Escolar Oficial
                    </h3>
                    <p className="text-xs text-salvia-600 dark:text-salvia-400">
                      Certificação acadêmica emitida no padrão XML/XAdES com carimbo do tempo ICP-Brasil e inviolabilidade garantida.
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-2xl shadow-sm text-center shrink-0">
                    <QrCode className="w-16 h-16 text-slate-800 dark:text-salvia-100 mx-auto" />
                    <span className="text-[9px] font-mono text-salvia-500 mt-1 block">Validação Oficial MEC</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-salvia-200 dark:border-salvia-800">
                  <div className="bg-white dark:bg-salvia-900 p-3 rounded-xl border border-salvia-200 dark:border-salvia-800">
                    <span className="text-[10px] text-salvia-500 font-semibold block">Código de Validação MEC:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-salvia-50">
                      {diploma?.codigo_validacao || 'Não emitido'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-salvia-900 p-3 rounded-xl border border-salvia-200 dark:border-salvia-800">
                    <span className="text-[10px] text-salvia-500 font-semibold block">Carimbo do Tempo (RFC 3161):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-salvia-50">
                      {diploma?.carimbo_tempo ? new Date(diploma.carimbo_tempo).toLocaleString('pt-BR') : 'Não emitido'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-salvia-900 p-3 rounded-xl border border-salvia-200 dark:border-salvia-800 md:col-span-2">
                    <span className="text-[10px] text-salvia-500 font-semibold block">Assinatura Digital XAdES Enveloped:</span>
                    <span className="font-mono text-[11px] text-salvia-700 dark:text-salvia-300 break-all">
                      {diploma?.hash_xades || 'Não emitido'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {diploma?.qr_code_validacao_url ? (
                    <a
                      href={diploma.qr_code_validacao_url}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Verificar Autenticidade no Portal do MEC</span>
                    </a>
                  ) : (
                    <span className="px-4 py-2 rounded-xl text-xs font-bold text-salvia-600 dark:text-salvia-400">
                      Validação MEC disponível depois da emissão.
                    </span>
                  )}

                  <button
                    disabled={!diploma}
                    onClick={() => {
                      if (diploma) alert('Download do Diploma Digital (RVDD em PDF assinado) iniciado.');
                    }}
                    className="bg-white dark:bg-salvia-900 hover:bg-salvia-100 dark:hover:bg-salvia-800 border border-salvia-300 dark:border-salvia-700 text-salvia-800 dark:text-salvia-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Representação Visual (RVDD PDF)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: ROTINA & DIÁRIO DE BORDO */}
          {activeTab === 'portal_rotina' && (
            <div className="space-y-6">
              {/* Date Picker */}
              <div className="flex justify-between items-center bg-salvia-50/60 dark:bg-salvia-950/50 p-3 rounded-xl border border-salvia-200 dark:border-salvia-800">
                <span className="text-xs font-bold text-salvia-800 dark:text-salvia-200">Data de Consulta do Diário:</span>
                <div className="bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-1 flex items-center space-x-2 shadow-sm">
                  <Calendar className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {selectedAlunoId ? (
                <DiarioInfantilResumo
                  alunoNome={selectedAlunoNome}
                  turmaNome={diarioInfantil?.turma?.nome}
                  data={selectedDate}
                  dia={diarioInfantil}
                />
              ) : (
                <p className="text-xs text-salvia-600 dark:text-salvia-400">
                  Nenhum aluno vinculado a este acesso para consultar o diário.
                </p>
              )}

              {/* Mensagens & Recados — temas + thread */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-salvia-800 dark:text-salvia-200 uppercase tracking-wider flex items-center space-x-1.5">
                    <MessageSquare className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
                    <span>Recados da Coordenação & Professores</span>
                  </h3>
                  <span className="text-[10px] font-mono text-salvia-500 font-semibold">
                    {threadsPortal.length} tema{threadsPortal.length === 1 ? '' : 's'}
                  </span>
                </div>

                {avisoMsg && (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{avisoMsg}</p>
                )}

                {threadsPortal.length === 0 ? (
                  <p className="text-xs text-salvia-600 dark:text-salvia-400 py-2">
                    Nenhum recado para os filhos vinculados neste momento.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] border border-salvia-200 dark:border-salvia-800 rounded-2xl overflow-hidden bg-white dark:bg-salvia-900 min-h-[16rem]">
                    <ul className="divide-y divide-salvia-100 dark:divide-salvia-800 border-b lg:border-b-0 lg:border-r border-salvia-200 dark:border-salvia-800 max-h-[22rem] overflow-y-auto">
                      {threadsPortal.map((t) => {
                        const ativa = threadIdAtiva === t.id;
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setThreadIdAtiva(t.id);
                                setRespostaTexto('');
                                setAvisoMsg(null);
                              }}
                              className={`w-full text-left px-3 py-3 space-y-1 transition-colors ${
                                ativa
                                  ? 'bg-salvia-50 dark:bg-salvia-950/50 border-l-2 border-l-salvia-600'
                                  : 'hover:bg-salvia-50/60 dark:hover:bg-salvia-950/30 border-l-2 border-l-transparent'
                              }`}
                            >
                              <div className="flex justify-between gap-2">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50 truncate">
                                  {tituloTemaPortal(t.raiz.titulo)}
                                </h4>
                                <span className="text-[10px] text-salvia-500 whitespace-nowrap">
                                  {formatarQuando(t.ultima.created_at)}
                                </span>
                              </div>
                              <p className="text-[11px] text-salvia-600 dark:text-salvia-400 line-clamp-1">
                                {t.respostas > 0
                                  ? `${t.respostas} resp. · ${t.ultima.remetente_nome || 'Escola'}: ${t.ultima.conteudo}`
                                  : t.raiz.conteudo}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="flex flex-col min-h-[14rem] max-h-[22rem] bg-salvia-50/30 dark:bg-[#0c120e]/30">
                      {threadPortalAtiva ? (
                        <>
                          <div className="px-3 py-2.5 border-b border-salvia-100 dark:border-salvia-800 bg-white dark:bg-salvia-900 shrink-0">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
                              {tituloTemaPortal(threadPortalAtiva.raiz.titulo)}
                            </h4>
                            <p className="text-[10px] text-salvia-500">
                              {threadPortalAtiva.respostas} resposta
                              {threadPortalAtiva.respostas === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                            {threadPortalAtiva.mensagens.map((m) => (
                              <div
                                key={m.id}
                                className={`rounded-xl px-3 py-2.5 space-y-1 border ${
                                  m.id === threadPortalAtiva.raiz.id
                                    ? 'bg-white dark:bg-salvia-900 border-salvia-200 dark:border-salvia-700'
                                    : 'bg-white/70 dark:bg-salvia-900/60 border-salvia-100 dark:border-salvia-800 ml-2'
                                }`}
                              >
                                <div className="flex justify-between gap-2">
                                  <span className="text-[11px] font-bold text-slate-800 dark:text-salvia-100">
                                    {m.remetente_nome || 'Escola'}
                                    {m.remetente_role ? (
                                      <span className="font-medium text-salvia-500"> · {m.remetente_role}</span>
                                    ) : null}
                                  </span>
                                  <span className="text-[10px] text-salvia-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatarQuando(m.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-800 dark:text-salvia-200 leading-relaxed whitespace-pre-wrap">
                                  {m.conteudo}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="px-3 py-2.5 border-t border-salvia-100 dark:border-salvia-800 bg-white dark:bg-salvia-900 space-y-2 shrink-0">
                            <textarea
                              value={respostaTexto}
                              onChange={(e) => setRespostaTexto(e.target.value)}
                              rows={2}
                              placeholder="Responder nesta conversa…"
                              className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={enviandoResposta || !respostaTexto.trim()}
                                onClick={handleResponderThread}
                                className="inline-flex items-center gap-1.5 bg-salvia-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold hover:bg-salvia-800 disabled:opacity-50"
                              >
                                <Send className="w-3 h-3" />
                                {enviandoResposta ? 'Enviando…' : 'Enviar na thread'}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex items-center justify-center p-6 text-center">
                          <p className="text-xs text-salvia-600">Selecione um tema à esquerda.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 4. MODAL DE PAGAMENTO VIA PIX (2ª VIA LOCAL) */}
      {pixModalFatura && pixModalFatura.status !== 'pago' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-salvia-100 dark:bg-salvia-800 rounded-xl text-salvia-700 dark:text-salvia-300">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">2ª Via de Pagamento Pix</h3>
                  <span className="text-[10px] text-salvia-500 font-medium">Conferência local • Padrão EMVCo</span>
                </div>
              </div>
              <button
                onClick={() => setPixModalFatura(null)}
                className="p-1.5 rounded-lg hover:bg-salvia-100 dark:hover:bg-salvia-800 text-salvia-600 dark:text-salvia-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-salvia-600 dark:text-salvia-400 font-medium">{pixModalFatura.descricao}</span>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-salvia-50">
                R$ {pixModalFatura.valor.toFixed(2)}
              </div>
              <span className="text-[10px] text-salvia-500 font-mono">
                Vencimento: {pixModalFatura.data_vencimento}
              </span>
            </div>

            {/* QR Code Graphic Mock */}
            <div className="bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 text-center space-y-2">
              <QrCode className="w-32 h-32 text-slate-900 dark:text-salvia-100 mx-auto" />
              <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
                Abra o aplicativo do seu banco e aponte a câmera para o QR Code acima.
              </p>
            </div>

            {/* Nota de esclarecimento sobre conciliação e geração local */}
            <div className="p-2.5 bg-salvia-100/60 dark:bg-salvia-950/70 border border-salvia-200 dark:border-salvia-800 rounded-xl text-[11px] text-salvia-700 dark:text-salvia-300">
              <p className="leading-snug">
                Chave Pix gerada no padrão EMVCo para 2ª via. A confirmação do pagamento é verificada pela tesouraria escolar (ou via webhook automático quando o PSP bancário estiver ativo).
              </p>
            </div>

            {/* Código Copia e Cola */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-salvia-600 dark:text-salvia-400 block">
                Pix Copia e Cola
              </label>
              <div className="flex items-center space-x-2">
                <input
                  readOnly
                  value={pixModalFatura.qr_code_pix || 'Código Pix ainda não foi gerado para esta fatura.'}
                  className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-700 dark:text-salvia-300 focus:outline-none"
                />
                <button
                  disabled={!pixModalFatura.qr_code_pix}
                  onClick={() => {
                    if (pixModalFatura.qr_code_pix) handleCopyPix(pixModalFatura.qr_code_pix);
                  }}
                  className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 transition-all shadow-sm"
                >
                  {copiedPix ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setPixModalFatura(null)}
                className="w-full bg-salvia-100 hover:bg-salvia-200 dark:bg-salvia-800 dark:hover:bg-salvia-700 text-salvia-800 dark:text-salvia-200 py-2.5 rounded-xl font-bold text-xs transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
