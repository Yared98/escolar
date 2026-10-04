import React from 'react';
import { CalendarClock, X, Check, Search, Plus, QrCode, FileText } from 'lucide-react';
import { Fatura, AgingRange } from './types';

export interface ReceberAgingItemProps {
  count: number;
  total: number;
}

export interface ReceberAgingStatsProps {
  r0_30: ReceberAgingItemProps;
  r31_60: ReceberAgingItemProps;
  r60Plus: ReceberAgingItemProps;
  totalEmAberto: number;
  countEmAberto: number;
}

export interface ReceberPanelProps {
  agingFilter: AgingRange;
  setAgingFilter: (range: AgingRange) => void;
  handleToggleAgingFilter: (faixa: '0-30' | '31-60' | '60+') => void;
  agingStats: ReceberAgingStatsProps;
  statusFilter: 'todos' | 'pendente' | 'pago' | 'atrasado';
  setStatusFilter: (status: 'todos' | 'pendente' | 'pago' | 'atrasado') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setShowNovaFaturaModal: (show: boolean) => void;
  faturasFiltradas: Fatura[];
  calcularDiasAtrasoFatura: (dataVencimentoStr: string) => number;
  handleBaixaManual: (fatura: Fatura) => void;
  setPixModalFatura: (fatura: Fatura) => void;
  handleEmitirNfse: (faturaId: string) => void;
}

