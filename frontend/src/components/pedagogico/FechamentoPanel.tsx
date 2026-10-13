'use client';

import React from 'react';
import { Lock, Unlock, Save, Loader2, AlertCircle, Users, BookOpen } from 'lucide-react';
import type { Turma, AlunoConselho, FechamentoPeriodo, PeriodoFechamento } from './types';

const PERIODOS: { value: PeriodoFechamento; label: string }[] = [
  { value: '1_bimestre', label: '1º Bimestre' },
  { value: '2_bimestre', label: '2º Bimestre' },
  { value: '3_bimestre', label: '3º Bimestre' },
  { value: '4_bimestre', label: '4º Bimestre' },
  { value: '1_trimestre', label: '1º Trimestre' },
  { value: '2_trimestre', label: '2º Trimestre' },
  { value: '3_trimestre', label: '3º Trimestre' },
  { value: 'recuperacao', label: 'Recuperação' },
];

const ENCAMINHAMENTOS: { value: 'recuperacao' | 'acompanhamento' | 'sem_pendencias'; label: string }[] = [
  { value: 'recuperacao', label: 'Recuperação' },
  { value: 'acompanhamento', label: 'Acompanhamento pedagógico' },
  { value: 'sem_pendencias', label: 'Sem pendências' },
];

interface FechamentoPanelProps {
  turmas: Turma[];
  selectedTurmaId: string;
  onChangeTurma: (turmaId: string) => void;
  fechamentos: FechamentoPeriodo[];
  loadingFechamentos: boolean;
  erroFechamentos: string | null;
  onFechar: (periodo: PeriodoFechamento) => void;
  onReabrir: (periodo: PeriodoFechamento) => void;
  fechando: boolean;

  periodoConselho: PeriodoFechamento;
  onChangePeriodoConselho: (periodo: PeriodoFechamento) => void;
  alunosConselho: AlunoConselho[];
  loadingConselho: boolean;
  erroConselho: string | null;
  pareceres: Record<string, string>;
  encaminhamentos: Record<string, 'recuperacao' | 'acompanhamento' | 'sem_pendencias' | ''>;
  onParecerChange: (alunoId: string, valor: string) => void;
  onEncaminhamentoChange: (alunoId: string, valor: 'recuperacao' | 'acompanhamento' | 'sem_pendencias' | '') => void;
  onSalvarParecer: (alunoId: string) => void;
  salvandoParecer: Record<string, boolean>;
  podeGerenciarFechamento: boolean;
}

