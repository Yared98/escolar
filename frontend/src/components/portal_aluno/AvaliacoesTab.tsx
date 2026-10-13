'use client';

import React from 'react';
import { AlertCircle, CalendarDays, ClipboardList, RotateCcw } from 'lucide-react';
import type { AvaliacaoCalendario } from '@/lib/types/academico';

const formatarDiaMes = (data: string) => {
  const valor = new Date(data + 'T00:00:00');
  if (Number.isNaN(valor.getTime())) return data;
  return valor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const formatarDataCompleta = (data: string) => {
  const valor = new Date(data + 'T00:00:00');
  if (Number.isNaN(valor.getTime())) return data;
  return valor.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
};

const rotuloTipo = (tipo: string) => {
  if (tipo === 'prova') return 'Prova';
  if (tipo === 'trabalho') return 'Trabalho';
  if (tipo === 'atividade') return 'Atividade';
  return tipo;
};

interface AvaliacoesTabProps {
  avaliacoes: AvaliacaoCalendario[];
  loading: boolean;
  erro: string | null;
  onTentarNovamente: () => void;
}

export function AvaliacoesTab({
  avaliacoes,
  loading,
  erro,
  onTentarNovamente,
}: AvaliacoesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <CalendarDays className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
          Provas e trabalhos
        </h3>
      </div>

      <p className="text-xs text-salvia-600 dark:text-salvia-400">
        Datas marcadas pelos professores nas turmas dos seus filhos.
      </p>

      {erro && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
          <button
            type="button"
            onClick={onTentarNovamente}
            className="flex items-center space-x-1.5 text-xs font-bold underline underline-offset-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tentar de novo</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 bg-salvia-100 dark:bg-salvia-800/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : avaliacoes.length === 0 ? (
        <div className="p-6 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/50 dark:bg-salvia-950/40 text-center">
          <ClipboardList className="w-8 h-8 mx-auto text-salvia-400 mb-2" />
          <p className="text-sm font-bold text-slate-900 dark:text-salvia-50">
            Nenhuma prova ou trabalho marcado.
          </p>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
            Assim que o professor marcar uma data, ela aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {avaliacoes.map((avaliacao) => (
            <div
              key={avaliacao.id}
              className="p-4 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/40 dark:bg-salvia-950/30 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="shrink-0 text-center px-3 py-2 rounded-xl bg-salvia-100 dark:bg-salvia-800">
                    <span className="block text-sm font-bold text-salvia-900 dark:text-salvia-50">
                      {formatarDiaMes(avaliacao.data)}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
                      {avaliacao.titulo}
                    </h4>
                    <p className="text-xs text-salvia-700 dark:text-salvia-300">
                      {avaliacao.turma_nome}
                      {avaliacao.disciplina_nome ? ` · ${avaliacao.disciplina_nome}` : ''}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-salvia-100 text-salvia-800 dark:bg-salvia-800 dark:text-salvia-200">
                  {rotuloTipo(avaliacao.tipo)}
                </span>
              </div>

              <p className="text-xs text-salvia-600 dark:text-salvia-400">
                {formatarDataCompleta(avaliacao.data)}
              </p>

              {avaliacao.descricao && (
                <p className="text-xs text-slate-700 dark:text-salvia-200 whitespace-pre-line">
                  {avaliacao.descricao}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
