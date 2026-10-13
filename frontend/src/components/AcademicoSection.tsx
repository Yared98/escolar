'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  BookOpen,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
  ArrowRight,
  X,
  CalendarCheck,
} from 'lucide-react';
import {
  PRIORIDADE_OCORRENCIA,
  isTurmaInfantil,
  formatarAvisoRecadoEnviado,
  urlConversaAgenda,
  type AlunoChamada,
  type NovaOcorrenciaPayload,
  type OcorrenciaAluno,
} from '@/lib/types/academico';
import { apiFetch } from '@/lib/api';
import { useTurmaAlunos } from './academico/useTurmaAlunos';
import { useOfflineSyncQueue } from './academico/useOfflineSyncQueue';
import { ChamadaPanel } from './academico/ChamadaPanel';
import { InfantilRotinaPanel } from './academico/InfantilRotinaPanel';
import {
  FrequenciaPanel,
  type RelatorioFrequencia,
} from './academico/FrequenciaPanel';
import {
  OcorrenciaModal,
  type OcorrenciaFormData,
} from './academico/OcorrenciaModal';
import { RecadoFamiliaModal } from './academico/RecadoFamiliaModal';
import { etapaEnsinoLabel } from '@/lib/etapas';

const hojeLocal = () => {
  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60000;
  return new Date(agora.getTime() - offset).toISOString().split('T')[0];
};

