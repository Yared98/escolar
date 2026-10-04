import React from 'react';
import { ListOrdered, X, CheckCircle2, AlertTriangle, ArrowRightLeft, Trash2 } from 'lucide-react';
import { Turma, AlunoTurmaDetalhado } from './types';

export interface TurmaAlunosMsgProps {
  type: 'success' | 'error';
  text: string;
}

export interface TurmaAlunosModalProps {
  selectedTurmaAlunosModal: Turma;
  setSelectedTurmaAlunosModal: (v: Turma | null) => void;
  turmaAlunos: AlunoTurmaDetalhado[];
  loadingTurmaAlunos: boolean;
  handleRenumerarChamada: () => void | Promise<void>;
  turmaAlunosMsg: TurmaAlunosMsgProps | null;
  setTurmaAlunosMsg: (v: TurmaAlunosMsgProps | null) => void;
  alunoParaTransferir: AlunoTurmaDetalhado | null;
  setAlunoParaTransferir: (v: AlunoTurmaDetalhado | null) => void;
  handleExecutarTransferencia: (e: React.FormEvent) => void | Promise<void>;
  turmaDestinoTransferenciaId: string;
  setTurmaDestinoTransferenciaId: (v: string) => void;
  turmasReferencia: Turma[];
  transferindo: boolean;
  handleDesenturmarAluno: (alunoId: string, nomeAluno: string) => void | Promise<void>;
}

export function TurmaAlunosModal({
  selectedTurmaAlunosModal,
  setSelectedTurmaAlunosModal,
  turmaAlunos,
  loadingTurmaAlunos,
  handleRenumerarChamada,
  turmaAlunosMsg,
  setTurmaAlunosMsg,
  alunoParaTransferir,
  setAlunoParaTransferir,
  handleExecutarTransferencia,
  turmaDestinoTransferenciaId,
  setTurmaDestinoTransferenciaId,
  turmasReferencia,
  transferindo,
  handleDesenturmarAluno,
}: TurmaAlunosModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 max-w-4xl w-full shadow-2xl my-6">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <ListOrdered className="w-5 h-5 text-salvia-700 dark:text-salvia-400" />
                <span>Livro de Chamada & Alunos Enturmados</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-salvia-100 dark:bg-salvia-900 text-salvia-800 dark:text-salvia-200">
                {selectedTurmaAlunosModal.nome} {selectedTurmaAlunosModal.codigo ? `(${selectedTurmaAlunosModal.codigo})` : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {selectedTurmaAlunosModal.etapa_ensino || 'Fundamental'} {selectedTurmaAlunosModal.serie ? `• ${selectedTurmaAlunosModal.serie}` : ''} | Turno: {selectedTurmaAlunosModal.turno || 'Matutino'} | Sala: {selectedTurmaAlunosModal.sala_nome || 'Não definida'} | Regente: {selectedTurmaAlunosModal.professor_regente_nome || 'Não definido'}
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedTurmaAlunosModal(null);
              setAlunoParaTransferir(null);
              setTurmaAlunosMsg(null);
            }}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar com Renumeração e Vagas */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-[#0c120e] p-3 rounded-xl border border-slate-200 dark:border-slate-800 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Lotação da Turma:
            </span>
            <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 px-2 py-0.5 bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-700 rounded-md">
              {turmaAlunos.length} / {selectedTurmaAlunosModal.capacidade_maxima} matriculados
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRenumerarChamada}
              className="px-3 py-1.5 bg-salvia-50 dark:bg-salvia-950 border border-salvia-300 dark:border-salvia-700 hover:bg-salvia-100 text-salvia-800 dark:text-salvia-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
              title="Ordena os alunos em ordem alfabética de A a Z e renumera a chamada de 1 até N"
            >
              <ListOrdered className="w-3.5 h-3.5 text-salvia-700" />
              <span>Renumerar Chamada (A-Z, 1..N)</span>
            </button>
          </div>
        </div>

        {/* Mensagem de Feedback */}
        {turmaAlunosMsg && (
          <div
            className={`mb-4 p-3 rounded-xl flex items-center space-x-2 text-xs font-medium border ${
              turmaAlunosMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            {turmaAlunosMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{turmaAlunosMsg.text}</span>
          </div>
        )}

        {/* Submodal / Painel de Transferência */}
        {alunoParaTransferir && (
          <form
            onSubmit={handleExecutarTransferencia}
            className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
                <ArrowRightLeft className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>Transferência Atômica: {alunoParaTransferir.nome}</span>
              </h4>
              <button
                type="button"
                onClick={() => setAlunoParaTransferir(null)}
                className="text-amber-600 hover:text-amber-900 text-xs font-bold"
              >
                ✕ Cancelar
              </button>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              O aluno será desvinculado da turma atual ({selectedTurmaAlunosModal.nome}) e vinculado à nova turma selecionada, recalculando as vagas de forma atômica.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                required
                value={turmaDestinoTransferenciaId}
                onChange={(e) => setTurmaDestinoTransferenciaId(e.target.value)}
                className="flex-1 bg-white dark:bg-[#141d17] border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="">Selecione a Turma de Destino...</option>
                {turmasReferencia
                  .filter((t) => t.id !== selectedTurmaAlunosModal.id)
                  .map((t) => {
                    const vagas = t.vagas_restantes ?? Math.max(0, t.capacidade_maxima - (t.alunos_matriculados || 0));
                    return (
                      <option key={t.id} value={t.id} disabled={vagas <= 0}>
                        {t.nome} {t.codigo ? `[${t.codigo}]` : ''} — {vagas > 0 ? `${vagas} vagas livres` : 'LOTADA'}
                      </option>
                    );
                  })}
              </select>
              <button
                type="submit"
                disabled={transferindo || !turmaDestinoTransferenciaId}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center space-x-1"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{transferindo ? 'Transferindo...' : 'Confirmar Transferência'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tabela de Alunos Enturmados */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-200 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0">
              <tr>
                <th className="p-3 w-16 text-center">Nº</th>
                <th className="p-3">Aluno(a)</th>
                <th className="p-3">CPF</th>
                <th className="p-3">Responsável & Contato</th>
                <th className="p-3">Data Matrícula</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200 font-medium">
              {loadingTurmaAlunos ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Carregando chamada da turma...
                  </td>
                </tr>
              ) : turmaAlunos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Nenhum aluno enturmado nesta turma até o momento.
                  </td>
                </tr>
              ) : (
                turmaAlunos.map((a, idx) => {
                  const numChamada = a.numero_chamada ?? idx + 1;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-center">
                        <span className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-xs">
                          #{String(numChamada).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{a.nome}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          Nasc: {a.data_nascimento}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{a.cpf}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{a.nome_responsavel}</div>
                        <div className="text-[10px] text-salvia-700 dark:text-salvia-400 font-mono">
                          {a.telefone_responsavel}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {a.data_matricula}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300">
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setAlunoParaTransferir(a);
                              setTurmaDestinoTransferenciaId('');
                            }}
                            className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all"
                            title="Transferir de Turma"
                          >
                            <ArrowRightLeft className="w-3 h-3 text-amber-700" />
                            <span>Transferir</span>
                          </button>

                          <button
                            onClick={() => handleDesenturmarAluno(a.aluno_id, a.nome)}
                            className="p-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg transition-all"
                            title="Desenturmar Aluno"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSelectedTurmaAlunosModal(null);
              setAlunoParaTransferir(null);
              setTurmaAlunosMsg(null);
            }}
            className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            Fechar Livro de Chamada
          </button>
        </div>
      </div>
    </div>
  );
}