export function ReceberPanel({
  agingFilter,
  setAgingFilter,
  handleToggleAgingFilter,
  agingStats,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  setShowNovaFaturaModal,
  faturasFiltradas,
  calcularDiasAtrasoFatura,
  handleBaixaManual,
  setPixModalFatura,
  handleEmitirNfse,
}: ReceberPanelProps) {
  return (
    <div className="space-y-4">
      {/* Seção Aging Operacional de Contas a Receber (AR) */}
      <div className="bg-salvia-50/50 dark:bg-salvia-950/40 border border-salvia-200 dark:border-salvia-800 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center space-x-2">
              <CalendarClock className="w-4 h-4 text-salvia-700 dark:text-salvia-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-salvia-100">
                Aging de Faturas em Aberto (Contas a Receber)
              </h3>
            </div>
            <p className="text-[11px] text-salvia-600 dark:text-salvia-400 mt-0.5">
              Posição operacional de vencimento e atraso para faturas em aberto (pendente + atrasado). Visão operacional da tesouraria, não contábil.
            </p>
          </div>

          {agingFilter && (
            <button
              type="button"
              onClick={() => setAgingFilter(null)}
              className="self-start sm:self-auto text-[11px] font-semibold text-salvia-700 dark:text-salvia-300 hover:text-salvia-900 dark:hover:text-white flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-900 transition-colors shadow-xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar filtro de aging</span>
            </button>
          )}
        </div>

        {/* Grid das Faixas de Aging */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Faixa 0-30 dias */}
          <button
            type="button"
            onClick={() => handleToggleAgingFilter('0-30')}
            className={`p-3.5 rounded-xl border text-left transition-all relative ${
              agingFilter === '0-30'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                : 'bg-white dark:bg-salvia-900/80 border-salvia-200 dark:border-salvia-800 hover:border-salvia-300 dark:hover:border-salvia-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-800 dark:text-salvia-200 flex items-center space-x-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>0–30 dias</span>
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-mono">
                {agingStats.r0_30.count} {agingStats.r0_30.count === 1 ? 'fatura' : 'faturas'}
              </span>
            </div>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono">
              R$ {agingStats.r0_30.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-salvia-500 dark:text-salvia-400 mt-1">
              A vencer ou até 30 dias de vencida
            </p>
            {agingFilter === '0-30' && (
              <div className="absolute top-2 right-2 text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </button>

          {/* Faixa 31-60 dias */}
          <button
            type="button"
            onClick={() => handleToggleAgingFilter('31-60')}
            className={`p-3.5 rounded-xl border text-left transition-all relative ${
              agingFilter === '31-60'
                ? 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                : 'bg-white dark:bg-salvia-900/80 border-salvia-200 dark:border-salvia-800 hover:border-salvia-300 dark:hover:border-salvia-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-800 dark:text-salvia-200 flex items-center space-x-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                <span>31–60 dias</span>
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-mono">
                {agingStats.r31_60.count} {agingStats.r31_60.count === 1 ? 'fatura' : 'faturas'}
              </span>
            </div>
            <p className="text-base font-bold text-amber-700 dark:text-amber-400 font-mono">
              R$ {agingStats.r31_60.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-salvia-500 dark:text-salvia-400 mt-1">
              Atraso de 31 a 60 dias da data limite
            </p>
            {agingFilter === '31-60' && (
              <div className="absolute top-2 right-2 text-amber-600 dark:text-amber-400">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </button>

          {/* Faixa 60+ dias */}
          <button
            type="button"
            onClick={() => handleToggleAgingFilter('60+')}
            className={`p-3.5 rounded-xl border text-left transition-all relative ${
              agingFilter === '60+'
                ? 'bg-rose-50/80 dark:bg-rose-950/50 border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
                : 'bg-white dark:bg-salvia-900/80 border-salvia-200 dark:border-salvia-800 hover:border-salvia-300 dark:hover:border-salvia-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-800 dark:text-salvia-200 flex items-center space-x-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
                <span>60+ dias</span>
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-mono">
                {agingStats.r60Plus.count} {agingStats.r60Plus.count === 1 ? 'fatura' : 'faturas'}
              </span>
            </div>
            <p className="text-base font-bold text-rose-700 dark:text-rose-400 font-mono">
              R$ {agingStats.r60Plus.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-salvia-500 dark:text-salvia-400 mt-1">
              Atraso superior a 60 dias (crítico)
            </p>
            {agingFilter === '60+' && (
              <div className="absolute top-2 right-2 text-rose-600 dark:text-rose-400">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['todos', 'pendente', 'pago', 'atrasado'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                statusFilter === status
                  ? 'bg-salvia-700 text-white dark:bg-salvia-500 shadow-sm'
                  : 'bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200'
              }`}
            >
              {status}
            </button>
          ))}

          {agingFilter && (
            <div className="flex items-center space-x-1 pl-2 border-l border-salvia-200 dark:border-salvia-700">
              <span className="text-[11px] px-2.5 py-0.5 rounded-lg font-semibold bg-salvia-200 dark:bg-salvia-800 text-salvia-900 dark:text-salvia-100 flex items-center space-x-1.5">
                <span>Aging: {agingFilter === '0-30' ? '0–30 dias' : agingFilter === '31-60' ? '31–60 dias' : '60+ dias'}</span>
                <button
                  type="button"
                  onClick={() => setAgingFilter(null)}
                  className="p-0.5 hover:text-rose-600 dark:hover:text-rose-400"
                  title="Remover filtro de aging"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-salvia-400" />
            <input
              type="text"
              placeholder="Buscar por descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowNovaFaturaModal(true)}
            className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Fatura</span>
          </button>
        </div>
      </div>

      {/* Tabela de Faturas */}
      <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[11px] tracking-wider border-b border-salvia-200 dark:border-salvia-800">
            <tr>
              <th className="p-3">Descrição da Fatura</th>
              <th className="p-3">Vencimento</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Método</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 text-slate-800 dark:text-salvia-200 font-medium">
            {faturasFiltradas.length > 0 ? (
              faturasFiltradas.map((fatura) => (
                <tr key={fatura.id} className="hover:bg-salvia-50/70 dark:hover:bg-salvia-800/40 transition-colors">
                  <td className="p-3 font-bold text-slate-900 dark:text-salvia-50">{fatura.descricao}</td>
                  <td className="p-3 text-salvia-600 dark:text-salvia-400 font-mono">
                    <div>{fatura.data_vencimento}</div>
                    {fatura.status !== 'pago' && (() => {
                      const dias = calcularDiasAtrasoFatura(fatura.data_vencimento);
                      if (dias > 0) {
                        return (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold font-sans block">
                            {dias}d de atraso
                          </span>
                        );
                      }
                      return (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans block">
                          no prazo
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-3 font-bold text-slate-900 dark:text-salvia-50 font-mono">
                    R$ {fatura.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 uppercase text-[10px] font-mono text-salvia-600 dark:text-salvia-400 font-bold">
                    {fatura.metodo_pagamento}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        fatura.status === 'pago'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                          : fatura.status === 'atrasado'
                          ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300'
                      }`}
                    >
                      {fatura.status}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                    {fatura.status !== 'pago' && (
                      <button
                        onClick={() => handleBaixaManual(fatura)}
                        title="Dar baixa manual nesta fatura"
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-all inline-flex items-center space-x-1 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </button>
                    )}

                    <button
                      onClick={() => setPixModalFatura(fatura)}
                      className="px-2.5 py-1 bg-salvia-50 dark:bg-salvia-800 border border-salvia-200 dark:border-salvia-700 hover:border-salvia-500 text-salvia-900 dark:text-salvia-100 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center space-x-1"
                    >
                      <QrCode className="w-3.5 h-3.5 text-salvia-600 dark:text-salvia-400" />
                      <span>QR Pix</span>
                    </button>

                    <button
                      onClick={() => handleEmitirNfse(fatura.id)}
                      className="px-2.5 py-1 bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white rounded-lg text-[11px] font-semibold transition-all inline-flex items-center space-x-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>NFS-e</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-salvia-500 text-xs">
                  Nenhuma fatura encontrada para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
