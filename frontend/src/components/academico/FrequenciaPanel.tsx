'use client';

import React from 'react';
import {
  Download,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  BookOpen,
} from 'lucide-react';

export interface AlunoFrequencia {
  aluno_id: string;
  aluno_nome: string;
  numero_chamada: number | null;
  aulas: number;
  presencas: number;
  faltas: number;
  faltas_justificadas: number;
  percentual: number;
}

export interface TotalTurmaFrequencia {
  total_aulas: number;
  total_presencas: number;
  total_faltas: number;
  total_faltas_justificadas: number;
  percentual_geral: number;
}

export interface RelatorioFrequencia {
  turma_id: string;
  turma_nome: string;
  mes: string;
  disciplina_id: string | null;
  total_turma: TotalTurmaFrequencia;
  alunos: AlunoFrequencia[];
}

export interface TurmaOpcaoFrequencia {
  id: string;
  nome: string;
  disciplinas?: { disciplina_id: string; disciplina_nome: string }[];
}

export interface FrequenciaPanelProps {
  turmasOpcoes: TurmaOpcaoFrequencia[];
  turmaId: string;
  onSelectTurma: (id: string) => void;
  mes: string;
  onMesChange: (mes: string) => void;
  disciplinaId: string;
  onDisciplinaChange: (id: string) => void;
  disciplinasOpcoes: { disciplina_id: string; disciplina_nome: string }[];
  relatorio: RelatorioFrequencia | null;
  loading: boolean;
  erro: string | null;
  onRecarregar: () => void;
}

