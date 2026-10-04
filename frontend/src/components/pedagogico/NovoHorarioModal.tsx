import React from 'react';
import { Clock, X } from 'lucide-react';
import { ProfessorItem, SalaItem, TurmaDisciplinaDetalhada } from './types';

export interface NovoHorarioModalProps {
  setShowModalHorario: (show: boolean) => void;
  handleCriarHorario: (e: React.FormEvent) => void;
  horarioDiaSemana: number;
  setHorarioDiaSemana: (value: number) => void;
  horarioInicio: string;
  setHorarioInicio: (value: string) => void;
  horarioFim: string;
  setHorarioFim: (value: string) => void;
  horarioDiscId: string;
  setHorarioDiscId: (value: string) => void;
  turmaDisciplinas: TurmaDisciplinaDetalhada[];
  setHorarioProfId: (value: string) => void;
  horarioProfId: string;
  professores: ProfessorItem[];
  horarioSalaId: string;
  setHorarioSalaId: (value: string) => void;
  salas: SalaItem[];
}

export function NovoHorarioModal({
  setShowModalHorario,
  handleCriarHorario,
  horarioDiaSemana,
  setHorarioDiaSemana,
  horarioInicio,
  setHorarioInicio,
  horarioFim,
  setHorarioFim,
  horarioDiscId,
  setHorarioDiscId,
  turmaDisciplinas,
  setHorarioProfId,
  horarioProfId,
  professores,
  horarioSalaId,
  setHorarioSalaId,
  salas,
}: NovoHorarioModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
              <span>Adicionar Aula ao Quadro Semanal</span>
            </h3>
            <p className="text-[11px] text-slate-500">Validação automática contra choques de professor ou sala física.</p>
          </div>
          <button onClick={() => setShowModalHorario(false)} className="text-slate-400 hover:text-slate-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCriarHorario} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold mb-1">Dia da Semana *</label>
              <select
                value={horarioDiaSemana}
                onChange={(e) => setHorarioDiaSemana(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold"
              >
                <option value={1}>Segunda-feira</option>
                <option value={2}>Terça-feira</option>
                <option value={3}>Quarta-feira</option>
                <option value={4}>Quinta-feira</option>
                <option value={5}>Sexta-feira</option>
                <option value={6}>Sábado</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block font-semibold mb-1">Início *</label>
                <input
                  type="time"
                  required
                  value={horarioInicio}
                  onChange={(e) => setHorarioInicio(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Término *</label>
                <input
                  type="time"
                  required
                  value={horarioFim}
                  onChange={(e) => setHorarioFim(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Disciplina *</label>
            <select
              required
              value={horarioDiscId}
              onChange={(e) => {
                setHorarioDiscId(e.target.value);
                const td = turmaDisciplinas.find((d) => d.disciplina_id === e.target.value);
                if (td?.professor_id) {
                  setHorarioProfId(td.professor_id);
                }
              }}
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold mb-1">Professor da Aula</label>
              <select
                value={horarioProfId}
                onChange={(e) => setHorarioProfId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
              >
                <option value="">Mesmo da lotação / Nenhum</option>
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Espaço / Sala</label>
              <select
                value={horarioSalaId}
                onChange={(e) => setHorarioSalaId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5"
              >
                <option value="">Sala padrão da turma</option>
                {salas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({s.capacidade} vagas)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowModalHorario(false)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
            >
              Cancelar
            </button>
            <button type="submit" className="px-4 py-1.5 bg-salvia-700 text-white rounded-xl font-bold hover:bg-salvia-800">
              Validar & Inserir Aula
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
