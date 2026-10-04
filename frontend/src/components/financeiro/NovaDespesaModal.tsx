import React from 'react';
import { X } from 'lucide-react';
import { Fornecedor } from './types';
import { NovoFornecedorFormProps } from './NovoFornecedorModal';

export interface NovaDespesaFormProps {
  descricao: string;
  categoria: string;
  valor: string;
  data_vencimento: string;
  tipo: string;
  fornecedor_id: string;
}

export interface NovaDespesaModalProps {
  setShowNovaDespesaModal: (show: boolean) => void;
  handleCriarDespesa: (e: React.FormEvent) => void;
  novaDespesa: NovaDespesaFormProps;
  setNovaDespesa: React.Dispatch<React.SetStateAction<NovaDespesaFormProps>>;
  fornecedores: Fornecedor[];
  novoFornecedor: NovoFornecedorFormProps;
  setNovoFornecedor: React.Dispatch<React.SetStateAction<NovoFornecedorFormProps>>;
}

export function NovaDespesaModal({
  setShowNovaDespesaModal,
  handleCriarDespesa,
  novaDespesa,
  setNovaDespesa,
  fornecedores,
  novoFornecedor,
  setNovoFornecedor,
}: NovaDespesaModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-salvia-100 dark:border-salvia-800 mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Cadastrar Nova Despesa</h3>
          <button
            onClick={() => setShowNovaDespesaModal(false)}
            className="text-salvia-400 hover:text-salvia-900 dark:hover:text-salvia-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCriarDespesa} className="space-y-3 text-xs">
          <div>
            <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
              Descrição da Despesa
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Aquisição de Livros para Biblioteca"
              value={novaDespesa.descricao}
              onChange={(e) => setNovaDespesa({ ...novaDespesa, descricao: e.target.value })}
              className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={novaDespesa.valor}
                onChange={(e) => setNovaDespesa({ ...novaDespesa, valor: e.target.value })}
                className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                Data de Vencimento
              </label>
              <input
                type="date"
                required
                value={novaDespesa.data_vencimento}
                onChange={(e) => setNovaDespesa({ ...novaDespesa, data_vencimento: e.target.value })}
                className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                Categoria
              </label>
              <select
                value={novaDespesa.categoria}
                onChange={(e) => setNovaDespesa({ ...novaDespesa, categoria: e.target.value })}
                className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
              >
                <option value="folha_pagamento">Folha de Pagamento</option>
                <option value="manutencao">Manutenção Predial</option>
                <option value="insumos">Insumos & Software</option>
                <option value="alimentacao">Alimentação Escolar</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
                Tipo de Custo
              </label>
              <select
                value={novaDespesa.tipo}
                onChange={(e) => setNovaDespesa({ ...novaDespesa, tipo: e.target.value })}
                className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
              >
                <option value="fixo">Fixo</option>
                <option value="variavel">Variável</option>
                <option value="pontual">Pontual</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-salvia-700 dark:text-salvia-300 font-semibold mb-1">
              Fornecedor
            </label>
            <select
              required
              value={novaDespesa.fornecedor_id}
              onChange={(e) => setNovaDespesa({ ...novaDespesa, fornecedor_id: e.target.value })}
              className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
            >
              <option value="">Selecione um fornecedor</option>
              {fornecedores.filter((f) => (f.status || 'ativo') === 'ativo').map((f) => (
                <option key={f.id} value={f.id}>
                  {f.razao_social}
                </option>
              ))}
              <option value="__novo__">+ Cadastrar novo fornecedor</option>
            </select>
          </div>

          {novaDespesa.fornecedor_id === '__novo__' && (
            <div className="space-y-2 rounded-xl border border-salvia-200 dark:border-salvia-700 p-3">
              <input
                type="text"
                required
                placeholder="Razão social"
                value={novoFornecedor.razao_social}
                onChange={(e) => setNovoFornecedor({ ...novoFornecedor, razao_social: e.target.value })}
                className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="CNPJ"
                  value={novoFornecedor.cnpj}
                  onChange={(e) => setNovoFornecedor({ ...novoFornecedor, cnpj: e.target.value })}
                  className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 font-mono"
                />
                <input
                  type="text"
                  required
                  placeholder="Ramo"
                  value={novoFornecedor.ramo_atividade}
                  onChange={(e) => setNovoFornecedor({ ...novoFornecedor, ramo_atividade: e.target.value })}
                  className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  required
                  placeholder="E-mail"
                  value={novoFornecedor.email}
                  onChange={(e) => setNovoFornecedor({ ...novoFornecedor, email: e.target.value })}
                  className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
                />
                <input
                  type="text"
                  required
                  placeholder="Telefone"
                  value={novoFornecedor.telefone}
                  onChange={(e) => setNovoFornecedor({ ...novoFornecedor, telefone: e.target.value })}
                  className="w-full p-2 rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowNovaDespesaModal(false)}
              className="px-3 py-1.5 rounded-xl border border-salvia-200 dark:border-salvia-700 text-salvia-700 dark:text-salvia-300 font-semibold hover:bg-salvia-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white px-4 py-1.5 rounded-xl font-bold"
            >
              Salvar Despesa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
