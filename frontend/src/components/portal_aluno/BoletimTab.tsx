import React from 'react';
import type { BoletimData } from './types';
import { formatNumero } from '@/lib/formatters';
import { Lock, Unlock, MessageSquare } from 'lucide-react';

export interface BoletimTabProps {
  boletim: BoletimData | null;
}

const LABEL_PERIODO: Record<string, string> = {
  '1_bimestre': '1º Bimestre',
  '2_bimestre': '2º Bimestre',
  '3_bimestre': '3º Bimestre',
  '4_bimestre': '4º Bimestre',
  '1_trimestre': '1º Trimestre',
  '2_trimestre': '2º Trimestre',
  '3_trimestre': '3º Trimestre',
  recuperacao: 'Recuperação',
};

const ENCAMINHAMENTO_LABEL: Record<string, string> = {
  recuperacao: 'Recuperação',
  acompanhamento: 'Acompanhamento pedagógico',
  sem_pendencias: 'Sem pendências',
};

export function BoletimTab({
  boletim,
}: BoletimTabProps) {
  return (
    <div className="space-y-6">
      {/* Cards de Resumo Geral */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-salvia-50/70 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
          <span className="text-[11px] font-semibold text-salvia-600 dark:text-salvia-400 block">Média Geral Ponderada</span>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900 dark:text-salvia-50">
            {boletim && boletim.media_geral != null ? formatNumero(boletim.media_geral, 2) : '—'}
          </div>
          <span className="text-[10px] text-salvia-500 font-medium mt-1 inline-block">
            {!boletim
              ? 'Boletim não carregado'
              : boletim.media_geral == null
                ? 'Ainda sem notas lançadas'
                : boletim.media_geral >= 7
                  ? 'Acima da média mínima (7.00)'
                  : 'Abaixo da média mínima (7.00)'}
          </span>
        </div>

        <div className="p-4 bg-salvia-50/70 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
          <span className="text-[11px] font-semibold text-salvia-600 dark:text-salvia-400 block">Frequência Consolidada</span>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900 dark:text-salvia-50">—</div>
          <span className="text-[10px] text-salvia-500 font-medium mt-1 inline-block">
            Frequência ainda não disponível neste painel
          </span>
        </div>

        <div className="p-4 bg-salvia-50/70 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
          <span className="text-[11px] font-semibold text-salvia-600 dark:text-salvia-400 block">Status Acadêmico</span>
          <div className="mt-1">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
              !boletim
                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                : boletim.status_aprovacao === 'Aprovado' || boletim.status_aprovacao === 'Em andamento'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : boletim.status_aprovacao === 'Reprovado'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-700'
            }`}>
              {boletim ? boletim.status_aprovacao : 'Sem boletim'}
            </span>
          </div>
          <span className="text-[10px] text-salvia-500 mt-1 inline-block">
            O resultado final sai depois do 4º bimestre.
          </span>
        </div>
      </div>

      {/* Tabela de Disciplinas */}
      <div className="overflow-x-auto border border-salvia-200 dark:border-salvia-800 rounded-2xl shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-salvia-100/70 dark:bg-salvia-800/60 text-salvia-800 dark:text-salvia-200 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Disciplina</th>
              <th className="py-3 px-4 text-center">1º Bim.</th>
              <th className="py-3 px-4 text-center">2º Bim.</th>
              <th className="py-3 px-4 text-center">3º Bim.</th>
              <th className="py-3 px-4 text-center">4º Bim.</th>
              <th className="py-3 px-4 text-center">Média Parcial</th>
              <th className="py-3 px-4 text-center">Frequência</th>
              <th className="py-3 px-4 text-center">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800">
            {boletim && boletim.disciplinas && boletim.disciplinas.length > 0 ? (
              boletim.disciplinas.map((disc, idx) => {
                const aprovado = disc.media != null && disc.media >= 7.0;
                return (
                  <tr key={idx} className="hover:bg-salvia-50/50 dark:hover:bg-salvia-950/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-salvia-50">{disc.nome}</td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {formatNumero(disc.nota_1_bim, 1)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {formatNumero(disc.nota_2_bim, 1)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {formatNumero(disc.nota_3_bim, 1)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {formatNumero(disc.nota_4_bim, 1)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 dark:text-salvia-50">
                      {formatNumero(disc.media, 2)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {disc.frequencia_pct == null ? '-' : `${formatNumero(disc.frequencia_pct, 0)}%`}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          aprovado
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {aprovado ? 'Na média' : 'Abaixo da média'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-8 px-4 text-center text-sm text-salvia-600 dark:text-salvia-400">
                  Nenhuma nota lançada para este aluno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Períodos fechados e pareceres do conselho */}
      {boletim && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-salvia-50/70 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200 mb-3 flex items-center space-x-2">
              <Lock className="w-4 h-4" />
              <span>Situação dos períodos</span>
            </h3>
            <div className="space-y-2">
              {Object.keys(LABEL_PERIODO).map((periodo) => {
                const fechado = boletim.periodos_fechados?.includes(periodo) ?? false;
                return (
                  <div
                    key={periodo}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-salvia-900/60 border border-salvia-200 dark:border-salvia-800"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-salvia-50">
                      {LABEL_PERIODO[periodo]}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                        fechado
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                      }`}
                    >
                      {fechado ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{fechado ? 'Fechado' : 'Em aberto (pode mudar)'}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-salvia-50/70 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200 mb-3 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Pareceres do conselho de classe</span>
            </h3>
            {boletim.pareceres && boletim.pareceres.length > 0 ? (
              <div className="space-y-2">
                {boletim.pareceres.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white dark:bg-salvia-900/60 border border-salvia-200 dark:border-salvia-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-salvia-700 dark:text-salvia-300">
                        {LABEL_PERIODO[p.periodo] || p.periodo}
                      </span>
                      {p.encaminhamento && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {ENCAMINHAMENTO_LABEL[p.encaminhamento] || p.encaminhamento}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 dark:text-salvia-100 whitespace-pre-wrap">
                      {p.parecer}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-salvia-600 dark:text-salvia-400">
                Nenhum parecer do conselho registrado ainda.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