export function AcademicoSection() {
  const { isOnline, tenant, user } = useAuth();
  const role = user?.role || 'admin';
  const searchParams = useSearchParams();

  const [tabAtiva, setTabAtiva] = useState<'diario' | 'frequencia'>(() => {
    return searchParams?.get('tab') === 'frequencia' ? 'frequencia' : 'diario';
  });

  const [dataAula, setDataAula] = useState(hojeLocal);
  const [refreshKey, setRefreshKey] = useState(0);
  const [diarioDisciplinaId, setDiarioDisciplinaId] = useState('');
  const [diarioHorarioId, setDiarioHorarioId] = useState('');

  // Frequência
  const [mesFrequencia, setMesFrequencia] = useState(() => hojeLocal().slice(0, 7));
  const [disciplinaFrequenciaId, setDisciplinaFrequenciaId] = useState('');
  const [relatorioFrequencia, setRelatorioFrequencia] = useState<RelatorioFrequencia | null>(null);
  const [loadingFrequencia, setLoadingFrequencia] = useState(false);
  const [erroFrequencia, setErroFrequencia] = useState<string | null>(null);

  const {
    turmasOpcoes,
    turmaId,
    turmaNome,
    turmaSelecionada,
    selecionarTurma,
    alunos,
    setAlunos,
    selectedAlunoId,
    setSelectedAlunoId,
    listaErro,
  } = useTurmaAlunos(role);

  const {
    pendingSyncCount,
    syncing,
    toastMsg,
    showToast,
    enqueue,
    removeByUuid,
    flush,
  } = useOfflineSyncQueue(tenant?.id, isOnline);

  const infantil = isTurmaInfantil(turmaSelecionada);

  // Observações (ocorrências) do Fundamental: contagem por aluno na data do diário.
  const [ocorrenciasPorAluno, setOcorrenciasPorAluno] = useState<Record<string, number>>({});
  const [ocorrenciaAluno, setOcorrenciaAluno] = useState<AlunoChamada | null>(null);
  const [salvandoOcorrencia, setSalvandoOcorrencia] = useState(false);
  const [erroOcorrencia, setErroOcorrencia] = useState<string | null>(null);

  // Recado do professor à família direto da chamada
  const [recadoAluno, setRecadoAluno] = useState<AlunoChamada | null>(null);
  const [salvandoRecado, setSalvandoRecado] = useState(false);
  const [erroRecado, setErroRecado] = useState<string | null>(null);
  const [avisoRecado, setAvisoRecado] = useState<{
    responsavel: string;
    conversaId: string;
  } | null>(null);

  const carregarOcorrencias = useCallback(async () => {
    if (!turmaId || !dataAula || !isOnline) {
      setOcorrenciasPorAluno({});
      return;
    }
    try {
      const lista = await apiFetch<OcorrenciaAluno[]>(
        `/agenda/ocorrencias?turma_id=${encodeURIComponent(turmaId)}&data=${encodeURIComponent(dataAula)}`
      );
      const contagem: Record<string, number> = {};
      for (const ocorrencia of lista || []) {
        contagem[ocorrencia.aluno_id] = (contagem[ocorrencia.aluno_id] || 0) + 1;
      }
      setOcorrenciasPorAluno(contagem);
    } catch {
      // Sem dados não inventa contagem: o painel segue sem o selo.
      setOcorrenciasPorAluno({});
    }
  }, [turmaId, dataAula, isOnline]);

  const carregarRelatorioFrequencia = useCallback(async () => {
    if (!turmaId || !mesFrequencia || !isOnline) {
      setRelatorioFrequencia(null);
      return;
    }
    setLoadingFrequencia(true);
    setErroFrequencia(null);
    try {
      let data: RelatorioFrequencia;
      if (disciplinaFrequenciaId) {
        data = await apiFetch<RelatorioFrequencia>(
          `/academico/frequencia?turma_id=${encodeURIComponent(turmaId)}&mes=${encodeURIComponent(mesFrequencia)}&disciplina_id=${encodeURIComponent(disciplinaFrequenciaId)}`
        );
      } else {
        data = await apiFetch<RelatorioFrequencia>(
          `/academico/frequencia?turma_id=${encodeURIComponent(turmaId)}&mes=${encodeURIComponent(mesFrequencia)}`
        );
      }
      setRelatorioFrequencia(data);
    } catch (err: unknown) {
      setErroFrequencia(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o relatório de frequência.'
      );
      setRelatorioFrequencia(null);
    } finally {
      setLoadingFrequencia(false);
    }
  }, [turmaId, mesFrequencia, disciplinaFrequenciaId, isOnline]);

  useEffect(() => {
    void carregarOcorrencias();
    // Recarrega sempre que a chamada do dia é salva ou a turma/data muda.
  }, [carregarOcorrencias, refreshKey]);

  useEffect(() => {
    if (tabAtiva === 'frequencia') {
      void carregarRelatorioFrequencia();
    }
  }, [tabAtiva, carregarRelatorioFrequencia]);

  useEffect(() => {
    const turmaParam = searchParams?.get('turma');
    const dataParam = searchParams?.get('data');
    const disciplinaParam = searchParams?.get('disciplina');
    const horarioParam = searchParams?.get('horario');

    if (dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
      setDataAula(dataParam);
    }

    if (turmaParam) {
      const encontrada = turmasOpcoes.find((t) => t.id === turmaParam);
      if (encontrada) {
        selecionarTurma(turmaParam);
        // Navegação "Fazer chamada" traz a aula (disciplina + horário) na URL;
        // sem disciplina na URL, o Diário volta ao registro do dia inteiro.
        setDiarioDisciplinaId(disciplinaParam || '');
        setDiarioHorarioId(horarioParam || '');
      }
    }
  }, [searchParams, turmasOpcoes, selecionarTurma]);

  const selecionarTurmaLocal = (id: string) => {
    // Troca manual de turma sai do contexto de uma aula específica.
    setDiarioDisciplinaId('');
    setDiarioHorarioId('');
    selecionarTurma(id);
  };

  const abrirOcorrencia = (aluno: AlunoChamada) => {
    setErroOcorrencia(null);
    setOcorrenciaAluno(aluno);
  };

  const fecharOcorrencia = () => {
    setOcorrenciaAluno(null);
    setErroOcorrencia(null);
  };

  const salvarOcorrencia = async (dados: OcorrenciaFormData) => {
    const aluno = ocorrenciaAluno;
    if (!aluno) return;
    if (!isOnline) {
      setErroOcorrencia(
        'Sem conexão com a internet. A observação só pode ser registrada online.'
      );
      return;
    }
    if (!turmaId) {
      setErroOcorrencia('Selecione uma turma antes de registrar a observação.');
      return;
    }

    setErroOcorrencia(null);
    setSalvandoOcorrencia(true);
    const payload: NovaOcorrenciaPayload = {
      aluno_id: aluno.id,
      turma_id: turmaId,
      tipo_ocorrencia: dados.tipo,
      descricao: dados.descricao,
      prioridade: PRIORIDADE_OCORRENCIA[dados.tipo] || 'media',
      notificado_responsavel: dados.avisarFamilia,
    };

    try {
      await apiFetch('/agenda/ocorrencias', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast({
        text: 'Observação registrada. A família vê no Portal da família.',
        type: 'success',
      });
      setOcorrenciaAluno(null);
      await carregarOcorrencias();
    } catch (err: unknown) {
      setErroOcorrencia(
        err instanceof Error ? err.message : 'Não foi possível registrar a observação.'
      );
    } finally {
      setSalvandoOcorrencia(false);
    }
  };

  const abrirRecadoFamilia = (aluno: AlunoChamada) => {
    setAvisoRecado(null);
    setErroRecado(null);
    setRecadoAluno(aluno);
  };

  const fecharRecadoFamilia = () => {
    setRecadoAluno(null);
    setErroRecado(null);
  };

  const enviarRecadoFamilia = async (conteudo: string) => {
    const aluno = recadoAluno;
    if (!aluno) return;
    if (!isOnline) {
      setErroRecado(
        'Sem conexão com a internet. O recado só pode ser enviado online.'
      );
      return;
    }

    setErroRecado(null);
    setSalvandoRecado(true);
    try {
      const res = await apiFetch<{ id: string; thread_id?: string | null }>(
        '/agenda/mensagens',
        {
          method: 'POST',
          body: JSON.stringify({
            aluno_id: aluno.id,
            turma_id: turmaId || undefined,
            canal: 'responsavel',
            titulo: `Recado sobre ${aluno.nome}`,
            conteudo,
          }),
        }
      );
      const conversaId = res.thread_id || res.id;
      const responsavel = aluno.responsavel_nome?.trim() || 'o responsável';
      setAvisoRecado({
        responsavel,
        conversaId,
      });
      setRecadoAluno(null);
    } catch (err: unknown) {
      setErroRecado(
        err instanceof Error ? err.message : 'Não foi possível enviar o recado.'
      );
    } finally {
      setSalvandoRecado(false);
    }
  };

  return (
    <section
      id="academico"
      className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 sm:p-6 shadow-sm relative transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-salvia-100 dark:border-salvia-800">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-salvia-600 dark:text-salvia-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-salvia-50">Diário</h2>
            {isOnline ? (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Wifi className="w-3 h-3" />
                <span>Online</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                <WifiOff className="w-3 h-3" />
                <span>Sem internet: salvando no aparelho</span>
              </span>
            )}
          </div>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-0.5">
            {tabAtiva === 'frequencia'
              ? 'Relatórios mensais de frequência e apuração de faltas.'
              : 'Chamada e registro da aula do dia.'}
          </p>
        </div>

        <div className="flex items-center space-x-1 bg-salvia-100 dark:bg-salvia-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setTabAtiva('diario')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
              tabAtiva === 'diario'
                ? 'bg-white dark:bg-salvia-700 text-salvia-900 dark:text-salvia-50 shadow-sm'
                : 'text-salvia-700 dark:text-salvia-300 hover:text-slate-900 dark:hover:text-salvia-50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Chamada do dia</span>
          </button>
          <button
            type="button"
            onClick={() => setTabAtiva('frequencia')}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
              tabAtiva === 'frequencia'
                ? 'bg-white dark:bg-salvia-700 text-salvia-900 dark:text-salvia-50 shadow-sm'
                : 'text-salvia-700 dark:text-salvia-300 hover:text-slate-900 dark:hover:text-salvia-50'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Frequência</span>
          </button>
        </div>
      </div>

      {tabAtiva === 'frequencia' ? (
        <FrequenciaPanel
          turmasOpcoes={turmasOpcoes}
          turmaId={turmaId}
          onSelectTurma={selecionarTurmaLocal}
          mes={mesFrequencia}
          onMesChange={setMesFrequencia}
          disciplinaId={disciplinaFrequenciaId}
          onDisciplinaChange={setDisciplinaFrequenciaId}
          disciplinasOpcoes={turmaSelecionada?.disciplinas || []}
          relatorio={relatorioFrequencia}
          loading={loadingFrequencia}
          erro={erroFrequencia}
          onRecarregar={carregarRelatorioFrequencia}
        />
      ) : (
        <>
          <div className="mb-6 p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">Turma:</label>
              <select
                value={turmaId}
                onChange={(e) => selecionarTurmaLocal(e.target.value)}
                className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
              >
                <option value="">{turmasOpcoes.length === 0 ? 'Nenhuma turma disponível' : 'Selecione a turma'}</option>
                {turmasOpcoes.map((turma) => (
                  <option key={turma.id} value={turma.id}>
                    {turma.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">Data:</label>
              <input
                type="date"
                value={dataAula}
                onChange={(e) => setDataAula(e.target.value)}
                className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
              />
            </div>
            <div>
              <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">Etapa da turma:</label>
              <span
                className={`inline-block mt-1 px-3 py-1 rounded-full text-[11px] font-bold border ${
                  infantil
                    ? 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-salvia-100 border-salvia-300 text-salvia-900 dark:bg-salvia-800 dark:text-salvia-100'
                }`}
              >
                {turmaSelecionada
                  ? `${infantil ? 'Diário infantil' : 'Chamada'} · ${etapaEnsinoLabel(turmaSelecionada.etapa_ensino)}`
                  : '—'}
              </span>
            </div>
          </div>

          {toastMsg && (
            <div
              className={`mb-4 p-3.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all ${
                toastMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
              }`}
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>{toastMsg.text}</span>
            </div>
          )}

          {avisoRecado && (
            <div className="mb-4 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{formatarAvisoRecadoEnviado(avisoRecado.responsavel)}</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={urlConversaAgenda(avisoRecado.conversaId)}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 min-h-[44px] transition-all"
                >
                  <span>Abrir conversa</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setAvisoRecado(null)}
                  className="p-2 text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl"
                  aria-label="Fechar aviso de recado"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {listaErro && (
            <p className="mb-4 text-xs font-medium text-amber-700 dark:text-amber-300">{listaErro}</p>
          )}

          <ChamadaPanel
            modo={infantil ? 'infantil' : 'fundamental'}
            turmaId={turmaId}
            turmaNome={turmaNome}
            dataAula={dataAula}
            disciplinaId={diarioDisciplinaId}
            disciplinaNome={
              turmaSelecionada?.disciplinas?.find((d) => d.disciplina_id === diarioDisciplinaId)?.disciplina_nome
            }
            horarioId={diarioHorarioId}
            onDataAulaChange={setDataAula}
            alunos={alunos}
            setAlunos={setAlunos}
            isOnline={isOnline}
            tenantId={tenant?.id}
            enqueue={enqueue}
            removeByUuid={removeByUuid}
            showToast={showToast}
            onSaved={() => setRefreshKey((k) => k + 1)}
            ocorrenciasPorAluno={ocorrenciasPorAluno}
            onAbrirOcorrencia={abrirOcorrencia}
            onAbrirRecadoFamilia={abrirRecadoFamilia}
          />

          <OcorrenciaModal
            open={!!ocorrenciaAluno}
            alunoNome={ocorrenciaAluno?.nome}
            salvando={salvandoOcorrencia}
            erro={erroOcorrencia}
            onClose={fecharOcorrencia}
            onSave={salvarOcorrencia}
          />

          <RecadoFamiliaModal
            open={!!recadoAluno}
            alunoNome={recadoAluno?.nome}
            responsavelNome={recadoAluno?.responsavel_nome}
            salvando={salvandoRecado}
            erro={erroRecado}
            onClose={fecharRecadoFamilia}
            onSend={enviarRecadoFamilia}
          />

          {infantil && (
            <div className="mt-8 pt-6 border-t border-salvia-200 dark:border-salvia-800">
              <InfantilRotinaPanel
                turmaId={turmaId}
                turmaNome={turmaNome}
                dataAula={dataAula}
                alunos={alunos}
                selectedAlunoId={selectedAlunoId}
                setSelectedAlunoId={setSelectedAlunoId}
                isOnline={isOnline}
                tenantId={tenant?.id}
                enqueue={enqueue}
                showToast={showToast}
                refreshKey={refreshKey}
              />
            </div>
          )}
        </>
      )}

      {pendingSyncCount > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => { void flush('manual'); }}
            disabled={syncing || !isOnline}
            className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-full font-bold text-xs flex items-center space-x-2 shadow-2xl border-2 border-amber-300 dark:border-amber-500 transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>
              {syncing
                ? 'Sincronizando...'
                : `Sincronizar ${pendingSyncCount} item(ns) pendente(s)`}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
