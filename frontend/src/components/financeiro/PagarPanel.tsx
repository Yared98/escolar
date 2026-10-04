import React from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { Despesa } from './types';

export interface PagarPanelProps {
  setShowNovaDespesaModal: (show: boolean) => void;
  despesas: Despesa[];
  handleEstornarDespesa: (despesa: Despesa) => Promise<void>;
}

export function PagarPanel({
  setShowNovaDespesaModal,
  despesas,
  handleEstornarDespesa,
}: PagarPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-900 dark:text-salvia-50 uppercase tracking-wider">
          Contas a Pagar & Despesas Operacionais
        </h3>
        <button
          onClick={() => setShowNovaDespesaModal(true)}
          className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova Despesa</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-100 uppercase font-bold text-[11px] tracking-wider border-b border-salvia-200 dark:border-salvia-800">
            <tr>
              <th className="p-3">Descrição da Despesa</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Fornecedor</th>
              <th className="p-3">Vencimento</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800/60 text-slate-800 dark:text-salvia-200 font-medium">
            {despesas.map((d) => (
              <tr key={d.id} className="hover:bg-salvia-50/70 dark:hover:bg-salvia-800/40 transition-colors">
                <td className="p-3 font-bold text-slate-900 dark:text-salvia-50">{d.descricao}</td>
                <td className="p-3 text-salvia-600 dark:text-salvia-400 capitalize">{d.categoria.replace('_', ' ')}</td>
                <td className="p-3 font-semibold text-slate-900 dark:text-salvia-50">{d.fornecedor_nome || 'N/A'}</td>
                <td className="p-3 text-salvia-600 dark:text-salvia-400 font-mono">{d.data_vencimento}</td>
                <td className="p-3 font-bold text-rose-700 dark:text-rose-400 font-mono">
                  R$ {d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3 uppercase text-[10px] font-mono text-salvia-600 dark:text-salvia-400 font-bold">
                  {d.tipo}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      d.status === 'pago'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                        : d.status === 'estornada' || d.status === 'cancelado'
                        ? 'bg-slate-200 dark:bg-slate-800 border-slate-300 text-slate-600'
                        : 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-300'
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {d.status === 'pago' && (
                    <button
                      type="button"
                      onClick={() => void handleEstornarDespesa(d)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800 px-2 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-300"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Estornar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
