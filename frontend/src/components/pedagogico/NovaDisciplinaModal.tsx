import React from 'react';
import { GraduationCap, X } from 'lucide-react';

export interface NovaDisciplinaModalProps {
  setShowModalDisciplina: (show: boolean) => void;
  handleSalvarDisciplina: (e: React.FormEvent) => void;
  discCodigo: string;
  setDiscCodigo: (value: string) => void;
  discArea: string;
  setDiscArea: (value: string) => void;
  discNome: string;
  setDiscNome: (value: string) => void;
  discChSemanal: number;
  setDiscChSemanal: (value: number) => void;
  discChAnual: number;
  setDiscChAnual: (value: number) => void;
  discDescricao: string;
  setDiscDescricao: (value: string) => void;
}

export function NovaDisciplinaModal({
  setShowModalDisciplina,
  handleSalvarDisciplina,
  discCodigo,
  setDiscCodigo,
  discArea,
  setDiscArea,
  discNome,
  setDiscNome,
  discChSemanal,
  setDiscChSemanal,
  discChAnual,
  setDiscChAnual,
  discDescricao,
  setDiscDescricao,
}: NovaDisciplinaModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
            <span>Novo Componente Curricular (BNCC)</span>
          </h3>
          <button onClick={() => setShowModalDisciplina(false)} className="text-slate-400 hover:text-slate-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSalvarDisciplina} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold mb-1">Código da Matéria *</label>
              <input
                type="text"
                required
                value={discCodigo}
                onChange={(e) => setDiscCodigo(e.target.value)}
                placeholder="Ex: MAT-01"
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 uppercase font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Área BNCC *</label>
              <select
                value={discArea}
                onChange={(e) => setDiscArea(e.target.value)}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
              >
                <option value="linguagens">Linguagens</option>
                <option value="matematica">Matemática</option>
                <option value="ciencias_natureza">Ciências da Natureza</option>
                <option value="ciencias_humanas">Ciências Humanas</option>
                <option value="ensino_religioso">Ensino Religioso</option>
                <option value="parte_diversificada">Parte Diversificada / Eletivas</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Nome da Disciplina *</label>
            <input
              type="text"
              required
              value={discNome}
              onChange={(e) => setDiscNome(e.target.value)}
              placeholder="Ex: Filosofia e Cidadania Contemporânea"
              className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold mb-1">Aulas Semanais *</label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={discChSemanal}
                onChange={(e) => setDiscChSemanal(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Carga Horária Anual (h) *</label>
              <input
                type="number"
                min={20}
                max={800}
                required
                value={discChAnual}
                onChange={(e) => setDiscChAnual(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Ementa / Descrição</label>
            <textarea
              rows={2}
              value={discDescricao}
              onChange={(e) => setDiscDescricao(e.target.value)}
              placeholder="Objetivos e competências a serem desenvolvidas..."
              className="w-full bg-slate-50 dark:bg-canvas-dark border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowModalDisciplina(false)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
            >
              Cancelar
            </button>
            <button type="submit" className="px-4 py-1.5 bg-salvia-700 text-white rounded-xl font-bold hover:bg-salvia-800">
              Cadastrar Componente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
