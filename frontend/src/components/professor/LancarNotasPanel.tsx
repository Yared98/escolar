'use client';

import React from 'react';
import { BookOpen, Users, Save, AlertCircle, Loader2, Lock } from 'lucide-react';
import type { MinhaTurma, MinhaTurmaDisciplina, NotaAluno, PeriodoNota } from '@/lib/types/academico';

interface LancarNotasPanelProps {
  minhasTurmas: MinhaTurma[];
  turmaId: string;
  onChangeTurma: (turmaId: string) => void;
  disciplinas: MinhaTurmaDisciplina[];
  disciplinaId: string;
  onChangeDisciplina: (disciplinaId: string) => void;
  periodo: PeriodoNota;
  onChangePeriodo: (periodo: PeriodoNota) => void;
  periodos: { value: PeriodoNota; label: string }[];
  alunos: NotaAluno[];
  loadingAlunos: boolean;
  erroAlunos: string | null;
  alteracoes: Record<string, number | null>;
  errosNota: Record<string, string | null>;
  onAlterarNota: (alunoId: string, valor: string) => void;
  onSalvar: () => void;
  salvando: boolean;
  periodoFechado?: boolean;
  loadingFechamentos?: boolean;
  erroFechamentos?: string | null;
}

export function LancarNotasPanel({
  minhasTurmas,
  turmaId,
  onChangeTurma,
  disciplinas,
  disciplinaId,
  onChangeDisciplina,
  periodo,
  onChangePeriodo,
  periodos,
  alunos,
  loadingAlunos,
  erroAlunos,
  alteracoes,
  errosNota,
  onAlterarNota,
  onSalvar,
  salvando,
  periodoFechado = false,
  loadingFechamentos = false,
  erroFechamentos,
}: LancarNotasPanelProps) {
  const temAlteracoes = Object.keys(alteracoes).length > 0;
  const temErros = Object.values(errosNota).some((e) => e);

  const notaDisplay = (aluno: NotaAluno) => {
    if (alteracoes.hasOwnProperty(aluno.aluno_id)) {
      const val = alteracoes[aluno.aluno_id];
      return val === null ? '' : String(val).replace('.', ',');
    }
    return aluno.nota === null || aluno.nota === undefined ? '' : String(aluno.nota).replace('.', ',');
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <div className="p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">Turma:</label>
          <select
            value={turmaId}
            onChange={(e) => onChangeTurma(e.target.value)}
            className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
          >
            <option value="">Selecione uma turma</option>
            {minhasTurmas.map((t) => (
              <option key={t.turma_id} value={t.turma_id}>
                {t.turma_nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">Disciplina:</label>
          <select
            value={disciplinaId}
            onChange={(e) => onChangeDisciplina(e.target.value)}
            disabled={disciplinas.length === 0}
            className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 disabled:opacity-60"
          >
            <option value="">Selecione uma disciplina</option>
            {disciplinas.map((d) => (
              <option key={d.disciplina_id} value={d.disciplina_id}>
                {d.disciplina_nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">Período:</label>
          <select
            value={periodo}
            onChange={(e) => onChangePeriodo(e.target.value as PeriodoNota)}
            className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
          >
            {periodos.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erroAlunos && (
        <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{erroAlunos}</span>
        </div>
      )}

      {erroFechamentos && (
        <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{erroFechamentos}</span>
        </div>
      )}

      {!loadingFechamentos && periodoFechado && (
        <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            O {periodos.find((p) => p.value === periodo)?.label || periodo} desta turma está fechado. Peça à coordenação para reabrir se for necessário alterar notas.
          </span>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Users className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
          Alunos
        </h3>
        <span className="text-[10px] text-salvia-500 font-medium">({alunos.length})</span>
      </div>

      {loadingAlunos ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-salvia-100 dark:bg-salvia-800/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : alunos.length === 0 ? (
        <div className="p-6 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/50 dark:bg-salvia-950/40 text-center">
          <BookOpen className="w-8 h-8 mx-auto text-salvia-400 mb-2" />
          <p className="text-sm font-bold text-slate-900 dark:text-salvia-50">
            Nenhum aluno para lançar nota.
          </p>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
            Escolha uma turma, disciplina e período.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alunos.map((aluno) => (
            <div
              key={aluno.aluno_id}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-white dark:bg-salvia-900/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-salvia-50 truncate">
                  {aluno.numero_chamada !== null && aluno.numero_chamada !== undefined ? (
                    <span className="font-mono text-salvia-600 dark:text-salvia-400 mr-1.5">
                      {aluno.numero_chamada}.
                    </span>
                  ) : null}
                  {aluno.aluno_nome}
                </p>
                {errosNota[aluno.aluno_id] && (
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    {errosNota[aluno.aluno_id]}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Nota de ${aluno.aluno_nome}`}
                  placeholder="—"
                  value={notaDisplay(aluno)}
                  onChange={(e) => onAlterarNota(aluno.aluno_id, e.target.value)}
                  className={`w-20 sm:w-24 text-center bg-salvia-50 dark:bg-salvia-950 border rounded-xl px-2 py-2.5 text-sm font-bold text-slate-900 dark:text-salvia-50 focus:outline-none placeholder-salvia-400 ${
                    errosNota[aluno.aluno_id]
                      ? 'border-rose-400 focus:border-rose-500'
                      : alteracoes.hasOwnProperty(aluno.aluno_id)
                        ? 'border-salvia-500 focus:border-salvia-600'
                        : 'border-salvia-300 dark:border-salvia-700 focus:border-salvia-600'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Espaço para a lista não ficar escondida atrás do botão fixo e da barra inferior no celular */}
      <div className="h-20 lg:hidden" aria-hidden="true" />

      <div className="fixed bottom-20 left-0 right-0 lg:hidden z-40 px-4">
        <button
          type="button"
          onClick={onSalvar}
          disabled={!temAlteracoes || temErros || salvando || alunos.length === 0 || periodoFechado}
          className="w-full bg-salvia-700 hover:bg-salvia-800 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 px-4 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center space-x-2 transition-all"
        >
          {salvando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Salvar notas</span>
            </>
          )}
        </button>
      </div>

      <div className="hidden lg:flex justify-end pt-4 border-t border-salvia-200 dark:border-salvia-800">
        <button
          type="button"
          onClick={onSalvar}
          disabled={!temAlteracoes || temErros || salvando || alunos.length === 0 || periodoFechado}
          className="bg-salvia-700 hover:bg-salvia-800 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 px-6 py-3 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all"
        >
          {salvando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Salvar notas</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
