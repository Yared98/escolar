import React from 'react';
import { Search, Filter, HeartPulse, MoreVertical, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Aluno, AlunoStatusContagem, Turma, labelStatusAluno, statusAlunoBadgeClass, proximasAcoesStatus } from './types';

export interface AlunosPanelProps {
  contagemStatus: AlunoStatusContagem[];
  contagemMap: Record<string, number>;
  filtroStatus: string;
  setFiltroStatus: (v: string) => void;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  search: string;
  setSearch: (v: string) => void;
  filtroTurmaId: string;
  setFiltroTurmaId: (v: string) => void;
  setFiltroSemTurma: (v: boolean) => void;
  turmasReferencia: Turma[];
  filtroAnoLetivo: string;
  setFiltroAnoLetivo: (v: string) => void;
  anosLetivosTurma: number[];
  filtroSemTurma: boolean;
  setSearchDebounced: (v: string) => void;
  loading: boolean;
  alunos: Aluno[];
  handleViewProntuario: (aluno: Aluno) => void;
  handleEmitirDocumento?: (aluno: Aluno) => void;
  menuStatusAlunoId: string | null;
  setMenuStatusAlunoId: React.Dispatch<React.SetStateAction<string | null>>;
  handleAlterarStatus: (aluno: Aluno, novoStatus: string) => Promise<void> | void;
  handleDeleteAluno: (id: string) => Promise<void> | void;
  fromItem: number;
  toItem: number;
  totalAlunos: number;
  page: number;
  totalPages: number;
}

