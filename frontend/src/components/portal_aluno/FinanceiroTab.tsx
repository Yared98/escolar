import React from 'react';
import { HelpCircle, Check, QrCode } from 'lucide-react';
import type { FaturaData } from './types';

export interface FinanceiroTabProps {
  faturas: FaturaData[];
  faturasAbertas: FaturaData[];
  faturasPagas: FaturaData[];
  faturasExibidas: FaturaData[];
  filtroStatusFatura: 'todas' | 'abertas' | 'pagas';
  setFiltroStatusFatura: (filtro: 'todas' | 'abertas' | 'pagas') => void;
  setPixModalFatura: (fatura: FaturaData | null) => void;
}

export function FinanceiroTab({
  faturas,
  faturasAbertas,
  faturasPagas,
  faturasExibidas,
  filtroStatusFatura,
  setFiltroStatusFatura,
  setPixModalFatura,
}: FinanceiroTabProps) {
  return (
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
  );
}
