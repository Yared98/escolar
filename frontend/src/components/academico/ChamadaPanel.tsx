'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users, CheckCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  OBSERVACAO_DIARIO_MAX,
  type AlunoChamada,
  type DiarioDiaResponse,
  type DiarioRecenteItem,
  type SyncDiarioPayload,
  type StatusPresenca,
  type ToastMsg,
} from '@/lib/types/academico';

interface ChamadaPanelProps {
  modo: 'fundamental' | 'infantil';
  turmaId: string;
  turmaNome: string;
  dataAula: string;
  disciplinaId?: string;
  horarioId?: string;
  onDataAulaChange: (value: string) => void;
  alunos: AlunoChamada[];
  setAlunos: React.Dispatch<React.SetStateAction<AlunoChamada[]>>;
  isOnline: boolean;
  tenantId: string | undefined;
  enqueue: (entity: string, payload: Record<string, unknown>) => Promise<string>;
  removeByUuid: (uuid: string) => Promise<void>;
  showToast: (toast: ToastMsg, ms?: number) => void;
  onSaved?: () => void;
}

const CONTEUDO_PADRAO_INFANTIL = 'Rotina infantil';

export function ChamadaPanel({
  modo,
  turmaId,
  turmaNome,
  dataAula,
  disciplinaId,
  horarioId,
  onDataAulaChange,
  alunos,
  setAlunos,
  isOnline,
  tenantId,
  enqueue,
  removeByUuid,
  showToast,
  onSaved,
}: ChamadaPanelProps) {
  const infantil = modo === 'infantil';
  const alunosKey = alunos.map((a) => a.id).join(',');
  const [conteudo, setConteudo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [historico, setHistorico] = useState<DiarioRecenteItem[]>([]);
  const [carregandoDia, setCarregandoDia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erroConteudo, setErroConteudo] = useState<string | null>(null);
  const [diaCarregado, setDiaCarregado] = useState<DiarioDiaResponse | null>(null);

  const setStatusPresenca = (alunoId: string, status: StatusPresenca) => {
    setAlunos((prev) => prev.map((a) => (a.id === alunoId ? { ...a, status } : a)));
  };

  const setJustificativaTexto = (alunoId: string, texto: string) => {
    setAlunos((prev) => prev.map((a) => (a.id === alunoId ? { ...a, justificativa: texto } : a)));
  };

  const carregarHistorico = useCallback(async () => {
    if (!turmaId || !isOnline) {
      setHistorico([]);
      return;
    }
    try {
      const disciplinaQuery = disciplinaId
        ? `&disciplina_id=${encodeURIComponent(disciplinaId)}`
        : '';
      const data = await apiFetch<DiarioRecenteItem[]>(
        `/academico/diario/recentes?turma_id=${encodeURIComponent(turmaId)}${disciplinaQuery}&limit=10`
      );
      setHistorico(data || []);
    } catch {
      setHistorico([]);
    }
  }, [turmaId, disciplinaId, isOnline]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  useEffect(() => {
    if (!turmaId || !dataAula || !alunosKey) return;

    let ativo = true;
    async function carregarDia() {
      if (!isOnline) {
        setConteudo('');
        setObservacao('');
        setDiaCarregado(null);
        return;
      }
      setCarregandoDia(true);
      try {
        const disciplinaQuery = disciplinaId
          ? `&disciplina_id=${encodeURIComponent(disciplinaId)}`
          : '';
        const dia = await apiFetch<DiarioDiaResponse>(
          `/academico/diario?turma_id=${encodeURIComponent(turmaId)}&data_aula=${encodeURIComponent(dataAula)}${disciplinaQuery}`
        );
        if (!ativo) return;
        setDiaCarregado(dia);
        if (dia.encontrado) {
          const texto = dia.conteudo_ministrado || '';
          setConteudo(infantil && texto === CONTEUDO_PADRAO_INFANTIL ? '' : texto);
          setObservacao(dia.observacao || '');
          const map = new Map(dia.presencas.map((p) => [p.aluno_id, p]));
          setAlunos((prev) =>
            prev.map((a) => {
              const p = map.get(a.id);
              if (!p) return { ...a, status: 'presente' as const, justificativa: undefined };
              if (p.presente) return { ...a, status: 'presente' as const, justificativa: undefined };
              if (p.justificativa) {
                return { ...a, status: 'justificada' as const, justificativa: p.justificativa };
              }
              return { ...a, status: 'falta' as const, justificativa: undefined };
            })
          );
        } else {
          setConteudo('');
          setObservacao('');
          setAlunos((prev) =>
            prev.map((a) => ({ ...a, status: 'presente' as const, justificativa: undefined }))
          );
        }
      } catch {
        if (!ativo) return;
        setConteudo('');
        setObservacao('');
        setDiaCarregado(null);
      } finally {
        if (ativo) setCarregandoDia(false);
      }
    }
    carregarDia();
    return () => {
      ativo = false;
    };
    // alunosKey tracks the roster only, so status edits do not trigger a reload
  }, [turmaId, disciplinaId, dataAula, isOnline, alunosKey, setAlunos, infantil]);

  const handleSalvar = async () => {
    if (!tenantId) {
      showToast({ text: 'Sua sessão expirou. Entre novamente.', type: 'warn' });
      return;
    }
    if (!turmaId || alunos.length === 0) {
      showToast({ text: 'Selecione uma turma com alunos enturmados antes de salvar.', type: 'warn' });
      return;
    }

    setErroConteudo(null);
    setSaving(true);
    const syncPayload: SyncDiarioPayload = {
      turma_id: turmaId,
      data_aula: dataAula,
      conteudo_ministrado: conteudo || (infantil ? CONTEUDO_PADRAO_INFANTIL : ''),
      observacao: observacao.slice(0, OBSERVACAO_DIARIO_MAX),
      presencas: alunos.map((a) => ({
        aluno_id: a.id,
        presente: a.status === 'presente',
        justificativa: a.status === 'justificada' ? a.justificativa || 'Falta justificada' : null,
      })),
    };
    // Aula específica (Fundamental II/Médio): grava o diário da disciplina.
    // O payload vai inteiro para a fila offline; sem disciplina, é o diário do dia inteiro.
    if (disciplinaId) syncPayload.disciplina_id = disciplinaId;
    if (horarioId) syncPayload.horario_id = horarioId;

    let eventUuid = '';
    try {
      eventUuid = await enqueue('diario_classe', syncPayload as unknown as Record<string, unknown>);
    } catch (err: unknown) {
      showToast({
        text: err instanceof Error ? err.message : 'Não foi possível salvar neste aparelho.',
        type: 'warn',
      });
      setSaving(false);
      return;
    }

    let syncOk = false;
    if (isOnline) {
      try {
        await apiFetch('/academico/diario/sync', {
          method: 'POST',
          body: JSON.stringify(syncPayload),
        });
        syncOk = true;
        if (eventUuid) await removeByUuid(eventUuid);
        await carregarHistorico();
        onSaved?.();
      } catch (err: unknown) {
        syncOk = false;
        const msg = err instanceof Error ? err.message : '';
        if (msg.toLowerCase().includes('conteúdo') || msg.toLowerCase().includes('conteudo')) {
          setErroConteudo('Informe o conteúdo da aula');
        }
      }
    }

    showToast({
      text: syncOk
        ? infantil
          ? 'Presença do dia salva no diário infantil.'
          : 'Chamada salva.'
        : 'Chamada salva neste aparelho. O envio ao servidor ocorre ao reconectar, ao reabrir o Diário ou ao voltar para esta aba.',
      type: 'success',
    });
    setSaving(false);
  };

  const horarioLabel =
    disciplinaId && diaCarregado?.hora_inicio && diaCarregado?.hora_fim
      ? `${diaCarregado.hora_inicio}–${diaCarregado.hora_fim}`
      : null;

  return (
    <div className="space-y-6">
      {disciplinaId && (
        <div className="flex items-center space-x-2 text-xs flex-wrap gap-y-1">
          <span className="font-bold text-slate-900 dark:text-salvia-50">{turmaNome || 'Turma'}</span>
          <span className="text-salvia-400">·</span>
          <span className="font-bold text-salvia-700 dark:text-salvia-300">
            {diaCarregado?.disciplina_nome || 'Disciplina'}
          </span>
          {horarioLabel && (
            <>
              <span className="text-salvia-400">·</span>
              <span className="font-mono font-bold text-salvia-700 dark:text-salvia-300">
                {horarioLabel}
              </span>
            </>
          )}
        </div>
      )}
      <div className="p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
          <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">Resumo:</label>
          <div className="flex items-center space-x-2 pt-1 font-mono font-bold">
            <span className="text-emerald-600">{alunos.filter((a) => a.status === 'presente').length} P</span>
            <span>•</span>
            <span className="text-rose-600">{alunos.filter((a) => a.status === 'falta').length} F</span>
            <span>•</span>
            <span className="text-amber-600">{alunos.filter((a) => a.status === 'justificada').length} J</span>
          </div>
          {carregandoDia && (
            <p className="mt-1 text-[10px] text-salvia-500">Carregando diário do dia...</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">
            {infantil ? 'Atividades do dia (opcional):' : 'Conteúdo Ministrado:'}
          </label>
          <input
            type="text"
            value={conteudo}
            onChange={(e) => {
              setConteudo(e.target.value);
              if (erroConteudo) setErroConteudo(null);
            }}
            placeholder={
              infantil
                ? 'Ex: Roda de música e pintura com as mãos...'
                : 'Ex: Resolução de exercícios e debate temático...'
            }
            className={`w-full bg-white dark:bg-salvia-900 border rounded-xl px-3.5 py-2 font-medium text-slate-900 dark:text-salvia-50 focus:outline-none placeholder-salvia-400 ${
              erroConteudo
                ? 'border-rose-400 focus:border-rose-500'
                : 'border-salvia-300 dark:border-salvia-700 focus:border-salvia-600'
            }`}
          />
          {erroConteudo && (
            <p className="mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">{erroConteudo}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-salvia-700 dark:text-salvia-300 font-bold">
              Observação livre
            </label>
            <span className="font-mono text-[10px] text-salvia-500">
              {observacao.length}/{OBSERVACAO_DIARIO_MAX}
            </span>
          </div>
          <textarea
            value={observacao}
            maxLength={OBSERVACAO_DIARIO_MAX}
            rows={4}
            onChange={(e) => setObservacao(e.target.value.slice(0, OBSERVACAO_DIARIO_MAX))}
            placeholder="Notas do dia que não cabem nos campos acima: recados, combinados, imprevistos, lembretes da turma..."
            className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3.5 py-2 font-medium text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 placeholder-salvia-400 resize-y"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200 flex items-center space-x-2">
            <Users className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
            <span>{infantil ? 'Presença do dia' : 'Chamada'}</span>
          </h3>
          <button
            onClick={() => setAlunos((prev) => prev.map((a) => ({ ...a, status: 'presente' })))}
            className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-lg transition-all text-xs font-bold min-h-[44px] flex items-center"
          >
            Marcar Todos Presentes
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alunos.length === 0 && (
            <p className="md:col-span-2 text-xs text-salvia-600 dark:text-salvia-400">
              Nenhum aluno enturmado nesta turma. A chamada fica disponível depois do ensalamento na secretaria.
            </p>
          )}
          {alunos.map((aluno) => (
            <div
              key={aluno.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-2 ${
                aluno.status === 'presente'
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                  : aluno.status === 'falta'
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
              }`}
            >
              <div className="flex flex-col max-sm:space-y-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm sm:text-xs font-bold text-slate-900 dark:text-salvia-50">{aluno.nome}</h4>
                  <span
                    className={`text-[10px] font-mono font-bold uppercase mt-0.5 block ${
                      aluno.status === 'presente'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : aluno.status === 'falta'
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {aluno.status === 'presente'
                      ? 'Presente'
                      : aluno.status === 'falta'
                        ? 'Falta'
                        : 'Falta justificada'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  {(['presente', 'falta', 'justificada'] as StatusPresenca[]).map((st) => (
                    <button
                      key={st}
                      title={st}
                      onClick={() => setStatusPresenca(aluno.id, st)}
                      className={`w-9 h-9 max-sm:w-11 max-sm:h-11 rounded-xl font-mono font-bold text-sm sm:text-xs flex items-center justify-center transition-all ${
                        aluno.status === st
                          ? st === 'presente'
                            ? 'bg-emerald-600 text-white shadow-md scale-105'
                            : st === 'falta'
                              ? 'bg-rose-600 text-white shadow-md scale-105'
                              : 'bg-amber-500 text-white shadow-md scale-105'
                          : 'bg-white dark:bg-salvia-800 border border-salvia-300 text-slate-700 dark:text-salvia-200'
                      }`}
                    >
                      {st === 'presente' ? 'P' : st === 'falta' ? 'F' : 'J'}
                    </button>
                  ))}
                </div>
              </div>
              {aluno.status === 'justificada' && (
                <input
                  type="text"
                  value={aluno.justificativa || ''}
                  onChange={(e) => setJustificativaTexto(aluno.id, e.target.value)}
                  placeholder="Motivo da justificativa (ex: Atestado médico)..."
                  className="w-full bg-white dark:bg-salvia-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-800 dark:text-salvia-100 font-medium focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="hidden sm:flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-salvia-200 dark:border-salvia-800">
        <p className="text-xs text-salvia-600 dark:text-salvia-400">
          A chamada fica neste aparelho até o servidor confirmar. Turma: {turmaNome || '—'}.
        </p>
        <button
          onClick={handleSalvar}
          disabled={saving || !turmaId || alunos.length === 0}
          className="w-full sm:w-auto bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-6 py-3 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-md disabled:opacity-50"
        >
          <CheckCheck className="w-4 h-4" />
          <span>
            {saving ? 'Salvando...' : infantil ? 'Salvar presença do dia' : 'Salvar chamada'}
          </span>
        </button>
      </div>

      <div className="sm:hidden fixed bottom-20 left-0 right-0 z-40 px-4">
        <button
          onClick={handleSalvar}
          disabled={saving || !turmaId || alunos.length === 0}
          className="w-full bg-salvia-700 hover:bg-salvia-800 disabled:opacity-50 text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 px-4 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-lg"
        >
          <CheckCheck className="w-4 h-4" />
          <span>
            {saving ? 'Salvando...' : infantil ? 'Salvar presença do dia' : 'Salvar chamada'}
          </span>
        </button>
      </div>

      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
          Últimas aulas registradas
        </h3>
        <div className="divide-y divide-salvia-100 dark:divide-salvia-800 border border-salvia-200 dark:border-salvia-800 rounded-2xl overflow-hidden text-xs">
          {historico.length === 0 ? (
            <p className="p-4 text-salvia-600 dark:text-salvia-400">
              Nenhum diário lançado para esta turma ainda.
            </p>
          ) : (
            historico.map((h) => (
              <button
                key={h.diario_id}
                type="button"
                onClick={() => onDataAulaChange(h.data_aula)}
                className="w-full text-left p-3 bg-salvia-50/40 dark:bg-salvia-950/30 flex justify-between items-center hover:bg-salvia-100/60 dark:hover:bg-salvia-900/40 transition-colors"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 dark:text-salvia-50">
                    {turmaNome}
                    {h.disciplina_nome ? ` · ${h.disciplina_nome}` : ''}
                  </span>
                  <div className="text-[11px] text-salvia-600 dark:text-salvia-400 flex flex-wrap items-center gap-x-2 font-mono">
                    <span>Data: {h.data_aula}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-bold">{h.total_presentes} presentes</span>
                    <span>•</span>
                    <span className="text-rose-600 font-bold">
                      {Math.max(0, h.total_presencas - h.total_presentes)} ausentes
                    </span>
                  </div>
                  {h.conteudo_ministrado ? (
                    <p className="text-[11px] text-salvia-500 truncate max-w-md">{h.conteudo_ministrado}</p>
                  ) : (
                    <p className="text-[11px] text-salvia-500 truncate max-w-md italic">
                      Conteúdo não informado
                    </p>
                  )}
                  {h.observacao && (
                    <p className="text-[11px] text-salvia-500 truncate max-w-md">{h.observacao}</p>
                  )}
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Abrir dia
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
