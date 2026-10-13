'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  BookOpen,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
} from 'lucide-react';
import { isTurmaInfantil } from '@/lib/types/academico';
import { useTurmaAlunos } from './academico/useTurmaAlunos';
import { useOfflineSyncQueue } from './academico/useOfflineSyncQueue';
import { ChamadaPanel } from './academico/ChamadaPanel';
import { InfantilRotinaPanel } from './academico/InfantilRotinaPanel';

const hojeLocal = () => {
  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60000;
  return new Date(agora.getTime() - offset).toISOString().split('T')[0];
};

export function AcademicoSection() {
  const { isOnline, tenant, user } = useAuth();
  const role = user?.role || 'admin';
  const searchParams = useSearchParams();

  const [dataAula, setDataAula] = useState(hojeLocal);
  const [refreshKey, setRefreshKey] = useState(0);

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

  useEffect(() => {
    const turmaParam = searchParams?.get('turma');
    const dataParam = searchParams?.get('data');

    if (dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
      setDataAula(dataParam);
    }

    if (turmaParam) {
      const encontrada = turmasOpcoes.find((t) => t.id === turmaParam);
      if (encontrada) {
        selecionarTurma(turmaParam);
      }
    }
  }, [searchParams, turmasOpcoes, selecionarTurma]);

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
            A turma escolhida define o diário: educação infantil mostra presença, refeições e rotina; as demais etapas mostram a chamada e o conteúdo.
          </p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block text-salvia-700 dark:text-salvia-300 font-bold mb-1">Turma:</label>
          <select
            value={turmaId}
            onChange={(e) => selecionarTurma(e.target.value)}
            className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
          >
            <option value="">Nenhuma turma cadastrada</option>
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
              ? `${infantil ? 'Diário infantil' : 'Chamada'} · ${turmaSelecionada.etapa_ensino || 'etapa não informada'}`
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

      {listaErro && (
        <p className="mb-4 text-xs font-medium text-amber-700 dark:text-amber-300">{listaErro}</p>
      )}

      <ChamadaPanel
        modo={infantil ? 'infantil' : 'fundamental'}
        turmaId={turmaId}
        turmaNome={turmaNome}
        dataAula={dataAula}
        onDataAulaChange={setDataAula}
        alunos={alunos}
        setAlunos={setAlunos}
        isOnline={isOnline}
        tenantId={tenant?.id}
        enqueue={enqueue}
        removeByUuid={removeByUuid}
        showToast={showToast}
        onSaved={() => setRefreshKey((k) => k + 1)}
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
