'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { formatCpf } from '@/lib/formatters';
import { ContratoItem, ContratoDetalhado, FaturaParcela, Aluno } from './types';
import {
  FileText,
  PlusCircle,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  RotateCw,
  X,
  CreditCard,
  QrCode,
  DollarSign,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react';

interface ContratosPanelProps {
  alunos: Aluno[];
  onNavigateToFinanceiro?: () => void;
  // Financeiro só consulta: criar e assinar contrato é da secretaria/gestão (e da família na assinatura).
  somenteConsulta?: boolean;
}

export function ContratosPanel({ alunos, onNavigateToFinanceiro, somenteConsulta = false }: ContratosPanelProps) {
  const [contratos, setContratos] = useState<ContratoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [anoFilter, setAnoFilter] = useState<string>('');

  // Modal Novo Contrato
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [novoAlunoId, setNovoAlunoId] = useState('');
  const [novoAnoLetivo, setNovoAnoLetivo] = useState(new Date().getFullYear());
  const [novoValorTotal, setNovoValorTotal] = useState('14400');
  const [novoSubmitting, setNovoSubmitting] = useState(false);
  const [novoError, setNovoError] = useState<string | null>(null);

  // Modal Assinatura
  const [contratoParaAssinar, setContratoParaAssinar] = useState<ContratoItem | null>(null);
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [assinandoLoading, setAssinandoLoading] = useState(false);
  const [assinarError, setAssinarError] = useState<string | null>(null);

  // Modal Detalhes & Parcelas
  const [contratoDetalhes, setContratoDetalhes] = useState<ContratoDetalhado | null>(null);
  const [detalhesLoading, setDetalhesLoading] = useState(false);
  const [gerandoParcelasLoading, setGerandoParcelasLoading] = useState(false);

  // Feedback de cópia
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);

  const loadContratos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ContratoItem[]>('/secretaria/contratos');
      setContratos(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar contratos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContratos();
  }, [loadContratos]);

  const handleCopy = (text: string, type: 'hash' | 'pix', id: string) => {
    navigator.clipboard.writeText(text);
    if (type === 'hash') {
      setCopiedHash(id);
      setTimeout(() => setCopiedHash(null), 2000);
    } else {
      setCopiedPixId(id);
      setTimeout(() => setCopiedPixId(null), 2000);
    }
  };

  const handleCriarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoAlunoId) {
      setNovoError('Selecione um aluno.');
      return;
    }
    const valor = parseFloat(novoValorTotal);
    if (isNaN(valor) || valor <= 0) {
      setNovoError('Informe um valor total válido para a anuidade.');
      return;
    }

    setNovoSubmitting(true);
    setNovoError(null);
    try {
      const created = await apiFetch<ContratoItem>('/secretaria/contratos', {
        method: 'POST',
        body: JSON.stringify({
          aluno_id: novoAlunoId,
          ano_letivo: Number(novoAnoLetivo),
          valor_total: valor,
        }),
      });

      setToastMsg(`Minuta de contrato #${created.id.substring(0, 8)} criada com sucesso!`);
      setShowNovoModal(false);
      setNovoAlunoId('');
      setNovoValorTotal('14400');
      void loadContratos();
    } catch (err: unknown) {
      setNovoError(err instanceof Error ? err.message : 'Falha ao criar minuta de contrato.');
    } finally {
      setNovoSubmitting(false);
    }
  };

  const handleAbrirAssinatura = (contrato: ContratoItem) => {
    setContratoParaAssinar(contrato);
    setAceiteTermos(false);
    setAssinarError(null);
  };

  const handleConfirmarAssinatura = async () => {
    if (!contratoParaAssinar) return;
    if (!aceiteTermos) {
      setAssinarError('Você deve assinalar o aceite formal dos termos contratuais para prosseguir.');
      return;
    }

    setAssinandoLoading(true);
    setAssinarError(null);
    try {
      const assinado = await apiFetch<ContratoItem>(`/secretaria/contratos/${contratoParaAssinar.id}/assinar`, {
        method: 'POST',
        body: JSON.stringify({ aceite_termos: true }),
      });

      setToastMsg(
        `Contrato assinado digitalmente com sucesso! As 12 parcelas Pix foram geradas no faturamento.`
      );
      setContratoParaAssinar(null);
      void loadContratos();

      // Abre automaticamente a tela de detalhes para visualizar as parcelas geradas
      void handleAbrirDetalhes(assinado.id);
    } catch (err: unknown) {
      setAssinarError(err instanceof Error ? err.message : 'Falha ao assinar contrato.');
    } finally {
      setAssinandoLoading(false);
    }
  };

  const handleAbrirDetalhes = async (contratoId: string) => {
    setDetalhesLoading(true);
    try {
      const data = await apiFetch<ContratoDetalhado>(`/secretaria/contratos/${contratoId}`);
      setContratoDetalhes(data);
    } catch (err: unknown) {
      setToastMsg(err instanceof Error ? err.message : 'Falha ao carregar detalhes do contrato.');
    } finally {
      setDetalhesLoading(false);
    }
  };

  const handleGerarParcelasManual = async (contratoId: string) => {
    setGerandoParcelasLoading(true);
    try {
      await apiFetch('/financeiro/faturas/gerar-parcelas', {
        method: 'POST',
        body: JSON.stringify({
          contrato_id: contratoId,
          numero_parcelas: 12,
          metodo_pagamento: 'pix',
          dia_vencimento: 10,
        }),
      });

      setToastMsg('12 parcelas Pix geradas com sucesso!');
      void handleAbrirDetalhes(contratoId);
      void loadContratos();
    } catch (err: unknown) {
      setToastMsg(err instanceof Error ? err.message : 'Não foi possível gerar parcelas.');
    } finally {
      setGerandoParcelasLoading(false);
    }
  };

  // Contratos filtrados
  const contratosFiltrados = contratos.filter((c) => {
    const q = search.toLowerCase();
    const matchBusca =
      (c.aluno_nome || '').toLowerCase().includes(q) ||
      (c.aluno_cpf || '').includes(q) ||
      c.id.toLowerCase().includes(q);

    const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
    const matchAno = !anoFilter || String(c.ano_letivo) === anoFilter;

    return matchBusca && matchStatus && matchAno;
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button type="button" onClick={() => setToastMsg(null)} className="text-emerald-700 dark:text-emerald-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Aviso curto: o que acontece ao assinar e o tipo de assinatura (sem ICP-Brasil nesta versão) */}
      <p className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-salvia-600 dark:text-salvia-400" />
        <span>
          Ao assinar o contrato, as 12 mensalidades são criadas automaticamente no Financeiro. A assinatura é
          eletrônica simples, sem certificado digital ICP-Brasil.
        </span>
      </p>

      {/* Barra de Filtros e Criação */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Chips */}
          {[
            { id: 'todos', label: 'Todos os Contratos' },
            { id: 'pendente_assinatura', label: 'Pendentes de Assinatura' },
            { id: 'assinado', label: 'Assinados' },
            { id: 'cancelado', label: 'Cancelados' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === st.id
                  ? 'bg-salvia-700 dark:bg-salvia-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 max-sm:flex-wrap">
          {/* Busca */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar aluno, CPF ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-salvia-500"
            />
          </div>

          {/* Ano Letivo Filter */}
          <select
            value={anoFilter}
            onChange={(e) => setAnoFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-salvia-500"
          >
            <option value="">Todos os Anos</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>

          {/* Botão Novo Contrato */}
          {!somenteConsulta && (
          <button
            type="button"
            onClick={() => {
              setNovoError(null);
              setShowNovoModal(true);
            }}
            className="bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 dark:hover:bg-salvia-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm whitespace-nowrap transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Novo Contrato</span>
          </button>
          )}

          {/* Recarregar */}
          <button
            type="button"
            onClick={() => void loadContratos()}
            disabled={loading}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition"
            title="Recarregar Contratos"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-salvia-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Erro de Carregamento */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void loadContratos()}
            className="text-xs font-bold text-rose-700 underline hover:no-underline"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Tabela de Contratos */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        {loading && contratos.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RotateCw className="w-6 h-6 animate-spin text-salvia-600" />
            <p>Carregando contratos de matrícula...</p>
          </div>
        ) : contratosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center space-y-3">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhum contrato encontrado.</p>
            <p className="text-[11px] max-w-sm text-slate-500">
              {search || statusFilter !== 'todos' || anoFilter
                ? 'Tente ajustar os filtros de busca para encontrar contratos cadastrados.'
                : somenteConsulta
                  ? 'Os contratos criados pela secretaria aparecem aqui.'
                  : 'Crie o contrato de um aluno para gerar as mensalidades no Financeiro.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Estudante</th>
                  <th className="py-3 px-4">Ano Letivo</th>
                  <th className="py-3 px-4">Anuidade / Parcelas</th>
                  <th className="py-3 px-4">Status & Integridade</th>
                  <th className="py-3 px-4">Faturamento</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                {contratosFiltrados.map((contrato) => {
                  const isAssinado = contrato.status === 'assinado';
                  const isPendente = contrato.status === 'pendente_assinatura';
                  const valorParcelaEstimada = contrato.valor_total / 12;

                  return (
                    <tr
                      key={contrato.id}
                      className="hover:bg-salvia-50/40 dark:hover:bg-salvia-950/20 transition-colors"
                    >
                      {/* Estudante */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {contrato.aluno_nome || 'Estudante não identificado'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          CPF: {contrato.aluno_cpf ? formatCpf(contrato.aluno_cpf) : 'Não informado'} • ID: #{contrato.id.substring(0, 8)}
                        </div>
                      </td>

                      {/* Ano Letivo */}
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {contrato.ano_letivo}
                      </td>

                      {/* Anuidade */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-salvia-700 dark:text-salvia-300 font-mono text-[13px]">
                          R$ {contrato.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          12× de R$ {valorParcelaEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Status & Integridade */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {isAssinado ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Assinado Digitalmente
                            </span>
                          ) : isPendente ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              Pendente de Assinatura
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                              Cancelado
                            </span>
                          )}

                          {isAssinado && contrato.hash_documento && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                              <span title={contrato.hash_documento}>
                                Código: {contrato.hash_documento.substring(0, 12)}...
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(contrato.hash_documento!, 'hash', contrato.id)}
                                className="text-salvia-700 hover:text-salvia-900 dark:text-salvia-400"
                                title="Copiar código de verificação"
                              >
                                {copiedHash === contrato.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Faturamento / Parcelas */}
                      <td className="py-3 px-4">
                        {isAssinado ? (
                          (contrato.total_parcelas || 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-salvia-100 dark:bg-salvia-900/60 text-salvia-800 dark:text-salvia-200 border border-salvia-200 dark:border-salvia-800">
                              <DollarSign className="w-3 h-3 text-salvia-600" />
                              {contrato.total_parcelas} parcelas Pix geradas
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleGerarParcelasManual(contrato.id)}
                              disabled={gerandoParcelasLoading}
                              className="text-[11px] font-bold text-amber-700 dark:text-amber-400 underline hover:no-underline flex items-center gap-1"
                            >
                              <span>Gerar 12x parcelas</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Disponível após assinatura
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isPendente && !somenteConsulta && (
                            <button
                              type="button"
                              onClick={() => handleAbrirAssinatura(contrato)}
                              className="bg-salvia-700 hover:bg-salvia-800 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Assinar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleAbrirDetalhes(contrato.id)}
                            className="border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                          >
                            <span>Detalhes & Parcelas</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: NOVO CONTRATO DE MATRÍCULA */}
      {/* ========================================================================= */}
      {showNovoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Gerar Minuta de Contrato Educacional
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNovoModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCriarContrato} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {novoError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{novoError}</span>
                </div>
              )}

              {/* Aluno Selection */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Estudante <span className="text-rose-500">*</span>
                </label>
                <select
                  value={novoAlunoId}
                  onChange={(e) => setNovoAlunoId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-salvia-500"
                >
                  <option value="">Selecione o estudante...</option>
                  {alunos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} ({a.cpf ? formatCpf(a.cpf) : 'Sem CPF'}) - Status: {a.status}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Alunos em pré-matrícula ou ativos podem ter minutas de contrato geradas.
                </p>
              </div>

              {/* Ano Letivo & Valor Total */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Ano Letivo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="2024"
                    max="2030"
                    value={novoAnoLetivo}
                    onChange={(e) => setNovoAnoLetivo(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-salvia-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Valor Anuidade Total (R$) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={novoValorTotal}
                    onChange={(e) => setNovoValorTotal(e.target.value)}
                    required
                    placeholder="14400.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-salvia-500 font-mono"
                  />
                </div>
              </div>

              {/* Simulação das parcelas */}
              {parseFloat(novoValorTotal) > 0 && (
                <div className="p-3.5 rounded-xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/50 dark:bg-salvia-950/40 space-y-1">
                  <div className="text-[11px] font-bold text-salvia-800 dark:text-salvia-200 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-salvia-600" />
                    <span>Projeção de Faturamento Automático</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Ao assinar, serão criadas <strong>12 parcelas mensais de R$ {(parseFloat(novoValorTotal) / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> com vencimento todo dia 10 e pagamento por Pix.
                  </p>
                </div>
              )}

              {/* Informação sobre processo */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-salvia-600" />
                  <span>Como funciona</span>
                </div>
                <p>
                  1. O contrato é criado como <strong>Pendente de assinatura</strong>.<br />
                  2. O responsável lê e aceita o contrato (assinatura eletrônica simples).<br />
                  3. As 12 mensalidades são criadas automaticamente no Financeiro.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNovoModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={novoSubmitting}
                  className="bg-salvia-700 hover:bg-salvia-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  {novoSubmitting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Gerando Minuta...</span>
                    </>
                  ) : (
                    <span>Criar Minuta de Contrato</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSINATURA ELETRÔNICA DO CONTRATO (MP 2.200-2/2001 & SHA-256) */}
      {/* ========================================================================= */}
      {contratoParaAssinar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-salvia-50/50 dark:bg-salvia-950/40">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Assinatura do contrato
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Contrato #{contratoParaAssinar.id.substring(0, 8)} • Ano Letivo {contratoParaAssinar.ano_letivo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContratoParaAssinar(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {assinarError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{assinarError}</span>
                </div>
              )}

              {/* Resumo da Contratação */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Estudante</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {contratoParaAssinar.aluno_nome || 'Não identificado'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    CPF: {contratoParaAssinar.aluno_cpf ? formatCpf(contratoParaAssinar.aluno_cpf) : 'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Anuidade Escolar</span>
                  <p className="font-bold text-salvia-700 dark:text-salvia-300 text-xs font-mono">
                    R$ {contratoParaAssinar.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    12× de R$ {(contratoParaAssinar.valor_total / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Cláusulas & Termos de Adesão */}
              <div className="space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-bold">
                  Cláusulas Contratuais de Prestação de Serviços Educacionais
                </label>
                <div className="p-3 bg-slate-100/70 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 h-36 overflow-y-auto text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 space-y-2 font-mono">
                  <p>
                    <strong>CLÁUSULA 1ª - DO OBJETO:</strong> O presente contrato tem por objeto a prestação de serviços educacionais correspondentes ao ano letivo de {contratoParaAssinar.ano_letivo}, em conformidade com o regimento escolar e a Lei Federal nº 9.394/1996 (LDB).
                  </p>
                  <p>
                    <strong>CLÁUSULA 2ª - DA CONTRAPRESTAÇÃO FINANCEIRA:</strong> Como contraprestação pelos serviços educacionais contratados, a Contratante pagará a anuidade escolar no valor total de R$ {contratoParaAssinar.valor_total.toFixed(2)}, parcelada em 12 (doze) mensalidades iguais e sucessivas, com vencimento todo dia 10 (dez) de cada mês, pagas por Pix.
                  </p>
                  <p>
                    <strong>CLÁUSULA 3ª - DA VALIDADE DA ASSINATURA ELETRÔNICA:</strong> As partes reconhecem a validade, integridade e força executiva extrajudicial deste documento formalizado por assinatura eletrônica avançada, nos termos do Art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020.
                  </p>
                  <p>
                    <strong>CLÁUSULA 4ª - DA AUDITORIA & REGISTRO CRIPTOGRÁFICO:</strong> A autenticidade é garantida pela combinação de identificadores únicos, carimbo de tempo UTC e geração de digest algorítmico SHA-256 armazenado em base imutável.
                  </p>
                </div>
              </div>

              {/* Declaração Honest Disclaimer (MP 2.200-2 vs ICP-Brasil) */}
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] leading-snug space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Sobre esta assinatura</span>
                </div>
                <p>
                  É uma <strong>assinatura eletrônica simples</strong>: o sistema registra quem aceitou, quando e de qual endereço, e guarda uma impressão digital do contrato para provar que ele não foi alterado. <strong>Não usa certificado digital ICP-Brasil</strong>.
                </p>
              </div>

              {/* Checkbox de Aceite Formal */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/40 dark:bg-salvia-950/30 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={aceiteTermos}
                  onChange={(e) => setAceiteTermos(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-salvia-600 focus:ring-salvia-500 h-4 w-4"
                />
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                  Declaro que li e concordo com todas as cláusulas contratuais de prestação de serviços educacionais, autorizando a formalização do contrato e a emissão das 12 parcelas de anuidade escolar.
                </span>
              </label>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setContratoParaAssinar(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmarAssinatura()}
                  disabled={assinandoLoading || !aceiteTermos}
                  className="bg-salvia-700 hover:bg-salvia-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  {assinandoLoading ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processando Assinatura & Parcelas...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirmar Assinatura Digital</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETALHES DO CONTRATO & PARCELAS GERADAS */}
      {/* ========================================================================= */}
      {contratoDetalhes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Contrato Educacional #{contratoDetalhes.id.substring(0, 8)}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        contratoDetalhes.status === 'assinado'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {contratoDetalhes.status === 'assinado' ? 'Assinado' : 'Pendente'}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Estudante: {contratoDetalhes.aluno_nome || 'N/A'} • Ano Letivo: {contratoDetalhes.ano_letivo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setContratoDetalhes(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Valor Anual</span>
                  <div className="text-base font-bold text-salvia-700 dark:text-salvia-300 font-mono mt-0.5">
                    R$ {contratoDetalhes.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500">12 mensalidades</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Parcelas Faturadas</span>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                    {contratoDetalhes.parcelas?.length || 0} / 12
                  </div>
                  <span className="text-[10px] text-slate-500">Pix local</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Status Jurídico</span>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1">
                    {contratoDetalhes.status === 'assinado' ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Homologado</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Aguardando Assinatura</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Registro Criptográfico de Assinatura */}
              {contratoDetalhes.status === 'assinado' && (
                <div className="p-3.5 bg-salvia-50/60 dark:bg-salvia-950/40 rounded-xl border border-salvia-200 dark:border-salvia-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-salvia-800 dark:text-salvia-200 text-[11px] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-salvia-600" />
                      <span>Evidência da Assinatura Digital</span>
                    </span>
                    {contratoDetalhes.assinado_em && (
                      <span className="text-[10px] text-slate-500">
                        Assinado em: {new Date(contratoDetalhes.assinado_em).toLocaleString('pt-BR')} (UTC)
                      </span>
                    )}
                  </div>

                  {contratoDetalhes.hash_documento && (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-salvia-200/60 dark:border-salvia-800">
                      <div className="text-[10px] font-mono text-slate-700 dark:text-slate-300 break-all pr-2">
                        Código de verificação: {contratoDetalhes.hash_documento}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(contratoDetalhes.hash_documento!, 'hash', contratoDetalhes.id)}
                        className="text-salvia-700 hover:text-salvia-900 dark:text-salvia-400 shrink-0 p-1"
                        title="Copiar código de verificação"
                      >
                        {copiedHash === contratoDetalhes.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 italic">
                    O código acima comprova que o contrato não foi alterado depois da assinatura. Assinatura eletrônica simples, sem certificado ICP-Brasil.
                  </p>
                </div>
              )}

              {/* Relação das Parcelas Geradas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      Parcelas da Anuidade ({contratoDetalhes.parcelas?.length || 0} de 12)
                    </h4>
                  </div>

                  {contratoDetalhes.status === 'assinado' && (!contratoDetalhes.parcelas || contratoDetalhes.parcelas.length === 0) && (
                    <button
                      type="button"
                      onClick={() => void handleGerarParcelasManual(contratoDetalhes.id)}
                      disabled={gerandoParcelasLoading}
                      className="bg-salvia-700 hover:bg-salvia-800 text-white px-3 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Gerar 12x Parcelas Pix</span>
                    </button>
                  )}
                </div>

                {!contratoDetalhes.parcelas || contratoDetalhes.parcelas.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-500">
                    <p className="font-semibold text-xs">Nenhuma parcela gerada ainda.</p>
                    <p className="text-[10px] mt-0.5">
                      {contratoDetalhes.status === 'assinado'
                        ? 'Clique no botão acima para gerar as 12 faturas Pix.'
                        : 'As faturas serão geradas automaticamente após a assinatura digital do contrato.'}
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Parcela</th>
                          <th className="py-2.5 px-3">Vencimento</th>
                          <th className="py-2.5 px-3">Valor</th>
                          <th className="py-2.5 px-3">Meio</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Chave Pix</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {contratoDetalhes.parcelas.map((parc) => (
                          <tr key={parc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">
                              {parc.parcela_numero || 1}/{parc.parcela_total || 12}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">
                              {new Date(parc.data_vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="py-2 px-3 font-bold text-salvia-700 dark:text-salvia-300 font-mono">
                              R$ {parc.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 uppercase text-[10px] font-semibold text-slate-500">
                              {parc.metodo_pagamento}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  parc.status === 'pago'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : parc.status === 'atrasado'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {parc.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {parc.qr_code_pix ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(parc.qr_code_pix!, 'pix', parc.id)}
                                  className="text-[11px] font-semibold text-salvia-700 hover:text-salvia-900 dark:text-salvia-400 inline-flex items-center gap-1"
                                >
                                  {copiedPixId === parc.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-600">Copiado</span>
                                    </>
                                  ) : (
                                    <>
                                      <QrCode className="w-3 h-3" />
                                      <span>Copiar Pix</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[10px]">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Botão para ir para o financeiro */}
              {onNavigateToFinanceiro && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setContratoDetalhes(null);
                      onNavigateToFinanceiro();
                    }}
                    className="text-xs font-bold text-salvia-700 dark:text-salvia-400 hover:underline flex items-center gap-1"
                  >
                    <span>Abrir faturas no Financeiro</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
