import React from 'react';
import { X } from 'lucide-react';
import { AlunoOpcao } from './types';

export interface NovaFaturaFormProps {
  aluno_id: string;
  descricao: string;
  valor: string;
  data_vencimento: string;
  metodo_pagamento: string;
  desconto_percentual: string;
}

export interface NovaFaturaModalProps {
  setShowNovaFaturaModal: (show: boolean) => void;
  handleCriarFatura: (e: React.FormEvent) => void;
  novaFatura: NovaFaturaFormProps;
  setNovaFatura: React.Dispatch<React.SetStateAction<NovaFaturaFormProps>>;
  alunosOpcoes: AlunoOpcao[];
}

export function NovaFaturaModal({
  setShowNovaFaturaModal,
  handleCriarFatura,
  novaFatura,
  setNovaFatura,
  alunosOpcoes,
}: NovaFaturaModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-salvia-100 dark:border-salvia-800 mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Nova Fatura / Mensalidade</h3>
          <button type="button" onClick={() => setShowNovaFaturaModal(false)}>
            <X className="w-5 h-5 text-salvia-400" />
          </button>
        </div>
        <form onSubmit={handleCriarFatura} className="space-y-3 text-xs">
          <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
            Aluno
            <select
              required
              value={novaFatura.aluno_id}
              onChange={(e) => setNovaFatura({ ...novaFatura, aluno_id: e.target.value })}
              className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2"
            >
              <option value="">Selecione...</option>
              {alunosOpcoes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
            Descrição
            <input
              required
              value={novaFatura.descricao}
              onChange={(e) => setNovaFatura({ ...novaFatura, descricao: e.target.value })}
              className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2"
              placeholder="Mensalidade Março/2026"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
              Valor (R$)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={novaFatura.valor}
                onChange={(e) => setNovaFatura({ ...novaFatura, valor: e.target.value })}
                className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2 font-mono"
              />
            </label>
            <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
              Desconto (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={novaFatura.desconto_percentual}
                onChange={(e) => setNovaFatura({ ...novaFatura, desconto_percentual: e.target.value })}
                className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2 font-mono"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
              Vencimento
              <input
                type="date"
                required
                value={novaFatura.data_vencimento}
                onChange={(e) => setNovaFatura({ ...novaFatura, data_vencimento: e.target.value })}
                className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2"
              />
            </label>
            <label className="block font-semibold text-salvia-700 dark:text-salvia-300">
              Método
              <select
                value={novaFatura.metodo_pagamento}
                onChange={(e) => setNovaFatura({ ...novaFatura, metodo_pagamento: e.target.value })}
                className="mt-1 w-full rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 p-2"
              >
                <option value="pix">Pix</option>
                <option value="boleto">Boleto (sintético)</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowNovaFaturaModal(false)} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold">
              Cancelar
            </button>
            <button type="submit" className="px-3 py-1.5 rounded-xl bg-salvia-700 text-white font-bold">
              Gerar fatura
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
