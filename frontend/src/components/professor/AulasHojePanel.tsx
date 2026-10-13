'use client';

import React from 'react';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  BookOpen,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { AulaDia, MinhaTurma } from '@/lib/types/academico';
import { etapaEnsinoLabel } from '@/lib/etapas';

interface AulasHojePanelProps {
  dataAula: string;
  tituloData: string;
  onVoltarDia: () => void;
  onAvancarDia: () => void;
  onHoje: () => void;
  aulas: AulaDia[];
  loadingAulas: boolean;
  erroAulas: string | null;
  onTentarAulas: () => void;
  minhasTurmas: MinhaTurma[];
  loadingTurmas: boolean;
  erroTurmas: string | null;
  onTentarTurmas: () => void;
  onIrParaChamada: (turmaId: string, data: string, disciplinaId?: string, horarioId?: string) => void;
}

export function AulasHojePanel({
  dataAula,
  tituloData,
  onVoltarDia,
  onAvancarDia,
  onHoje,
  aulas,
  loadingAulas,
  erroAulas,
  onTentarAulas,
  minhasTurmas,
  loadingTurmas,
  erroTurmas,
  onTentarTurmas,
  onIrParaChamada,
}: AulasHojePanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onVoltarDia}
          aria-label="Dia anterior"
          className="p-2.5 rounded-xl bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200 dark:hover:bg-salvia-700 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">{tituloData}</h3>
          {!tituloData.startsWith('Hoje') && (
            <button
              type="button"
              onClick={onHoje}
              className="text-[11px] font-bold text-salvia-600 dark:text-salvia-400 hover:text-salvia-800 dark:hover:text-salvia-200 underline underline-offset-2"
            >
              Voltar para hoje
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onAvancarDia}
          aria-label="Próximo dia"
          className="p-2.5 rounded-xl bg-salvia-100 dark:bg-salvia-800 text-salvia-700 dark:text-salvia-300 hover:bg-salvia-200 dark:hover:bg-salvia-700 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {erroAulas && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erroAulas}</span>
          </div>
          <button
            type="button"
            onClick={onTentarAulas}
            className="flex items-center space-x-1.5 text-[11px] font-bold underline underline-offset-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tentar de novo</span>
          </button>
        </div>
      )}

      {loadingAulas ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-28 bg-salvia-100 dark:bg-salvia-800/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : aulas.length === 0 ? (
        <div className="p-6 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/50 dark:bg-salvia-950/40 text-center">
          <CalendarCheck className="w-8 h-8 mx-auto text-salvia-400 mb-2" />
          <p className="text-sm font-bold text-slate-900 dark:text-salvia-50">
            Nenhuma aula na sua grade neste dia.
          </p>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
            Confira o dia selecionado ou fale com a secretaria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {aulas.map((aula) => (
            <div
              key={aula.horario_id}
              className="p-4 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/40 dark:bg-salvia-950/30 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-salvia-700 dark:text-salvia-300">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold font-mono">
                      {aula.hora_inicio} – {aula.hora_fim}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-salvia-50">
                    {aula.turma_nome}
                  </h4>
                  <p className="text-xs text-salvia-700 dark:text-salvia-300 flex items-center flex-wrap gap-x-3 gap-y-1">
                    <span className="flex items-center space-x-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{aula.disciplina_nome}</span>
                    </span>
                    {aula.sala_nome && (
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{aula.sala_nome}</span>
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    aula.chamada_registrada
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {aula.chamada_registrada ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Chamada feita</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      <span>Chamada pendente</span>
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onIrParaChamada(aula.turma_id, dataAula, aula.disciplina_id, aula.horario_id)
                }
                className="w-full sm:w-auto bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>{aula.chamada_registrada ? 'Ver chamada' : 'Fazer chamada'}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-6 border-t border-salvia-200 dark:border-salvia-800">
        <div className="flex items-center space-x-2 mb-4">
          <Users className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
            Minhas turmas
          </h3>
        </div>

        {erroTurmas && (
          <div className="mb-3 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs">
            <div className="flex items-start justify-between gap-2">
              <span>{erroTurmas}</span>
              <button type="button" onClick={onTentarTurmas} aria-label="Tentar de novo">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {loadingTurmas ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-24 bg-salvia-100 dark:bg-salvia-800/60 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : minhasTurmas.length === 0 ? (
          <p className="text-xs text-salvia-600 dark:text-salvia-400">
            Nenhuma turma atribuída no momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {minhasTurmas.map((turma) => (
              <div
                key={turma.turma_id}
                className="p-4 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-white dark:bg-salvia-900/60 space-y-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
                    {turma.turma_nome}
                  </h4>
                  <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
                    {turma.total_alunos} aluno{turma.total_alunos === 1 ? '' : 's'} · {etapaEnsinoLabel(turma.etapa_ensino)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onIrParaChamada(turma.turma_id, dataAula)}
                    className="flex-1 bg-salvia-100 hover:bg-salvia-200 dark:bg-salvia-800 dark:hover:bg-salvia-700 text-salvia-900 dark:text-salvia-100 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all"
                  >
                    Chamada
                  </button>
                  <button
                    type="button"
                    onClick={() => onIrParaChamada(turma.turma_id, dataAula)}
                    className="flex-1 bg-salvia-100 hover:bg-salvia-200 dark:bg-salvia-800 dark:hover:bg-salvia-700 text-salvia-900 dark:text-salvia-100 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all"
                  >
                    Notas
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
