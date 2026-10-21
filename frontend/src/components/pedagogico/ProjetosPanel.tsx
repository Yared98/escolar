import React from 'react';
import { Calendar } from 'lucide-react';
import type { ProjetoEducacional } from './types';

export interface ProjetosPanelProps {
  projetos: ProjetoEducacional[];
}

export function ProjetosPanel({
  projetos,
}: ProjetosPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Projetos Pedagógicos em Execução ({projetos.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projetos.map((p) => (
          <div
            key={p.id}
            className="bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2"
          >
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">{p.titulo}</h4>
              <span className="text-[9px] bg-salvia-100 text-salvia-800 dark:bg-salvia-900 dark:text-salvia-300 px-2 py-0.5 rounded-full font-bold uppercase">
                {p.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">{p.objetivo}</p>
            {p.habilidades_bncc && (
              <div className="text-[10px] text-salvia-700 dark:text-salvia-400 font-mono bg-salvia-50 dark:bg-salvia-950 p-1.5 rounded-lg border border-salvia-200 dark:border-salvia-800">
                BNCC: {p.habilidades_bncc}
              </div>
            )}
            <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1 pt-1 border-t border-slate-200 dark:border-slate-800">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Vigência: {p.data_inicio} até {p.data_fim}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
