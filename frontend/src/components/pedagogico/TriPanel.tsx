import React from 'react';
import { BrainCircuit, Plus, Calendar } from 'lucide-react';
import type { SimuladoTri } from './types';

export interface TriPanelProps {
  simulados: SimuladoTri[];
  setShowModalSimulado: (show: boolean) => void;
}

export function TriPanel({
  simulados,
  setShowModalSimulado,
}: TriPanelProps) {
  return (
    <div className="animate-fade-in p-6 bg-white dark:bg-salvia-900 rounded-b-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-bold text-salvia-900 dark:text-salvia-100 flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-indigo-500" />
            <span>Simulados Preditivos (Teoria da Resposta ao Item)</span>
          </h3>
          <p className="text-sm text-salvia-600 dark:text-salvia-400 max-w-2xl mt-1">
            A tecnologia TRI cruza o histórico do aluno com os parâmetros de dificuldade (b), discriminação (a) e acerto casual (c). O painel gera análises de proficiência para o ENEM e exporta diretamente para o EducaCenso.
          </p>
        </div>
        <button
          onClick={() => setShowModalSimulado(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Simulado</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {simulados.map((s) => (
          <div key={s.id} className="bg-salvia-50 dark:bg-salvia-800/50 p-5 rounded-2xl border border-salvia-200 dark:border-salvia-700">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">
                {s.disciplina}
              </span>
              <span className="text-xs text-salvia-500 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1" /> {s.data_aplicacao}
              </span>
            </div>
            <h4 className="font-bold text-salvia-900 dark:text-salvia-50 mb-1">{s.titulo}</h4>
            <p className="text-xs text-salvia-600 dark:text-salvia-400 line-clamp-2 mb-4">
              {s.descricao || "Simulado preparatório para exames nacionais."}
            </p>
            <div className="flex justify-between items-center text-xs font-semibold text-salvia-500 pt-3 border-t border-salvia-200 dark:border-salvia-700">
              <span>{s.total_itens} Itens TRI</span>
              <button className="text-indigo-600 dark:text-indigo-400 hover:underline">Exportar Censo</button>
            </div>
          </div>
        ))}
        {simulados.length === 0 && (
          <div className="col-span-full p-8 text-center text-salvia-500 bg-salvia-50/50 dark:bg-salvia-900/30 rounded-2xl border border-dashed border-salvia-300 dark:border-salvia-700">
            Nenhum simulado cadastrado.
          </div>
        )}
      </div>
    </div>
  );
}
