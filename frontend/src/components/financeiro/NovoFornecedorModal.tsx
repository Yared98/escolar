import React from 'react';
import { X } from 'lucide-react';

export interface NovoFornecedorFormProps {
  razao_social: string;
  cnpj: string;
  ramo_atividade: string;
  email: string;
  telefone: string;
}

export interface NovoFornecedorModalProps {
  setShowFornecedorModal: (show: boolean) => void;
  handleCriarFornecedor: (e: React.FormEvent) => void;
  novoFornecedor: NovoFornecedorFormProps;
  setNovoFornecedor: React.Dispatch<React.SetStateAction<NovoFornecedorFormProps>>;
}

export function NovoFornecedorModal({
  setShowFornecedorModal,
  handleCriarFornecedor,
  novoFornecedor,
  setNovoFornecedor,
}: NovoFornecedorModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <form onSubmit={handleCriarFornecedor} className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-md w-full space-y-3 shadow-xl text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-salvia-100 dark:border-salvia-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Cadastrar fornecedor</h3>
          <button type="button" onClick={() => setShowFornecedorModal(false)} className="text-salvia-400"><X className="w-5 h-5" /></button>
        </div>
        <input required placeholder="Razão social" value={novoFornecedor.razao_social} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, razao_social: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950" />
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="CNPJ" value={novoFornecedor.cnpj} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, cnpj: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 font-mono" />
          <input required placeholder="Ramo" value={novoFornecedor.ramo_atividade} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, ramo_atividade: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input required type="email" placeholder="E-mail" value={novoFornecedor.email} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, email: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950" />
          <input required placeholder="Telefone" value={novoFornecedor.telefone} onChange={(e) => setNovoFornecedor({ ...novoFornecedor, telefone: e.target.value })} className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950" />
        </div>
        <div className="flex justify-end space-x-2 pt-2">
          <button type="button" onClick={() => setShowFornecedorModal(false)} className="px-3 py-1.5 rounded-xl border border-salvia-200 dark:border-salvia-700">Cancelar</button>
          <button type="submit" className="bg-salvia-700 text-white px-4 py-1.5 rounded-xl font-bold">Salvar</button>
        </div>
      </form>
    </div>
  );
}
