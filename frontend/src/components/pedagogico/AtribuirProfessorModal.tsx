import React from 'react';
import { UserCheck, X } from 'lucide-react';
import { ProfessorItem, TurmaDisciplinaDetalhada } from './types';

export interface AtribuirProfessorModalProps {
  setShowModalAtribuirProf: (show: boolean) => void;
  handleAtribuirProfessor: (e: React.FormEvent) => void;
  atribDiscId: string;
  setAtribDiscId: (value: string) => void;
  turmaDisciplinas: TurmaDisciplinaDetalhada[];
  atribProfId: string;
  setAtribProfId: (value: string) => void;
  professores: ProfessorItem[];
}

export function AtribuirProfessorModal({
  setShowModalAtribuirProf,
  handleAtribuirProfessor,
  atribDiscId,
  setAtribDiscId,
  turmaDisciplinas,
  atribProfId,
  setAtribProfId,
  professores,
}: AtribuirProfessorModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
            <span>Atribuição Docente (Lotação na Turma)</span>
          </h3>
          <button onClick={() => setShowModalAtribuirProf(false)} className="text-slate-400 hover:text-slate-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleAtribuirProfessor} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Disciplina / Componente *</label>
            <select
              required
              value={atribDiscId}
              onChange={(e) => setAtribDiscId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold"
            >
              <option value="">Selecione a disciplina...</option>
              {turmaDisciplinas.map((td) => (
                <option key={td.disciplina_id} value={td.disciplina_id}>
                  {td.disciplina_codigo} - {td.disciplina_nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Professor Responsável *</label>
            <select
              required
              value={atribProfId}
              onChange={(e) => setAtribProfId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold"
            >
              <option value="">Selecione o docente...</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowModalAtribuirProf(false)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
            >
              Cancelar
            </button>
            <button type="submit" className="px-4 py-1.5 bg-salvia-700 text-white rounded-xl font-bold hover:bg-salvia-800">
              Homologar Atribuição
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
