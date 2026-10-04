import React from 'react';
import { Clock, ShieldCheck, UserCheck, Trash2 } from 'lucide-react';
import type { Turma, TurmaDisciplinaDetalhada, HorarioTurmaDetalhado } from './types';

export interface HorariosPanelProps {
  selectedTurmaId: string;
  setSelectedTurmaId: (id: string) => void;
  turmas: Turma[];
  turmaDisciplinas: TurmaDisciplinaDetalhada[];
  setAtribDiscId: (id: string) => void;
  setShowModalAtribuirProf: (show: boolean) => void;
  setHorarioDiscId: (id: string) => void;
  setShowModalHorario: (show: boolean) => void;
  selectedTurmaObj: Turma | undefined;
  turmaHorarios: HorarioTurmaDetalhado[];
  diaSemanaLabel: (dia: number) => string;
  handleDeletarHorario: (horarioId: string) => Promise<void>;
}

export function HorariosPanel({
  selectedTurmaId,
  setSelectedTurmaId,
  turmas,
  turmaDisciplinas,
  setAtribDiscId,
  setShowModalAtribuirProf,
  setHorarioDiscId,
  setShowModalHorario,
  selectedTurmaObj,
  turmaHorarios,
  diaSemanaLabel,
  handleDeletarHorario,
}: HorariosPanelProps) {
  return (
    <div className="space-y-6">
      {/* Seletor de Turma */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#0c120e] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            Turma para Alocação:
          </span>
          <select
            value={selectedTurmaId}
            onChange={(e) => setSelectedTurmaId(e.target.value)}
            className="bg-white dark:bg-[#141d17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-salvia-600"
          >
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} ({t.turno || 'Matutino'}) — Ano {t.ano_letivo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (turmaDisciplinas.length > 0) {
                setAtribDiscId(turmaDisciplinas[0].disciplina_id);
              }
              setShowModalAtribuirProf(true);
            }}
            className="bg-salvia-700 hover:bg-salvia-800 dark:bg-salvia-600 dark:hover:bg-salvia-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>+ Atribuir Docente</span>
          </button>

          <button
            onClick={() => {
              if (turmaDisciplinas.length > 0) {
                setHorarioDiscId(turmaDisciplinas[0].disciplina_id);
              }
              setShowModalHorario(true);
            }}
            className="bg-salvia-700 hover:bg-salvia-800 dark:bg-salvia-600 dark:hover:bg-salvia-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>+ Adicionar Aula Semanal</span>
          </button>
        </div>
      </div>

      {/* Quadro Semanal de Horários */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
            <span>Grade Semanal de Horários da Turma ({selectedTurmaObj?.nome})</span>
          </h3>
          <div className="flex items-center space-x-1 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Motor Anti-Choque de Docente & Sala Ativo</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((dia) => {
            const aulasDoDia = turmaHorarios
              .filter((h) => h.dia_semana === dia)
              .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

            return (
              <div
                key={dia}
                className="bg-slate-50 dark:bg-[#0c120e] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{diaSemanaLabel(dia)}</span>
                </div>

                <div className="p-2 space-y-2 min-h-[140px]">
                  {aulasDoDia.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-3 text-center text-[10px] text-slate-400 italic">
                      Sem aulas agendadas
                    </div>
                  ) : (
                    aulasDoDia.map((aula) => (
                      <div
                        key={aula.id}
                        className="bg-white dark:bg-[#141d17] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-1 relative group"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-mono font-bold text-salvia-700 dark:text-salvia-400 bg-salvia-50 dark:bg-salvia-900/60 px-1 py-0.5 rounded">
                            {aula.hora_inicio} - {aula.hora_fim}
                          </span>
                          <button
                            onClick={() => handleDeletarHorario(aula.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remover horário"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight">
                          {aula.disciplina_nome}
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                          <UserCheck className="w-3 h-3 text-salvia-600" />
                          <span>{aula.professor_nome || 'Docente a definir'}</span>
                        </div>
                        {aula.sala_nome && (
                          <div className="text-[9px] text-slate-500 font-mono">Espaço: {aula.sala_nome}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
