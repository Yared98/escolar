'use client';

import React, { useState } from 'react';
import { ClipboardPlus } from 'lucide-react';
import {
  OCORRENCIA_DESCRICAO_MAX,
  TIPOS_OCORRENCIA_FUNDAMENTAL,
} from '@/lib/types/academico';

export interface OcorrenciaFormData {
  tipo: string;
  descricao: string;
  avisarFamilia: boolean;
}

interface OcorrenciaModalProps {
  open: boolean;
  alunoNome?: string;
  salvando?: boolean;
  erro?: string | null;
  onClose: () => void;
  onSave: (data: OcorrenciaFormData) => Promise<void> | void;
}

const VAZIO: OcorrenciaFormData = {
  tipo: 'comportamento',
  descricao: '',
  avisarFamilia: true,
};

export function OcorrenciaModal({
  open,
  alunoNome,
  salvando = false,
  erro = null,
  onClose,
  onSave,
}: OcorrenciaModalProps) {
  const [form, setForm] = useState<OcorrenciaFormData>(VAZIO);

  if (!open) return null;

  const descricaoValida = form.descricao.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricaoValida || salvando) return;
    try {
      await onSave({
        tipo: form.tipo,
        descricao: form.descricao.trim().slice(0, OCORRENCIA_DESCRICAO_MAX),
        avisarFamilia: form.avisarFamilia,
      });
      setForm(VAZIO);
    } catch {
      // Falhou: mantém o que foi digitado para o professor tentar de novo.
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center space-x-2 pb-3 border-b border-salvia-100 dark:border-salvia-800">
          <ClipboardPlus className="w-5 h-5 text-salvia-700 dark:text-salvia-300" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
              Observação do aluno
            </h3>
            {alunoNome && (
              <p className="text-xs text-salvia-600 dark:text-salvia-400">
                Aluno: {alunoNome}
              </p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="ocorrencia-tipo"
            className="block text-xs font-bold text-slate-800 dark:text-salvia-200 mb-1"
          >
            Tipo
          </label>
          <select
            id="ocorrencia-tipo"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="w-full min-h-[44px] bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-salvia-50"
          >
            {TIPOS_OCORRENCIA_FUNDAMENTAL.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="ocorrencia-descricao"
              className="block text-xs font-bold text-slate-800 dark:text-salvia-200"
            >
              Descrição
            </label>
            <span className="font-mono text-xs text-salvia-500">
              {form.descricao.length}/{OCORRENCIA_DESCRICAO_MAX}
            </span>
          </div>
          <textarea
            id="ocorrencia-descricao"
            required
            rows={4}
            value={form.descricao}
            onChange={(e) =>
              setForm({ ...form, descricao: e.target.value.slice(0, OCORRENCIA_DESCRICAO_MAX) })
            }
            placeholder="Descreva o que aconteceu, com linguagem clara para a família..."
            className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl p-3 text-xs text-slate-900 dark:text-salvia-50"
          />
        </div>

        <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-salvia-200 cursor-pointer min-h-[44px] py-2">
          <input
            type="checkbox"
            checked={form.avisarFamilia}
            onChange={(e) => setForm({ ...form, avisarFamilia: e.target.checked })}
            className="accent-salvia-600 w-5 h-5"
          />
          <span>Avisar a família</span>
        </label>
        <p className="text-xs text-salvia-500 dark:text-salvia-400">
          A família vê a observação no Portal da família. Saúde e elogio sempre são
          avisados.
        </p>

        {erro && (
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{erro}</p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 sm:py-2 rounded-xl text-xs font-bold text-salvia-700 dark:text-salvia-300 hover:bg-salvia-100 dark:hover:bg-salvia-800 min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!descricaoValida || salvando}
            className="bg-salvia-700 hover:bg-salvia-800 text-white px-4 py-3 sm:py-2 rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 min-h-[44px]"
          >
            {salvando ? 'Salvando...' : 'Registrar observação'}
          </button>
        </div>
      </form>
    </div>
  );
}
