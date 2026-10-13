'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Brain, AlertTriangle, TrendingDown, BookX, DollarSign, Activity, CheckCircle2 } from 'lucide-react';

interface DetalhesEvasao {
  faturas_atrasadas: number;
  frequencia_ultimos_30_dias: number;
  media_disciplinas: number;
  sem_chamadas?: boolean;
}

interface AlertaEvasao {
  aluno_id: string;
  aluno_nome?: string;
  turma_nome?: string;
  score_risco_evasao: number;
  nivel_urgencia: string; // 'alta', 'media', 'baixa'
  fator_principal: string; // 'faltas_reiteradas', 'inadimplencia', 'queda_desempenho'
  recomendacao: string;
  detalhes: DetalhesEvasao;
}

export function PainelEvasao() {
  const [alertas, setAlertas] = useState<AlertaEvasao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const loadAlertas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<AlertaEvasao[]>('/ia/evasao/alertas');
      setAlertas(data || []);
      setErro(null);
    } catch (err: unknown) {
      setAlertas([]);
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar os alertas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlertas();
  }, [loadAlertas]);

  const getUrgencyColor = (urgencia: string) => {
    if (urgencia === 'alta') return 'bg-rose-100 text-rose-800 border-rose-200';
    if (urgencia === 'media' || urgencia === 'moderada') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  const getUrgencyProgressColor = (urgencia: string) => {
    if (urgencia === 'alta') return 'bg-rose-500';
    if (urgencia === 'media' || urgencia === 'moderada') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getFatorIcon = (fator: string) => {
    if (fator === 'faltas_reiteradas') return <Activity className="w-5 h-5 text-rose-500" />;
    if (fator === 'inadimplencia') return <DollarSign className="w-5 h-5 text-amber-500" />;
    if (fator === 'queda_desempenho') return <TrendingDown className="w-5 h-5 text-orange-500" />;
    return <BookX className="w-5 h-5 text-gray-500" />;
  };

  const formatFator = (fator: string) => {
    const formatado = fator.replace('_', ' ');
    return formatado.charAt(0).toUpperCase() + formatado.slice(1);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Brain className="w-6 h-6 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">IA Preditiva Anti-Evasão</h2>
            <p className="text-gray-500 text-sm">Monitoramento proativo (Early Warning System) para evitar a perda de alunos</p>
          </div>
        </div>
      </div>

      {erro && (
        <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">{erro}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 h-48 animate-pulse shadow-sm"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {erro ? null : alertas.length === 0 ? (
            <div className="col-span-full bg-emerald-50 border border-emerald-100 p-8 rounded-2xl text-center flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <h3 className="text-lg font-bold text-emerald-900">Nenhum alerta crítico!</h3>
              <p className="text-emerald-700 text-sm mt-1">A IA não detectou alunos com alto risco de evasão no momento.</p>
            </div>
          ) : (
            alertas.map((alerta) => (
              <div key={alerta.aluno_id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gray-50 border border-gray-100`}>
                      {getFatorIcon(alerta.fator_principal)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm mb-0.5" title={`ID: ${alerta.aluno_id}`}>
                        {alerta.aluno_nome || `ID: ${alerta.aluno_id.split('-')[0]}...`}
                      </h4>
                      {alerta.turma_nome && (
                        <p className="text-[10px] text-gray-500 mb-0.5">{alerta.turma_nome}</p>
                      )}
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getUrgencyColor(alerta.nivel_urgencia)}`}>
                        Risco {alerta.nivel_urgencia}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-2xl font-black tracking-tight text-gray-900">
                      {alerta.score_risco_evasao.toFixed(1)}
                    </span>
                    <span className="text-xs font-bold text-gray-400 ml-1">/ 100</span>
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${getUrgencyProgressColor(alerta.nivel_urgencia)}`} 
                        style={{ width: `${alerta.score_risco_evasao}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h5 className="text-xs font-bold text-gray-900 mb-1">Ação Recomendada (IA)</h5>
                      <p className="text-xs text-gray-600 leading-relaxed">{alerta.recomendacao}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white border border-gray-100 rounded-lg p-2 text-center">
                    <span className="block text-[10px] text-gray-500 font-medium mb-0.5">Frequência</span>
                    {alerta.detalhes.sem_chamadas ? (
                      <span className="font-bold text-sm text-gray-500">Sem chamadas registradas</span>
                    ) : (
                      <span className={`font-bold text-sm ${alerta.detalhes.frequencia_ultimos_30_dias < 75 ? 'text-rose-600' : 'text-gray-900'}`}>
                        {alerta.detalhes.frequencia_ultimos_30_dias.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="bg-white border border-gray-100 rounded-lg p-2 text-center">
                    <span className="block text-[10px] text-gray-500 font-medium mb-0.5">Média Geral</span>
                    <span className={`font-bold text-sm ${alerta.detalhes.media_disciplinas < 6.0 ? 'text-rose-600' : 'text-gray-900'}`}>
                      {alerta.detalhes.media_disciplinas.toFixed(1)}
                    </span>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-lg p-2 text-center">
                    <span className="block text-[10px] text-gray-500 font-medium mb-0.5">Faturas Atr.</span>
                    <span className={`font-bold text-sm ${alerta.detalhes.faturas_atrasadas > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {alerta.detalhes.faturas_atrasadas}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
