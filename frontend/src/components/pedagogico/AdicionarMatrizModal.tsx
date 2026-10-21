import React from 'react';
import { Layers, X } from 'lucide-react';
import { Disciplina } from './types';

export interface AdicionarMatrizModalProps {
  setShowModalAdicionarMatriz: (show: boolean) => void;
  handleAdicionarMatriz: (e: React.FormEvent) => void;
  matrizDiscId: string;
  setMatrizDiscId: (value: string) => void;
  disciplinas: Disciplina[];
  setMatrizChSemanal: (value: number) => void;
  setMatrizChAnual: (value: number) => void;
  matrizChSemanal: number;
  matrizChAnual: number;
}

export function AdicionarMatrizModal({
  setShowModalAdicionarMatriz,
  handleAdicionarMatriz,
  matrizDiscId,
  setMatrizDiscId,
  disciplinas,
  setMatrizChSemanal,
  setMatrizChAnual,
  matrizChSemanal,
  matrizChAnual,
}: AdicionarMatrizModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
            <span>Vincular Componente à Matriz da Turma</span>
          </h3>
          <button onClick={() => setShowModalAdicionarMatriz(false)} className="text-slate-400 hover:text-slate-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleAdicionarMatriz} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Selecione a Disciplina *</label>
            <select
              required
              value={matrizDiscId}
              onChange={(e) => {
                setMatrizDiscId(e.target.value);
                const selected = disciplinas.find((d) => d.id === e.target.value);
                if (selected) {
                  setMatrizChSemanal(selected.carga_horaria_semanal);
                  setMatrizChAnual(selected.carga_horaria_anual);
                }
              }}
              className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold"
            >
              <option value="">Selecione um componente curricular...</option>
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.codigo} - {d.nome} ({d.area_conhecimento})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold mb-1">Aulas Semanais *</label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={matrizChSemanal}
                onChange={(e) => setMatrizChSemanal(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Carga Anual (h) *</label>
              <input
                type="number"
                min={20}
                max={800}
                required
                value={matrizChAnual}
                onChange={(e) => setMatrizChAnual(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowModalAdicionarMatriz(false)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
            >
              Cancelar
            </button>
            <button type="submit" className="px-4 py-1.5 bg-salvia-700 text-white rounded-xl font-bold hover:bg-salvia-800">
              Adicionar à Turma
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