export function AlunosPanel({
  contagemStatus,
  contagemMap,
  filtroStatus,
  setFiltroStatus,
  setPage,
  search,
  setSearch,
  filtroTurmaId,
  setFiltroTurmaId,
  setFiltroSemTurma,
  turmasReferencia,
  filtroAnoLetivo,
  setFiltroAnoLetivo,
  anosLetivosTurma,
  filtroSemTurma,
  setSearchDebounced,
  loading,
  alunos,
  handleViewProntuario,
  handleEmitirDocumento,
  menuStatusAlunoId,
  setMenuStatusAlunoId,
  handleAlterarStatus,
  handleDeleteAluno,
  fromItem,
  toItem,
  totalAlunos,
  page,
  totalPages,
}: AlunosPanelProps) {
  return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'ativo', label: 'Ativos' },
              { key: 'pre_matricula', label: 'Pré-matrícula' },
              { key: 'trancado', label: 'Trancados' },
              { key: 'transferido', label: 'Transferidos' },
              { key: 'inativo', label: 'Inativos' },
              { key: 'todos', label: 'Todos' },
            ].map((chip) => {
              const count =
                chip.key === 'todos'
                  ? contagemStatus.reduce((acc, c) => acc + c.total, 0)
                  : contagemMap[chip.key] || 0;
              const active = filtroStatus === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    setFiltroStatus(chip.key);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                    active
                      ? 'border-salvia-600 bg-salvia-700 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-salvia-400 dark:border-slate-700 dark:bg-[#0c120e] dark:text-slate-300'
                  }`}
                >
                  {chip.label}
                  <span className={`font-mono ${active ? 'text-salvia-100' : 'text-slate-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0c120e]/80 p-3 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, CPF, responsável legal/financeiro ou cidade..."
                className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium placeholder-slate-400"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1"><Filter className="w-3 h-3" /> Turma</span>
                <select
                  value={filtroTurmaId}
                  onChange={(e) => {
                    setFiltroTurmaId(e.target.value);
                    if (e.target.value) setFiltroSemTurma(false);
                    setPage(1);
                  }}
                  className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Todas as turmas</option>
                  {turmasReferencia.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.codigo ? `${t.codigo} — ` : ''}{t.nome} ({t.ano_letivo})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Ano letivo
                <select
                  value={filtroAnoLetivo}
                  onChange={(e) => {
                    setFiltroAnoLetivo(e.target.value);
                    setPage(1);
                  }}
                  className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Qualquer ano</option>
                  {anosLetivosTurma.map((ano) => (
                    <option key={ano} value={String(ano)}>{ano}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 pb-2">
                <input
                  type="checkbox"
                  checked={filtroSemTurma}
                  onChange={(e) => {
                    setFiltroSemTurma(e.target.checked);
                    if (e.target.checked) setFiltroTurmaId('');
                    setPage(1);
                  }}
                  className="rounded border-slate-300 text-salvia-700 focus:ring-salvia-600"
                />
                Somente sem turma
              </label>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSearchDebounced('');
                    setFiltroStatus('ativo');
                    setFiltroTurmaId('');
                    setFiltroSemTurma(false);
                    setFiltroAnoLetivo('');
                    setPage(1);
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-salvia-700 dark:hover:text-salvia-400"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-200 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Aluno(a)</th>
                  <th className="p-3">Turma</th>
                  <th className="p-3">Responsáveis</th>
                  <th className="p-3">Contato</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500">
                      Carregando lista de alunos...
                    </td>
                  </tr>
                ) : alunos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500 py-6">
                      Nenhum aluno encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  alunos.map((aluno) => {
                    const isUnificado = aluno.responsavel_financeiro_igual_legal;
                    const acoes = proximasAcoesStatus(aluno.status);
                    return (
                      <tr key={aluno.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{aluno.nome}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{aluno.cpf}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Nasc: {aluno.data_nascimento}</div>
                        </td>
                        <td className="p-3">
                          {aluno.turma_atual_nome ? (
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {aluno.turma_atual_codigo ? `${aluno.turma_atual_codigo} · ` : ''}
                                {aluno.turma_atual_nome}
                              </div>
                              {aluno.numero_chamada != null && (
                                <div className="text-[10px] text-slate-500">Chamada nº {aluno.numero_chamada}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] italic text-amber-700 dark:text-amber-300">Sem turma</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center space-x-1">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{aluno.nome_responsavel}</span>
                            <span className="text-[10px] text-salvia-700 dark:text-salvia-400 font-mono">
                              ({aluno.parentesco_responsavel_legal || 'Legal'})
                            </span>
                          </div>
                          {isUnificado ? (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-salvia-100 dark:bg-salvia-900/60 text-salvia-800 dark:text-salvia-300">
                              Resp. único
                            </span>
                          ) : (
                            <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                              Fin: {aluno.nome_responsavel_financeiro || aluno.nome_responsavel}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="text-slate-900 dark:text-slate-100 font-mono">{aluno.telefone_responsavel}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {aluno.cidade ? `${aluno.cidade} - ${aluno.estado || 'UF'}` : 'Sem endereço'}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusAlunoBadgeClass(aluno.status)}`}>
                            {labelStatusAluno(aluno.status)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="relative inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleViewProntuario(aluno)}
                              className="px-2.5 py-1 bg-salvia-50 dark:bg-salvia-950/80 border border-salvia-300 dark:border-salvia-700 hover:border-salvia-600 text-salvia-800 dark:text-salvia-200 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center space-x-1"
                              title="Visualizar e Editar Prontuário Médico"
                            >
                              <HeartPulse className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              <span>Prontuário</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setMenuStatusAlunoId((prev) => (prev === aluno.id ? null : aluno.id))
                              }
                              className="p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                              title="Ciclo de vida / status"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {menuStatusAlunoId === aluno.id && (
                              <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141d17] shadow-lg py-1 text-left">
                                {handleEmitirDocumento && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuStatusAlunoId(null);
                                      handleEmitirDocumento(aluno);
                                    }}
                                    className="w-full px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-100 dark:border-slate-800"
                                  >
                                    Emitir documento
                                  </button>
                                )}
                                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-bold">
                                  Ciclo de vida
                                </p>
                                {acoes.map((acao) => (
                                  <button
                                    key={acao.status}
                                    type="button"
                                    onClick={() => void handleAlterarStatus(aluno, acao.status)}
                                    className="w-full px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                                  >
                                    {acao.label}
                                  </button>
                                ))}
                                {aluno.status !== 'inativo' && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteAluno(aluno.id)}
                                    className="w-full px-3 py-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left inline-flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Inativar matrícula
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-400">
            <span>
              Mostrando <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fromItem}–{toItem}</span> de{' '}
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totalAlunos}</span> alunos
            </span>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-bold disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>
              <span className="font-mono">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-bold disabled:opacity-40"
              >
                Próxima <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
  );
}
