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

interface AlunoVinculado {
  id: string;
  nome: string;
  cpf?: string;
}

interface DisciplinaBoletim {
  nome: string;
  nota_1_bim?: number;
  nota_2_bim?: number;
  media: number;
  frequencia_pct: number;
}


interface PortfolioInfantil {
  id: string;
  titulo: string;
  descricao: string;
  data_registro: string;
  midia_url?: string;
  campos_experiencia_bncc: string[];
}

interface BoletimData {
  aluno_id: string;
  nome_aluno: string;
  disciplinas: DisciplinaBoletim[];
  media_geral: number;
  status_aprovacao: string;
}

interface FaturaData {
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

interface DiplomaData {
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

interface MensagemPortal {
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

interface ThreadPortal {
  id: string;
  raiz: MensagemPortal;
  mensagens: MensagemPortal[];
  respostas: number;
  ultima: MensagemPortal;
}

const tituloTemaPortal = (titulo: string) => titulo.replace(/^(Re:\s*)+/i, '').trim() || titulo;

const agruparThreadsPortal = (msgs: MensagemPortal[]): ThreadPortal[] => {
  const grupos = new Map<string, MensagemPortal[]>();
  for (const m of msgs) {
    const key = m.thread_id || m.resposta_a_id || m.id;
    const lista = grupos.get(key) || [];
    lista.push(m);
    grupos.set(key, lista);
  }
  const threads: ThreadPortal[] = [];
  for (const [key, lista] of grupos) {
    const ordenadas = [...lista].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const raiz =
      ordenadas.find((m) => m.id === key) ||
      ordenadas.find((m) => !m.resposta_a_id) ||
      ordenadas[0];
    threads.push({
      id: key,
      raiz,
      mensagens: ordenadas,
      respostas: Math.max(0, ordenadas.length - 1),
      ultima: ordenadas[ordenadas.length - 1],
    });
  }
  return threads.sort(
    (a, b) => new Date(b.ultima.created_at).getTime() - new Date(a.ultima.created_at).getTime(),
  );
};

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
            <div className="space-y-6">
              {/* Cards de Resumo Geral */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-salvia-50/70 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
                  <span className="text-[11px] font-semibold text-salvia-600 dark:text-salvia-400 block">Média Geral Ponderada</span>
                  <div className="mt-1 text-2xl font-bold font-mono text-slate-900 dark:text-salvia-50">
                    {boletim ? boletim.media_geral.toFixed(2) : '—'}
                  </div>
                  <span className="text-[10px] text-salvia-500 font-medium mt-1 inline-block">
                    {boletim ? (boletim.media_geral >= 7 ? 'Acima da média mínima (7.00)' : 'Abaixo da média mínima (7.00)') : 'Boletim não carregado'}
                  </span>
                </div>

                <div className="p-4 bg-salvia-50/70 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
                  <span className="text-[11px] font-semibold text-salvia-600 dark:text-salvia-400 block">Frequência Consolidada</span>
                  <div className="mt-1 text-2xl font-bold font-mono text-slate-900 dark:text-salvia-50">—</div>
                  <span className="text-[10px] text-salvia-500 font-medium mt-1 inline-block">
                    Frequência ainda não disponível neste painel
                  </span>
                </div>

                <div className="p-4 bg-salvia-50/70 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
                  <span className="text-[11px] font-semibold text-salvia-600 dark:text-salvia-400 block">Status Acadêmico</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                      boletim
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                    }`}>
                      {boletim ? boletim.status_aprovacao : 'Sem boletim'}
                    </span>
                  </div>
                  <span className="text-[10px] text-salvia-500 mt-1 inline-block">Ano Letivo 2026 em andamento</span>
                </div>
              </div>

              {/* Tabela de Disciplinas */}
              <div className="overflow-x-auto border border-salvia-200 dark:border-salvia-800 rounded-2xl shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-salvia-100/70 dark:bg-salvia-800/60 text-salvia-800 dark:text-salvia-200 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Disciplina</th>
                      <th className="py-3 px-4 text-center">1º Bimestre</th>
                      <th className="py-3 px-4 text-center">2º Bimestre</th>
                      <th className="py-3 px-4 text-center">Média Parcial</th>
                      <th className="py-3 px-4 text-center">Frequência</th>
                      <th className="py-3 px-4 text-center">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800">
                    {boletim && boletim.disciplinas && boletim.disciplinas.length > 0 ? (
                      boletim.disciplinas.map((disc, idx) => {
                        const aprovado = disc.media >= 7.0;
                        return (
                          <tr key={idx} className="hover:bg-salvia-50/50 dark:hover:bg-salvia-950/30 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-salvia-50">{disc.nome}</td>
                            <td className="py-3 px-4 text-center font-mono font-semibold">
                              {disc.nota_1_bim !== undefined ? disc.nota_1_bim.toFixed(1) : '-'}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-semibold">
                              {disc.nota_2_bim !== undefined ? disc.nota_2_bim.toFixed(1) : '-'}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 dark:text-salvia-50">
                              {disc.media.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center font-mono">{disc.frequencia_pct.toFixed(0)}%</td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  aprovado
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {aprovado ? 'Aprovado' : 'Em Recuperação'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 px-4 text-center text-sm text-salvia-600 dark:text-salvia-400">
                          Nenhuma nota lançada para este aluno.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 2: FINANCEIRO & MENSALIDADES */}
          {activeTab === 'portal_financeiro' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Faturas e Mensalidades Escolares</h3>
                  <p className="text-xs text-salvia-600 dark:text-salvia-400">
                    Acesse a 2ª via atualizada com Pix Copia e Cola para liquidação em tempo real.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {faturas.length > 0 ? (
                  faturas.map((fat) => (
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
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : fat.status === 'atrasado'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {fat.status}
                        </span>
                      </div>

                      <div className="flex justify-between items-end border-t border-salvia-200 dark:border-salvia-800 pt-3">
                        <div>
                          <span className="text-[10px] text-salvia-500 block">Valor da Mensalidade</span>
                          <span className="text-lg font-bold font-mono text-slate-900 dark:text-salvia-50">
                            R$ {fat.valor.toFixed(2)}
                          </span>
                        </div>

                        {fat.status !== 'pago' && (
                          <button
                            onClick={() => setPixModalFatura(fat)}
                            className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Pagar com Pix</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-salvia-300 p-8 text-center text-sm text-salvia-700 dark:border-salvia-800 dark:text-salvia-300">
                    Nenhuma mensalidade encontrada para este aluno.
                  </p>
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

      {/* 4. MODAL DE PAGAMENTO VIA PIX */}
      {pixModalFatura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950 rounded-xl text-emerald-700 dark:text-emerald-300">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Pagamento Instantâneo via Pix</h3>
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
                Abra o app do seu banco e aponte a câmera para o QR Code acima.
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
