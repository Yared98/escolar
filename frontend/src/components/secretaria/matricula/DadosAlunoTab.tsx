import React from 'react';
import { formatCpf } from '@/lib/formatters';

export interface DadosAlunoTabProps {
  nome: string;
  setNome: (v: string) => void;
  cpf: string;
  setCpf: (v: string) => void;
  dataNascimento: string;
  setDataNascimento: (v: string) => void;
  statusInicialMatricula: 'ativo' | 'pre_matricula';
  setStatusInicialMatricula: (v: 'ativo' | 'pre_matricula') => void;
  setModalTab: (v: 'dados_aluno' | 'responsaveis' | 'endereco_contato' | 'prontuario') => void;
}

export function DadosAlunoTab({
  nome,
  setNome,
  cpf,
  setCpf,
  dataNascimento,
  setDataNascimento,
  statusInicialMatricula,
  setStatusInicialMatricula,
  setModalTab,
}: DadosAlunoTabProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Nome Completo do Aluno *
        </label>
        <input
          type="text"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Gabriel Souza Silva"
          className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            CPF do Aluno (Módulo 11) *
          </label>
          <input
            type="text"
            required
            maxLength={14}
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="000.000.000-00"
            className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Data de Nascimento *
          </label>
          <input
            type="date"
            required
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Situação inicial da matrícula
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStatusInicialMatricula('ativo')}
            className={`rounded-xl border px-3 py-2 text-left text-[11px] transition ${
              statusInicialMatricula === 'ativo'
                ? 'border-salvia-600 bg-salvia-50 dark:bg-salvia-950/40 text-salvia-900 dark:text-salvia-200'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <span className="font-bold block">Matrícula ativa</span>
            Matrícula confirmada: o aluno já pode ser colocado em uma turma.
          </button>
          <button
            type="button"
            onClick={() => setStatusInicialMatricula('pre_matricula')}
            className={`rounded-xl border px-3 py-2 text-left text-[11px] transition ${
              statusInicialMatricula === 'pre_matricula'
                ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <span className="font-bold block">Pré-matrícula</span>
            Aguardando documentos ou confirmação final.
          </button>
        </div>
      </div>

      <div className="pt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setModalTab('responsaveis')}
          className="bg-salvia-700 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-salvia-800"
        >
          Avançar para Responsáveis →
        </button>
      </div>
    </div>
  );
}
