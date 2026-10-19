'use client';

import React, { useState } from 'react';
import { MessageSquare, Send, X, AlertCircle } from 'lucide-react';
import { formatarListaNomes } from '@/lib/types/academico';

export interface RecadoFamiliaModalProps {
  open: boolean;
  alunoNome?: string;
  responsavelNome?: string;
  responsaveisNomes?: string[];
  salvando?: boolean;
  erro?: string | null;
  onClose: () => void;
  onSend: (mensagem: string) => Promise<void> | void;
}

export function RecadoFamiliaModal({
  open,
  alunoNome,
  responsavelNome,
  responsaveisNomes,
  salvando = false,
  erro = null,
  onClose,
  onSend,
}: RecadoFamiliaModalProps) {
  const [mensagem, setMensagem] = useState('');

  if (!open) return null;

  const mensagemValida = mensagem.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensagemValida || salvando) return;
    try {
      await onSend(mensagem.trim());
      setMensagem('');
    } catch {
      // Se falhar na Section, mantém a mensagem para reenvio.
    }
  };

  const handleClose = () => {
    setMensagem('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-salvia-100 dark:border-salvia-800">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-salvia-700 dark:text-salvia-300" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
                Recado à família
              </h3>
              {alunoNome && (
                <p className="text-xs text-salvia-600 dark:text-salvia-400">
                  Aluno: <span className="font-semibold text-slate-800 dark:text-salvia-200">{alunoNome}</span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-salvia-500 hover:text-slate-800 dark:text-salvia-400 dark:hover:text-salvia-100 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(() => {
          const nomesLista =
            responsaveisNomes && responsaveisNomes.length > 0
              ? responsaveisNomes
              : (responsavelNome || '').trim()
                ? [(responsavelNome || '').trim()]
                : [];
          const textoDestinatarios =
            nomesLista.length > 0
              ? formatarListaNomes(nomesLista)
              : (responsavelNome || '').trim();
          if (!textoDestinatarios) return null;
          const ehPlural = nomesLista.length > 1 || textoDestinatarios.includes(' e ');

          return (
            <div className="p-3 bg-salvia-50/70 dark:bg-salvia-950/60 border border-salvia-200 dark:border-salvia-800/80 rounded-xl text-xs">
              <span className="text-salvia-600 dark:text-salvia-400 font-medium">
                {ehPlural ? 'Destinatários: ' : 'Destinatário: '}
              </span>
              <span className="font-bold text-salvia-900 dark:text-salvia-100">{textoDestinatarios}</span>
            </div>
          );
        })()}

        <div>
          <label
            htmlFor="recado-mensagem"
            className="block text-xs font-bold text-slate-800 dark:text-salvia-200 mb-1"
          >
            Mensagem
          </label>
          <textarea
            id="recado-mensagem"
            rows={4}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Digite o recado para a família do aluno..."
            className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 placeholder-salvia-400 resize-y min-h-[96px]"
            required
          />
        </div>

        {erro && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t border-salvia-100 dark:border-salvia-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={salvando}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-salvia-300 dark:border-salvia-700 text-xs font-bold text-slate-700 dark:text-salvia-200 hover:bg-salvia-50 dark:hover:bg-salvia-800 disabled:opacity-50 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!mensagemValida || salvando}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 dark:hover:bg-salvia-500 text-xs font-bold flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>{salvando ? 'Enviando...' : 'Enviar'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