export function FrequenciaPanel({
  turmasOpcoes,
  turmaId,
  onSelectTurma,
  mes,
  onMesChange,
  disciplinaId,
  onDisciplinaChange,
  disciplinasOpcoes,
  relatorio,
  loading,
  erro,
  onRecarregar,
}: FrequenciaPanelProps) {
  const exportarCsv = () => {
    if (!relatorio || relatorio.alunos.length === 0) return;

    // Cabeçalho CSV para Excel no Brasil (separador ponto e vírgula e UTF-8 BOM)
    const cabecalho =
      'Nº de chamada;Aluno;Aulas;Presenças;Faltas;Faltas justificadas;Frequência (%)\r\n';

    const linhas = relatorio.alunos
      .map((a) => {
        const num = a.numero_chamada ?? '';
        const nomeLimpo = `"${(a.aluno_nome || '').replace(/"/g, '""')}"`;
        const pctFormatado = a.percentual.toFixed(1).replace('.', ',');
        return `${num};${nomeLimpo};${a.aulas};${a.presencas};${a.faltas};${a.faltas_justificadas};${pctFormatado}`;
      })
      .join('\r\n');

    const totalPct = relatorio.total_turma.percentual_geral
      .toFixed(1)
      .replace('.', ',');
    const rodape = `\r\n;Total da turma;${relatorio.total_turma.total_aulas};${relatorio.total_turma.total_presencas};${relatorio.total_turma.total_faltas};${relatorio.total_turma.total_faltas_justificadas};${totalPct}\r\n`;

    const conteudoComBom = '\uFEFF' + cabecalho + linhas + rodape;
    const blob = new Blob([conteudoComBom], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nomeArquivo = `frequencia_${(relatorio.turma_nome || 'turma')
      .replace(/\s+/g, '_')
      .toLowerCase()}_${mes}.csv`;
    link.setAttribute('download', nomeArquivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const turmaAtual = turmasOpcoes.find((t) => t.id === turmaId);

  return (
    <div className="space-y-6">
      {/* Seletor e Filtros */}
      <div className="p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">
            Turma:
          </label>
          <select
            value={turmaId}
            onChange={(e) => onSelectTurma(e.target.value)}
            className="w-full min-h-[44px] bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
          >
            <option value="">
              {turmasOpcoes.length === 0
                ? 'Nenhuma turma disponível'
                : 'Selecione a turma'}
            </option>
            {turmasOpcoes.map((turma) => (
              <option key={turma.id} value={turma.id}>
                {turma.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">
            Mês de referência:
          </label>
          <input
            type="month"
            value={mes}
            onChange={(e) => onMesChange(e.target.value)}
            className="w-full min-h-[44px] bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
          />
        </div>

        <div>
          <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">
            Disciplina:
          </label>
          <select
            value={disciplinaId}
            onChange={(e) => onDisciplinaChange(e.target.value)}
            className="w-full min-h-[44px] bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
          >
            <option value="">Todas as disciplinas (geral da turma)</option>
            {disciplinasOpcoes.map((d) => (
              <option key={d.disciplina_id} value={d.disciplina_id}>
                {d.disciplina_nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ações e Feedback */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs text-salvia-700 dark:text-salvia-300 font-medium">
          <Calendar className="w-4 h-4 text-salvia-600 dark:text-salvia-400 shrink-0" />
          <span>
            {turmaAtual ? `Relatório de ${turmaAtual.nome}` : 'Selecione uma turma para ver o relatório'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onRecarregar}
            disabled={loading || !turmaId}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-salvia-300 dark:border-salvia-700 hover:bg-salvia-100 dark:hover:bg-salvia-800 text-salvia-800 dark:text-salvia-200 text-xs font-bold flex items-center space-x-1.5 transition-all disabled:opacity-50"
            title="Atualizar dados"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={exportarCsv}
            disabled={!relatorio || relatorio.alunos.length === 0}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-salvia-700 hover:bg-salvia-800 dark:bg-salvia-600 dark:hover:bg-salvia-500 text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Baixar planilha (CSV)</span>
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-rose-800 dark:text-rose-200 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{erro}</span>
        </div>
      )}

      {loading && (
        <div className="p-8 text-center text-xs font-medium text-salvia-600 dark:text-salvia-400">
          Carregando frequência da turma...
        </div>
      )}

      {!loading && !erro && relatorio && (
        <>
          {/* Cartões de Totais da Turma */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-3.5 rounded-xl">
              <span className="text-salvia-600 dark:text-salvia-400 block font-medium">
                Aulas no mês
              </span>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-salvia-50 mt-1">
                {relatorio.total_turma.total_aulas}
              </p>
              <span className="text-[10px] text-salvia-500 mt-0.5 block">Chamadas registradas</span>
            </div>

            <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-3.5 rounded-xl">
              <span className="text-salvia-600 dark:text-salvia-400 block font-medium">
                Presenças
              </span>
              <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {relatorio.total_turma.total_presencas}
              </p>
              <span className="text-[10px] text-salvia-500 mt-0.5 block">Total de registros</span>
            </div>

            <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-3.5 rounded-xl">
              <span className="text-salvia-600 dark:text-salvia-400 block font-medium">
                Faltas
              </span>
              <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                {relatorio.total_turma.total_faltas}
              </p>
              <span className="text-[10px] text-salvia-500 mt-0.5 block">
                {relatorio.total_turma.total_faltas_justificadas > 0
                  ? `${relatorio.total_turma.total_faltas_justificadas} justificada(s)`
                  : 'Nenhuma justificada'}
              </span>
            </div>

            <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-3.5 rounded-xl">
              <span className="text-salvia-600 dark:text-salvia-400 block font-medium">
                Frequência geral
              </span>
              <p
                className={`text-xl font-bold font-mono mt-1 ${
                  relatorio.total_turma.percentual_geral < 75
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-salvia-50'
                }`}
              >
                {relatorio.total_turma.percentual_geral.toFixed(1)}%
              </p>
              <span
                className={`text-[10px] font-bold mt-0.5 block ${
                  relatorio.total_turma.percentual_geral < 75
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-salvia-500'
                }`}
              >
                {relatorio.total_turma.percentual_geral < 75
                  ? 'Abaixo do mínimo de 75%'
                  : 'Dentro do esperado'}
              </span>
            </div>
          </div>

          {/* Estado Vazio de Alunos */}
          {relatorio.alunos.length === 0 ? (
            <div className="p-8 text-center text-xs text-salvia-600 dark:text-salvia-400 bg-salvia-50/40 dark:bg-salvia-950/30 border border-dashed border-salvia-300 dark:border-salvia-700 rounded-2xl">
              Nenhum aluno ativo encontrado nesta turma.
            </div>
          ) : (
            <>
              {/* Visão Mobile: Cartões por Aluno (sem scroll lateral em 375px) */}
              <div className="block sm:hidden space-y-3">
                {relatorio.alunos.map((aluno) => {
                  const emAlerta = aluno.percentual < 75;
                  return (
                    <div
                      key={aluno.aluno_id}
                      className={`p-4 rounded-xl border text-xs transition-all ${
                        emAlerta
                          ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                          : 'bg-white dark:bg-salvia-900/60 border-salvia-200 dark:border-salvia-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-salvia-50 truncate">
                            {aluno.numero_chamada ? `${aluno.numero_chamada}. ` : ''}
                            {aluno.aluno_nome}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                            emAlerta
                              ? 'bg-rose-100 dark:bg-rose-950 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
                              : 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                          }`}
                        >
                          {aluno.percentual.toFixed(1)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-salvia-100 dark:border-salvia-800 text-salvia-700 dark:text-salvia-300">
                        <div>
                          <span className="text-salvia-500 block text-[10px]">Aulas</span>
                          <span className="font-bold font-mono">{aluno.aulas}</span>
                        </div>
                        <div>
                          <span className="text-salvia-500 block text-[10px]">Presenças</span>
                          <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400">
                            {aluno.presencas}
                          </span>
                        </div>
                        <div>
                          <span className="text-salvia-500 block text-[10px]">Faltas</span>
                          <span className="font-bold font-mono text-amber-700 dark:text-amber-400">
                            {aluno.faltas}
                            {aluno.faltas_justificadas > 0 ? (
                              <span className="text-[10px] text-salvia-500 font-normal ml-0.5">
                                ({aluno.faltas_justificadas} just.)
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </div>

                      {emAlerta && (
                        <div className="mt-2.5 pt-2 border-t border-rose-200 dark:border-rose-800/60 flex items-center space-x-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Abaixo de 75% no mês (alerta pela LDB)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Visão Desktop: Tabela de Alunos */}
              <div className="hidden sm:block overflow-hidden rounded-2xl border border-salvia-200 dark:border-salvia-800 shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-salvia-100/70 dark:bg-salvia-800/70 text-salvia-800 dark:text-salvia-200 font-bold border-b border-salvia-200 dark:border-salvia-800">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center">Nº</th>
                      <th className="py-3 px-3">Estudante</th>
                      <th className="py-3 px-3 text-center">Aulas</th>
                      <th className="py-3 px-3 text-center">Presenças</th>
                      <th className="py-3 px-3 text-center">Faltas</th>
                      <th className="py-3 px-3 text-center">Faltas justificadas</th>
                      <th className="py-3 px-3 text-right">Frequência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800 bg-white dark:bg-salvia-900">
                    {relatorio.alunos.map((aluno) => {
                      const emAlerta = aluno.percentual < 75;
                      return (
                        <tr
                          key={aluno.aluno_id}
                          className={`transition-colors hover:bg-salvia-50/50 dark:hover:bg-salvia-800/30 ${
                            emAlerta ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center font-mono text-salvia-500">
                            {aluno.numero_chamada ?? '—'}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-900 dark:text-salvia-50">
                            <div className="flex items-center space-x-1.5">
                              <span>{aluno.aluno_nome}</span>
                              {emAlerta && (
                                <span
                                  className="inline-flex items-center space-x-1 text-[10px] text-rose-700 dark:text-rose-400 font-bold"
                                  title="Frequência abaixo de 75% exigida pela LDB"
                                >
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>Abaixo de 75%</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-medium">
                            {aluno.aulas}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {aluno.presencas}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-medium text-amber-700 dark:text-amber-400">
                            {aluno.faltas}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-salvia-600 dark:text-salvia-400">
                            {aluno.faltas_justificadas}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                                emAlerta
                                  ? 'bg-rose-100 dark:bg-rose-950 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
                                  : 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                              }`}
                            >
                              {aluno.percentual.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-salvia-50/80 dark:bg-salvia-950/70 font-bold border-t border-salvia-200 dark:border-salvia-800 text-salvia-800 dark:text-salvia-200">
                    <tr>
                      <td colSpan={2} className="py-3 px-3">
                        Total da turma
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {relatorio.total_turma.total_aulas}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-700 dark:text-emerald-400">
                        {relatorio.total_turma.total_presencas}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-amber-700 dark:text-amber-400">
                        {relatorio.total_turma.total_faltas}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {relatorio.total_turma.total_faltas_justificadas}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                            relatorio.total_turma.percentual_geral < 75
                              ? 'bg-rose-100 dark:bg-rose-950 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
                              : 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                          }`}
                        >
                          {relatorio.total_turma.percentual_geral.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {!loading && !relatorio && !erro && (
        <div className="p-8 text-center text-xs text-salvia-600 dark:text-salvia-400 bg-salvia-50/40 dark:bg-salvia-950/30 border border-dashed border-salvia-300 dark:border-salvia-700 rounded-2xl">
          Selecione uma turma para carregar o relatório de frequência.
        </div>
      )}
    </div>
  );
}
