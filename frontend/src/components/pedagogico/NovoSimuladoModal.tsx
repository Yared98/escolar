import React from 'react';
import { BrainCircuit, X } from 'lucide-react';

export interface NovoSimuladoFormProps {
  titulo: string;
  descricao: string;
  disciplina: string;
  data_aplicacao: string;
}

export interface NovoSimuladoModalProps {
  setShowModalSimulado: (show: boolean) => void;
  handleCriarSimulado: (e: React.FormEvent) => void;
  novoSimulado: NovoSimuladoFormProps;
  setNovoSimulado: (value: NovoSimuladoFormProps) => void;
}

export function NovoSimuladoModal({
  setShowModalSimulado,
  handleCriarSimulado,
  novoSimulado,
  setNovoSimulado,
}: NovoSimuladoModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-salvia-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-6 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-salvia-900 dark:text-salvia-100 flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-indigo-500" />
            <span>Cadastrar Simulado (TRI)</span>
          </h3>
          <button onClick={() => setShowModalSimulado(false)} className="text-slate-400 hover:text-slate-900 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleCriarSimulado} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Título do Exame</label>
            <input
              type="text"
              required
              value={novoSimulado.titulo}
              onChange={(e) => setNovoSimulado({ ...novoSimulado, titulo: e.target.value })}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
              placeholder="Ex: Simulado Geral Enem"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Área / Disciplina</label>
              <select
                value={novoSimulado.disciplina}
                onChange={(e) => setNovoSimulado({ ...novoSimulado, disciplina: e.target.value })}
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
              >
                <option>Matemática</option>
                <option>Linguagens</option>
                <option>Ciências da Natureza</option>
                <option>Geral (Múltiplas)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Data Aplicação</label>
              <input
                type="date"
                required
                value={novoSimulado.data_aplicacao}
                onChange={(e) => setNovoSimulado({ ...novoSimulado, data_aplicacao: e.target.value })}
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Descrição</label>
            <textarea
              value={novoSimulado.descricao}
              onChange={(e) => setNovoSimulado({ ...novoSimulado, descricao: e.target.value })}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <p className="text-[10px] text-salvia-500 italic">
            * Os parâmetros (a, b, c) dos itens serão gerados aleatoriamente pelo Motor IA nesta demonstração.
          </p>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition-all"
          >
            Ativar Modelo Preditivo
          </button>
        </form>
      </div>
    </div>
  );
}
