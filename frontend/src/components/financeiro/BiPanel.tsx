import React from 'react';
import { PieChart, Upload } from 'lucide-react';
import { DreReport } from './types';

export interface BiPanelProps {
  dre: DreReport | null;
  handleOFXUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function BiPanel({
  dre,
  handleOFXUpload,
}: BiPanelProps) {
  return (
    <div className="p-5 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-2">
          <PieChart className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
          <span>Demonstrativo do Resultado (DRE) & DFC Fluxo de Caixa Projetado</span>
        </h3>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-900 px-3 py-1.5 text-[11px] font-bold text-salvia-800 dark:text-salvia-200">
          <Upload className="w-3.5 h-3.5" />
          Importar OFX
          <input type="file" accept=".ofx,.OFX" className="hidden" onChange={handleOFXUpload} />
        </label>
      </div>
      <p className="text-[11px] text-slate-500">
        Conciliação tenta casar crédito/débito por valor (±R$ 0,02) e data. Relatório gerencial (não contábil).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
          <span className="font-bold text-slate-900 dark:text-salvia-50 block border-b pb-1">DRE Gerencial Sintético</span>
          <div className="flex justify-between">
            <span>(+) Receita Bruta de Mensalidades:</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
              R$ {(dre?.receita_bruta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>(-) Custos e Despesas Operacionais:</span>
            <span className="text-rose-700 dark:text-rose-400 font-bold">
              R$ {(dre?.despesas_totais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1 font-bold">
            <span>(=) Resultado Operacional Líquido:</span>
            <span className="text-slate-900 dark:text-salvia-50">
              R$ {(dre?.resultado_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
          <span className="font-bold text-slate-900 dark:text-salvia-50 block border-b pb-1">DFC - Fluxo de Caixa Projetado</span>
          <div className="flex justify-between">
            <span>Caixa Atual Disponível:</span>
            <span className="text-slate-900 dark:text-salvia-50 font-bold">
              R$ {(dre?.resultado_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Recuperação Projetada Régua (40% Inadimp.):</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
              + R$ {(((dre?.inadimplencia_total || 0) * 0.4)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1 font-bold">
            <span>(=) Projeção de Caixa 30 Dias:</span>
            <span className="text-emerald-700 dark:text-emerald-400">
              R$ {(dre?.dfc_caixa_projetado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
