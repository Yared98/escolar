import React from 'react';
import { Loader2, Search, X, Filter, RotateCw, GraduationCap, DoorOpen, School, ListOrdered, UserPlus, Trash2 } from 'lucide-react';
import { Turma, Aluno } from './types';

export interface TurmasPanelProps {
  loadingTurmas: boolean;
  filtroTurmaTexto: string;
  setFiltroTurmaTexto: (v: string) => void;
  filtroTurmaAno: string;
  setFiltroTurmaAno: (v: string) => void;
  anosLetivosTurma: number[];
  filtroTurmaTurno: string;
  setFiltroTurmaTurno: (v: string) => void;
  turmasFiltradas: Turma[];
  handleVerAlunosTurma: (turma: Turma) => Promise<void> | void;
  setSelectedTurmaParaEnsalamento: React.Dispatch<React.SetStateAction<Turma | null>>;
  alunos: Aluno[];
  setSelectedAlunoIdParaEnsalamento: React.Dispatch<React.SetStateAction<string>>;
  loadAlunosEnsalamento: () => Promise<void>;
  setShowEnsalamentoModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleExcluirTurma: (id: string, nome: string) => Promise<void> | void;
}

export function TurmasPanel({
  loadingTurmas,
  filtroTurmaTexto,
  setFiltroTurmaTexto,
  filtroTurmaAno,
  setFiltroTurmaAno,
  anosLetivosTurma,
  filtroTurmaTurno,
  setFiltroTurmaTurno,
  turmasFiltradas,
  handleVerAlunosTurma,
  setSelectedTurmaParaEnsalamento,
  alunos,
  setSelectedAlunoIdParaEnsalamento,
  loadAlunosEnsalamento,
  setShowEnsalamentoModal,
  handleExcluirTurma,
}: TurmasPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0c120e]/80 p-3 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative sm:col-span-1">
            {loadingTurmas ? (
              <Loader2 className="w-4 h-4 text-salvia-600 animate-spin absolute left-3 top-2.5" />
            ) : (
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            )}
            <input
              type="text"
              value={filtroTurmaTexto}
              onChange={(e) => setFiltroTurmaTexto(e.target.value)}
              placeholder="Buscar turma, código ou série..."
              className="w-full bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-salvia-500/20 focus:border-salvia-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            {filtroTurmaTexto && (
              <button
                type="button"
                onClick={() => setFiltroTurmaTexto('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={filtroTurmaAno}
            onChange={(e) => setFiltroTurmaAno(e.target.value)}
            className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-salvia-500/20 focus:border-salvia-500 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos os anos letivos</option>
            {anosLetivosTurma.map((ano) => (
              <option key={ano} value={String(ano)}>{ano}</option>
            ))}
          </select>
          <select
            value={filtroTurmaTurno}
            onChange={(e) => setFiltroTurmaTurno(e.target.value)}
            className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-salvia-500/20 focus:border-salvia-500 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos os turnos</option>
            <option value="Matutino">Matutino</option>
            <option value="Vespertino">Vespertino</option>
            <option value="Noturno">Noturno</option>
            <option value="Integral">Integral</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
          <span className="flex items-center gap-1.5 font-medium">
            {loadingTurmas ? (
              <>
                <Loader2 className="w-3 h-3 text-salvia-600 animate-spin" />
                <span>Buscando turmas...</span>
              </>
            ) : (
              <>
                <Filter className="w-3 h-3 text-salvia-600" />
                <span>
                  {turmasFiltradas.length}{' '}
                  {turmasFiltradas.length === 1 ? 'turma encontrada' : 'turmas encontradas'}
                  {(filtroTurmaTexto || filtroTurmaAno || filtroTurmaTurno) && ' (filtro ativo)'}
                </span>
              </>
            )}
          </span>
          {(filtroTurmaTexto || filtroTurmaAno || filtroTurmaTurno) && (
            <button
              type="button"
              onClick={() => {
                setFiltroTurmaTexto('');
                setFiltroTurmaAno('');
                setFiltroTurmaTurno('');
              }}
              className="text-xs font-semibold text-salvia-700 hover:text-salvia-800 dark:text-salvia-400 dark:hover:text-salvia-300 underline transition"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {turmasFiltradas.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400 space-y-3">
            {loadingTurmas ? (
              <div className="flex flex-col items-center justify-center gap-2 py-4">
                <Loader2 className="w-6 h-6 text-salvia-600 animate-spin" />
                <p className="text-xs">Buscando turmas no servidor...</p>
              </div>
            ) : filtroTurmaTexto || filtroTurmaAno || filtroTurmaTurno ? (
              <div className="space-y-2">
                <p>Nenhuma turma corresponde aos filtros aplicados.</p>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroTurmaTexto('');
                    setFiltroTurmaAno('');
                    setFiltroTurmaTurno('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-salvia-700 dark:text-salvia-400 hover:underline"
                >
                  <RotateCw className="w-3 h-3" />
                  Redefinir filtros de busca
                </button>
              </div>
            ) : (
              <p>Nenhuma turma cadastrada. Use “Criar Nova Turma” para abrir a primeira.</p>
            )}
          </div>
        ) : turmasFiltradas.map((t) => {
          const matriculados = t.alunos_matriculados || 0;
          const vagasLivres = Math.max(0, t.capacidade_maxima - matriculados);
          const percentualOcupacao = Math.min(100, Math.round((matriculados / t.capacidade_maxima) * 100));

          return (
            <div key={t.id} className="p-4 bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl space-y-3.5 shadow-sm hover:border-salvia-500/50 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.nome}</h3>
                    {t.codigo && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {t.codigo}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center space-x-2">
                    <span>Ano Letivo {t.ano_letivo}</span>
                    <span>•</span>
                    <span className="font-semibold text-salvia-700 dark:text-salvia-400">{t.turno || 'Matutino'}</span>
                  </p>
                </div>
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                    vagasLivres > 0
                      ? 'bg-salvia-100 dark:bg-salvia-900/60 border-salvia-300 dark:border-salvia-600/40 text-salvia-800 dark:text-salvia-200'
                      : 'bg-rose-100 dark:bg-rose-900/60 border-rose-300 dark:border-rose-600/40 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  {vagasLivres > 0 ? `${vagasLivres} Vagas Disponíveis` : 'Turma Lotada'}
                </span>
              </div>

              {/* Metadados Pedagógicos: Etapa, Série, Sala e Regente */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-[#141d17] p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400">
                  <GraduationCap className="w-3.5 h-3.5 text-salvia-600 shrink-0" />
                  <span className="truncate" title={`${t.etapa_ensino || 'Fundamental'} - ${t.serie || 'Geral'}`}>
                    {t.etapa_ensino ? `${t.etapa_ensino}${t.serie ? ` (${t.serie})` : ''}` : 'Etapa Regular'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400">
                  <DoorOpen className="w-3.5 h-3.5 text-salvia-600 shrink-0" />
                  <span className="truncate" title={t.sala_nome || 'Sala não atribuída'}>
                    {t.sala_nome ? t.sala_nome : 'Sala não atribuída'}
                  </span>
                </div>
                <div className="col-span-2 flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <School className="w-3.5 h-3.5 text-salvia-600 shrink-0" />
                  <span className="truncate" title={t.professor_regente_nome ? `Regente: ${t.professor_regente_nome}` : 'Sem professor regente definido'}>
                    {t.professor_regente_nome ? `Regente: ${t.professor_regente_nome}` : 'Sem regente definido'}
                  </span>
                </div>
              </div>

              {/* Barra de Ocupação & Vagas */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-600 dark:text-slate-400">Ocupação da Turma:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {matriculados} / {t.capacidade_maxima} alunos ({percentualOcupacao}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      percentualOcupacao >= 100
                        ? 'bg-rose-600'
                        : percentualOcupacao >= 80
                        ? 'bg-amber-500'
                        : 'bg-salvia-600'
                    }`}
                    style={{ width: `${percentualOcupacao}%` }}
                  />
                </div>
              </div>

              {/* Ações da Turma */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 dark:border-slate-800/60">
                <button
                  onClick={() => handleVerAlunosTurma(t)}
                  className="px-3 py-1.5 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>Ver Alunos & Chamada</span>
                </button>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => {
                      setSelectedTurmaParaEnsalamento(t);
                      if (alunos.length > 0) {
                        setSelectedAlunoIdParaEnsalamento(alunos[0].id);
                      }
                      void loadAlunosEnsalamento().then(() => setShowEnsalamentoModal(true));
                    }}
                    className="px-2.5 py-1.5 bg-white dark:bg-[#141d17] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all"
                    title="Enturmar Aluno"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-salvia-600" />
                    <span>Enturmar</span>
                  </button>

                  <button
                    onClick={() => handleExcluirTurma(t.id, t.nome)}
                    className="p-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg transition-all"
                    title="Excluir Turma"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