function formatarData(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FechamentoPanel({
  turmas,
  selectedTurmaId,
  onChangeTurma,
  fechamentos,
  loadingFechamentos,
  erroFechamentos,
  onFechar,
  onReabrir,
  fechando,
  periodoConselho,
  onChangePeriodoConselho,
  alunosConselho,
  loadingConselho,
  erroConselho,
  pareceres,
  encaminhamentos,
  onParecerChange,
  onEncaminhamentoChange,
  onSalvarParecer,
  salvandoParecer,
  podeGerenciarFechamento,
}: FechamentoPanelProps) {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
        <label className="block text-salvia-700 dark:text-salvia-300 font-bold text-xs mb-1">Turma:</label>
        <select
          value={selectedTurmaId}
          onChange={(e) => onChangeTurma(e.target.value)}
          className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2.5 font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
        >
          <option value="">Selecione uma turma</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>

      {!selectedTurmaId ? (
        <div className="p-6 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/50 dark:bg-salvia-950/40 text-center">
          <BookOpen className="w-8 h-8 mx-auto text-salvia-400 mb-2" />
          <p className="text-sm font-bold text-slate-900 dark:text-salvia-50">Escolha uma turma</p>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
            Selecione a turma para ver os períodos e registrar o conselho de classe.
          </p>
        </div>
      ) : (
        <>
          <section className="border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 bg-white dark:bg-salvia-900/40">
            <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-2 mb-4">
              <Lock className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
              <span>Fechamento de período</span>
            </h3>

            {erroFechamentos && (
              <div className="mb-3 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erroFechamentos}</span>
              </div>
            )}

            {loadingFechamentos ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-salvia-100 dark:bg-salvia-800/60 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PERIODOS.map((p) => {
                  const f = fechamentos.find((x) => x.periodo === p.value);
                  const fechado = f?.fechado ?? false;
                  return (
                    <div
                      key={p.value}
                      className={`flex flex-col justify-between p-3 rounded-xl border ${
                        fechado
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                          : 'bg-salvia-50/60 dark:bg-salvia-950/40 border-salvia-200 dark:border-salvia-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-salvia-50">{p.label}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            fechado
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          }`}
                        >
                          {fechado ? 'Fechado' : 'Em aberto'}
                        </span>
                      </div>
                      {fechado && f?.fechado_por && (
                        <p className="text-[10px] text-salvia-600 dark:text-salvia-400 mb-2 truncate">
                          Por {f.fechado_por} · {formatarData(f.fechado_em)}
                        </p>
                      )}
                      {podeGerenciarFechamento && (
                        <button
                          type="button"
                          onClick={() => (fechado ? onReabrir(p.value) : onFechar(p.value))}
                          disabled={fechando}
                          className={`mt-auto w-full flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                            fechado
                              ? 'bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 text-salvia-800 dark:text-salvia-200 hover:bg-salvia-100 dark:hover:bg-salvia-800'
                              : 'bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 dark:hover:bg-salvia-500'
                          }`}
                        >
                          {fechando ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : fechado ? (
                            <Unlock className="w-3.5 h-3.5" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                          <span>{fechado ? 'Reabrir' : 'Fechar'}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 bg-white dark:bg-salvia-900/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50 flex items-center space-x-2">
                <Users className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
                <span>Conselho de classe</span>
              </h3>
              <select
                value={periodoConselho}
                onChange={(e) => onChangePeriodoConselho(e.target.value as PeriodoFechamento)}
                className="bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
              >
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {erroConselho && (
              <div className="mb-3 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erroConselho}</span>
              </div>
            )}

            {loadingConselho ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-salvia-100 dark:bg-salvia-800/60 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : alunosConselho.length === 0 ? (
              <div className="p-6 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/50 dark:bg-salvia-950/40 text-center">
                <Users className="w-8 h-8 mx-auto text-salvia-400 mb-2" />
                <p className="text-sm font-bold text-slate-900 dark:text-salvia-50">Nenhum aluno ativo nesta turma.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alunosConselho.map((aluno) => {
                  const media = aluno.media_periodo != null ? aluno.media_periodo.toFixed(2) : '—';
                  return (
                    <div
                      key={aluno.aluno_id}
                      className="p-3 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/40 dark:bg-salvia-950/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-salvia-50">
                          {aluno.numero_chamada != null ? (
                            <span className="font-mono text-salvia-600 dark:text-salvia-400 mr-1.5">
                              {aluno.numero_chamada}.
                            </span>
                          ) : null}
                          {aluno.aluno_nome}
                        </p>
                        <span className="text-[10px] font-bold text-salvia-600 dark:text-salvia-400 bg-salvia-100 dark:bg-salvia-800 px-2 py-0.5 rounded-full">
                          Média: {media}
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        value={pareceres[aluno.aluno_id] ?? aluno.parecer ?? ''}
                        onChange={(e) => onParecerChange(aluno.aluno_id, e.target.value)}
                        placeholder="Escreva o parecer do conselho (até 2000 caracteres)..."
                        maxLength={2000}
                        className="w-full mb-2 bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 resize-none"
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <select
                          value={encaminhamentos[aluno.aluno_id] ?? aluno.encaminhamento ?? ''}
                          onChange={(e) =>
                            onEncaminhamentoChange(
                              aluno.aluno_id,
                              e.target.value as 'recuperacao' | 'acompanhamento' | 'sem_pendencias' | ''
                            )
                          }
                          className="bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
                        >
                          <option value="">Sem encaminhamento</option>
                          {ENCAMINHAMENTOS.map((e) => (
                            <option key={e.value} value={e.value}>
                              {e.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => onSalvarParecer(aluno.aluno_id)}
                          disabled={salvandoParecer[aluno.aluno_id]}
                          className="flex items-center justify-center space-x-1.5 bg-salvia-700 hover:bg-salvia-800 disabled:opacity-50 disabled:cursor-not-allowed text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        >
                          {salvandoParecer[aluno.aluno_id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Salvar parecer</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
