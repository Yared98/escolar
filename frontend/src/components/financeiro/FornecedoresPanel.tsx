import React from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { Fornecedor } from './types';

export interface FornecedoresPanelProps {
  setShowFornecedorModal: (show: boolean) => void;
  fornecedores: Fornecedor[];
  handleInativarFornecedor: (id: string) => Promise<void>;
}

export function FornecedoresPanel({
  setShowFornecedorModal,
  fornecedores,
  handleInativarFornecedor,
}: FornecedoresPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-900 dark:text-salvia-50 uppercase tracking-wider">
          Cadastro de fornecedores
        </h3>
        <button
          type="button"
          onClick={() => setShowFornecedorModal(true)}
          className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo fornecedor</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fornecedores.map((fn) => (
          <div key={fn.id} className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-1.5">
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-slate-900 dark:text-salvia-50 text-xs">{fn.razao_social}</h4>
              <div className="flex items-center space-x-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${fn.status === 'inativo' ? 'bg-slate-200 text-slate-600' : 'bg-salvia-200 dark:bg-salvia-800 text-salvia-800 dark:text-salvia-200'}`}>
                  {fn.status === 'inativo' ? 'inativo' : (fn.ramo_atividade || 'ativo')}
                </span>
                {fn.status !== 'inativo' && (
                  <button type="button" onClick={() => handleInativarFornecedor(fn.id)} className="p-1 text-rose-600" title="Inativar fornecedor">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-salvia-600 dark:text-salvia-400 font-mono">CNPJ: {fn.cnpj}</p>
            <div className="flex justify-between text-xs text-salvia-500 pt-1 border-t border-salvia-200 dark:border-salvia-800">
              <span>{fn.email}</span>
              <span className="font-mono font-bold">{fn.telefone}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
