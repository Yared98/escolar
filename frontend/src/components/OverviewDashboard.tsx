'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { perfilAmigavel } from '@/lib/perfis';
import {
  Users,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';
import { NavRoute, isRouteAllowed } from './Sidebar';
import { apiFetch } from '@/lib/api';

interface OverviewDashboardProps {
  onRouteChange: (route: NavRoute) => void;
}

interface KpiData {
  totalAlunos: number;
  receitaMensal: number;
  adimplencia: number;
  totalAlertasEvasao: number;
}

export function OverviewDashboard({ onRouteChange }: OverviewDashboardProps) {
  const { user } = useAuth();
  const role = user?.role || 'admin';
  const [kpi, setKpi] = useState<KpiData>({
    totalAlunos: 0,
    receitaMensal: 0,
    adimplencia: 0,
    totalAlertasEvasao: 0,
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadKpis() {
      const podeVerFinanceiro = isRouteAllowed('financeiro', role);
      const podeVerSecretaria = isRouteAllowed('secretaria', role);
      const podeVerIaEvasao = isRouteAllowed('ia_evasao', role);

      try {
        const promises: Promise<unknown>[] = [];
        const indices = {
          dre: -1,
          alunos: -1,
          alertas: -1,
        };

        if (podeVerFinanceiro) {
          indices.dre = promises.length;
          promises.push(
            apiFetch<{ receita_bruta: number; total_faturas_pagas: number; total_faturas_pendentes: number }>(
              '/financeiro/relatorios/dre'
            )
          );
        }
        if (podeVerSecretaria) {
          indices.alunos = promises.length;
          promises.push(apiFetch<{ total: number }>('/secretaria/alunos?status=ativo&limit=1'));
        }
        if (podeVerIaEvasao) {
          indices.alertas = promises.length;
          promises.push(apiFetch<{ aluno_id: string }[]>('/ia/evasao/alertas'));
        }

        const results = promises.length > 0 ? await Promise.allSettled(promises) : [];

        const dre = indices.dre >= 0 && results[indices.dre].status === 'fulfilled' ? (results[indices.dre] as PromiseFulfilledResult<{ receita_bruta: number; total_faturas_pagas: number; total_faturas_pendentes: number }>).value : null;
        const alunosPage = indices.alunos >= 0 && results[indices.alunos].status === 'fulfilled' ? (results[indices.alunos] as PromiseFulfilledResult<{ total: number }>).value : null;
        const alertas = indices.alertas >= 0 && results[indices.alertas].status === 'fulfilled' ? (results[indices.alertas] as PromiseFulfilledResult<{ aluno_id: string }[]>).value : [];

        const failed = results.some((result) => result.status === 'rejected');
        setKpi({
          totalAlunos: alunosPage?.total ?? 0,
          receitaMensal: dre?.receita_bruta ?? 0,
          adimplencia: dre
            ? Math.round(
                (dre.total_faturas_pagas / Math.max(1, dre.total_faturas_pagas + dre.total_faturas_pendentes)) * 100
              )
            : 0,
          totalAlertasEvasao: alertas.length,
        });
        setLoadError(failed ? 'Alguns indicadores não puderam ser carregados.' : null);
      } catch {
        setKpi({
          totalAlunos: 0,
          receitaMensal: 0,
          adimplencia: 0,
          totalAlertasEvasao: 0,
        });
        setLoadError('Não foi possível carregar os indicadores.');
      }
    }
    loadKpis();
  }, [role]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-salvia-100 dark:border-salvia-800">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-salvia-100 dark:bg-salvia-800 rounded-2xl text-salvia-700 dark:text-salvia-300">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-salvia-50">
                Painel da escola
              </h1>
              <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-0.5">
                Olá, <span className="font-semibold text-slate-900 dark:text-salvia-50">{user?.name}</span>! Perfil: <span className="font-semibold text-salvia-700 dark:text-salvia-300">{perfilAmigavel(role)}</span>.
              </p>
            </div>
          </div>
        </div>

        {loadError && (
          <p className="mt-4 text-xs font-medium text-amber-700 dark:text-amber-300">{loadError}</p>
        )}

        {/* High-density KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-salvia-600 dark:text-salvia-400 text-xs mb-1 font-medium">
              <span>Alunos Ativos</span>
              <Users className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-salvia-50 font-mono">{kpi.totalAlunos}</p>
            <span className="text-[10px] text-salvia-500 font-medium mt-1 block">Matrículas carregadas</span>
          </div>

          <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-salvia-600 dark:text-salvia-400 text-xs mb-1 font-medium">
              <span>Receita do mês</span>
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
              R$ {kpi.receitaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </p>
            <span className="text-[10px] text-salvia-500 font-medium mt-1 block">{kpi.adimplencia}% Adimplência no mês</span>
          </div>

          <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-salvia-600 dark:text-salvia-400 text-xs mb-1 font-medium">
              <span>Frequência Hoje</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-salvia-50 font-mono">—</p>
            <span className="text-[10px] text-salvia-500 font-medium mt-1 block">Sem chamada registrada hoje</span>
          </div>

          <div className="bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-salvia-600 dark:text-salvia-400 text-xs mb-1 font-medium">
              <span>Alunos em risco de evasão</span>
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className={`text-2xl font-bold font-mono ${kpi.totalAlertasEvasao > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {kpi.totalAlertasEvasao}
            </p>
            <span className={`text-[10px] font-bold mt-1 block ${kpi.totalAlertasEvasao > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {kpi.totalAlertasEvasao > 0 ? `${kpi.totalAlertasEvasao} alerta(s) crítico(s)` : 'Sem alertas críticos'}
            </span>
          </div>
        </div>

      </div>

      {/* Alerta de saúde */}
      <div
        onClick={() => onRouteChange('agenda')}
        className="cursor-pointer bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 p-5 rounded-2xl hover:border-salvia-500 transition-all space-y-2"
      >
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-bold text-slate-900 dark:text-salvia-50 text-sm">Alerta de Restrições Alimentares & Saúde</h3>
        </div>
        <p className="text-xs text-salvia-600 dark:text-salvia-400">
          Restrições alimentares do prontuário aparecem no cardápio quando estão cadastradas.
        </p>
      </div>
    </div>
  );
}
