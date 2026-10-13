'use client';

import React from 'react';
import { AlertCircle, ClipboardList, RotateCcw } from 'lucide-react';
import { tipoOcorrenciaLabel, type OcorrenciaAluno } from '@/lib/types/academico';

const formatarDataHora = (iso: string) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface OcorrenciasTabProps {
  ocorrencias: OcorrenciaAluno[];
  loading: boolean;
  erro: string | null;
  onTentarNovamente: () => void;
}

export function OcorrenciasTab({
  ocorrencias,
  loading,
  erro,
  onTentarNovamente,
}: OcorrenciasTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <ClipboardList className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-salvia-800 dark:text-salvia-200">
          Observações da escola
        </h3>
      </div>

      <p className="text-xs text-salvia-600 dark:text-salvia-400">
        Registros feitos pelos professores e pela coordenação sobre o dia a dia do
        estudante, do mais recente ao mais antigo.
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
      ) : ocorrencias.length === 0 ? (
        <div className="p-6 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/50 dark:bg-salvia-950/40 text-center">
          <ClipboardList className="w-8 h-8 mx-auto text-salvia-400 mb-2" />
          <p className="text-sm font-bold text-slate-900 dark:text-salvia-50">
            Nenhuma observação registrada.
          </p>
          <p className="text-xs text-salvia-600 dark:text-salvia-400 mt-1">
            Quando a escola registrar uma observação, ela aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {ocorrencias.map((ocorrencia) => (
            <li
              key={ocorrencia.id}
              className="p-4 rounded-2xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/40 dark:bg-salvia-950/30 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-salvia-100 text-salvia-800 dark:bg-salvia-800 dark:text-salvia-200">
                  {tipoOcorrenciaLabel(ocorrencia.tipo_ocorrencia)}
                </span>
                <span className="text-xs text-salvia-500 dark:text-salvia-400 text-right">
                  {formatarDataHora(ocorrencia.created_at)}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-salvia-200 leading-relaxed whitespace-pre-line">
                {ocorrencia.descricao}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
