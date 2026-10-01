import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Aluno, Turma } from './types';

interface EnsalamentoModalProps {
  isOpen: boolean;
  turma: Turma | null;
  alunos: Aluno[];
  onClose: () => void;
  onSuccess: () => void;
}

export function EnsalamentoModal({
  isOpen,
  turma,
  alunos,
  onClose,
  onSuccess,
}: EnsalamentoModalProps) {
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>(alunos[0]?.id || '');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !turma) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const alunoIdToUse = selectedAlunoId || alunos[0]?.id;
    if (!alunoIdToUse) {
      alert('Selecione um aluno para ensalamento.');
      return;
    }

    setSubmitting(true);
    setSuccessMsg(null);
    try {
      await apiFetch('/secretaria/turmas/matricular', {
        method: 'POST',
        body: JSON.stringify({
          turma_id: turma.id,
          aluno_id: alunoIdToUse,
        }),
      });

      setSuccessMsg('Aluno ensalado com sucesso!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 900);
    } catch (err: any) {
      alert(err.message || 'Erro ao realizar ensalamento do aluno.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#141d17] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Ensalamento de Aluno</h3>
            <p className="text-xs text-salvia-700 dark:text-salvia-400 font-semibold">{turma.nome}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Selecione o Aluno para a Turma
            </label>
            <select
              value={selectedAlunoId || alunos[0]?.id || ''}
              onChange={(e) => setSelectedAlunoId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0c120e] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-salvia-600 font-medium"
            >
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} — CPF: {a.cpf}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 dark:bg-[#0c120e] p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Capacidade Total:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{turma.capacidade_maxima}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Matriculados Atualmente:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{turma.alunos_matriculados || 0}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-salvia-700 dark:bg-salvia-600 hover:bg-salvia-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-60"
            >
              {submitting ? 'Ensalando...' : 'Confirmar Ensalamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
