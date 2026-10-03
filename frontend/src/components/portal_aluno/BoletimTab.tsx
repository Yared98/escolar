import React from 'react';
import type { BoletimData } from './types';

export interface BoletimTabProps {
  boletim: BoletimData | null;
}

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
            {boletim ? boletim.media_geral.toFixed(2) : '—'}
          </div>
          <span className="text-[10px] text-salvia-500 font-medium mt-1 inline-block">
            {boletim ? (boletim.media_geral >= 7 ? 'Acima da média mínima (7.00)' : 'Abaixo da média mínima (7.00)') : 'Boletim não carregado'}
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
              boletim
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600'
            }`}>
              {boletim ? boletim.status_aprovacao : 'Sem boletim'}
            </span>
          </div>
          <span className="text-[10px] text-salvia-500 mt-1 inline-block">Ano Letivo 2026 em andamento</span>
        </div>
      </div>

      {/* Tabela de Disciplinas */}
      <div className="overflow-x-auto border border-salvia-200 dark:border-salvia-800 rounded-2xl shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-salvia-100/70 dark:bg-salvia-800/60 text-salvia-800 dark:text-salvia-200 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Disciplina</th>
              <th className="py-3 px-4 text-center">1º Bimestre</th>
              <th className="py-3 px-4 text-center">2º Bimestre</th>
              <th className="py-3 px-4 text-center">Média Parcial</th>
              <th className="py-3 px-4 text-center">Frequência</th>
              <th className="py-3 px-4 text-center">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800">
            {boletim && boletim.disciplinas && boletim.disciplinas.length > 0 ? (
              boletim.disciplinas.map((disc, idx) => {
                const aprovado = disc.media >= 7.0;
                return (
                  <tr key={idx} className="hover:bg-salvia-50/50 dark:hover:bg-salvia-950/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-salvia-50">{disc.nome}</td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {disc.nota_1_bim !== undefined ? disc.nota_1_bim.toFixed(1) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {disc.nota_2_bim !== undefined ? disc.nota_2_bim.toFixed(1) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 dark:text-salvia-50">
                      {disc.media.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">{disc.frequencia_pct.toFixed(0)}%</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          aprovado
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {aprovado ? 'Aprovado' : 'Em Recuperação'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-sm text-salvia-600 dark:text-salvia-400">
                  Nenhuma nota lançada para este aluno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
