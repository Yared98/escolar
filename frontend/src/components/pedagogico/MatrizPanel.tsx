import React from 'react';
import { Plus, GraduationCap, UserCheck, Layers, AlertCircle, Trash2 } from 'lucide-react';
import type { Disciplina, Turma, TurmaDisciplinaDetalhada, AlunoTurmaRoster } from './types';

export interface MatrizPanelProps {
  selectedTurmaId: string;
  setSelectedTurmaId: (id: string) => void;
  turmas: Turma[];
  setShowModalAdicionarMatriz: (show: boolean) => void;
  setShowModalDisciplina: (show: boolean) => void;
  turmaAlunos: AlunoTurmaRoster[];
  turmaAlunosErro: string | null;
  selectedTurmaObj: Turma | undefined;
  turmaDisciplinas: TurmaDisciplinaDetalhada[];
  areaBadgeColor: (area: string) => string;
  setAtribDiscId: (id: string) => void;
  setShowModalAtribuirProf: (show: boolean) => void;
  handleRemoverMatriz: (disciplinaId: string) => Promise<void>;
  disciplinas: Disciplina[];
}

export function MatrizPanel({
  selectedTurmaId,
  setSelectedTurmaId,
  turmas,
  setShowModalAdicionarMatriz,
  setShowModalDisciplina,
  turmaAlunos,
  turmaAlunosErro,
  selectedTurmaObj,
  turmaDisciplinas,
  areaBadgeColor,
  setAtribDiscId,
  setShowModalAtribuirProf,
  handleRemoverMatriz,
  disciplinas,
}: MatrizPanelProps) {
  return (
    <div className="space-y-6">
      {/* Seletor de Turma + Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#0c120e] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            Turma Ativa:
          </span>
          <select
            value={selectedTurmaId}
            onChange={(e) => setSelectedTurmaId(e.target.value)}
            className="bg-white dark:bg-[#141d17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-salvia-600"
          >
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} ({t.turno || 'Matutino'}) — Ano {t.ano_letivo}
                {typeof t.alunos_matriculados === 'number' ? ` · ${t.alunos_matriculados} alunos` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowModalAdicionarMatriz(true)}
            className="bg-salvia-700 hover:bg-salvia-800 dark:bg-salvia-600 dark:hover:bg-salvia-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Vincular à Turma</span>
          </button>

          <button
            onClick={() => setShowModalDisciplina(true)}
            className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>+ Novo Componente</span>
          </button>
        </div>
      </div>

      {/* Roster da turma — mesma API do Diário e do livro de chamada da Secretaria */}
      <div className="bg-white dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
            <span>Alunos enturmados</span>
          </h3>
          <span className="text-[11px] text-slate-500">
            {turmaAlunos.length} ativo{turmaAlunos.length === 1 ? '' : 's'} · mesma entidade da Secretaria/Diário
          </span>
        </div>
        {turmaAlunosErro && (
          <p className="text-xs text-rose-700 dark:text-rose-300">{turmaAlunosErro}</p>
        )}
        {!turmaAlunosErro && turmaAlunos.length === 0 && (
          <p className="text-xs text-slate-500">
            Nenhum aluno ativo nesta turma. Cadastre/enturme em Secretaria → Turmas (ensalamento).
            Prontuário fica na ficha do aluno na Secretaria.
          </p>
        )}
        {turmaAlunos.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {turmaAlunos.map((a) => (
              <li
                key={a.aluno_id}
                className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-lg px-2.5 py-1.5"
              >
                <span className="font-mono text-[10px] font-bold text-salvia-700 dark:text-salvia-300 w-6 shrink-0">
                  {a.numero_chamada ?? '—'}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{a.nome}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sub-seção: Matriz Curricular da Turma Selecionada */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
            <span>Matriz Curricular da Turma: {selectedTurmaObj?.nome || 'Selecione uma turma'}</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Total de Componentes: {turmaDisciplinas.length} | Carga Semanal:{' '}
            {turmaDisciplinas.reduce((acc, curr) => acc + curr.carga_horaria_semanal, 0)}h
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-200 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Disciplina / Componente</th>
                <th className="p-3">Área do Conhecimento</th>
                <th className="p-3 text-center">Aulas / Semana</th>
                <th className="p-3 text-center">Carga Anual</th>
                <th className="p-3">Professor Lotação</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200 font-medium">
              {turmaDisciplinas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500 py-6">
                    Nenhuma disciplina vinculada à matriz desta turma ainda. Clique em &quot;+ Vincular à Turma&quot;.
                  </td>
                </tr>
              ) : (
                turmaDisciplinas.map((td) => (
                  <tr key={td.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-salvia-700 dark:text-salvia-400">
                      {td.disciplina_codigo}
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{td.disciplina_nome}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${areaBadgeColor(td.area_conhecimento)}`}>
                        {td.area_conhecimento.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-100">
                      {td.carga_horaria_semanal} aulas
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">
                      {td.carga_horaria_anual}h
                    </td>
                    <td className="p-3">
                      {td.professor_nome ? (
                        <span className="font-semibold text-salvia-800 dark:text-salvia-300 flex items-center space-x-1">
                          <UserCheck className="w-3.5 h-3.5 text-salvia-600" />
                          <span>{td.professor_nome}</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setAtribDiscId(td.disciplina_id);
                            setShowModalAtribuirProf(true);
                          }}
                          className="text-[11px] text-amber-600 hover:underline flex items-center space-x-1 font-semibold"
                        >
                          <AlertCircle className="w-3 h-3 text-amber-500" />
                          <span>Atribuir Docente</span>
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRemoverMatriz(td.disciplina_id)}
                        className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg transition-all"
                        title="Remover da Matriz"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-seção: Catálogo Geral de Disciplinas Cadastradas */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center space-x-2">
          <GraduationCap className="w-4 h-4 text-salvia-700 dark:text-salvia-400" />
          <span>Catálogo Geral de Componentes Curriculares ({disciplinas.length})</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {disciplinas.map((d) => (
            <div
              key={d.id}
              className="bg-slate-50 dark:bg-[#0c120e] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5"
            >
              <div className="flex justify-between items-start">
                <span className="font-mono text-[10px] font-bold text-salvia-700 dark:text-salvia-400 bg-salvia-100 dark:bg-salvia-900/60 px-1.5 py-0.5 rounded">
                  {d.codigo}
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${areaBadgeColor(d.area_conhecimento)}`}>
                  {d.area_conhecimento.replace('_', ' ')}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{d.nome}</h4>
              <p className="text-[10px] text-slate-500 line-clamp-1">{d.descricao || 'Sem ementa detalhada'}</p>
              <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 font-mono pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <span>Semanal: {d.carga_horaria_semanal}h</span>
                <span>Anual: {d.carga_horaria_anual}h</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
