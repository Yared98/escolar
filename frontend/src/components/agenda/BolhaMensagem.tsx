import React from 'react';
import { perfilAmigavel } from '@/lib/perfis';
import { MensagemAgenda } from './types';
import { mensagemEhMinha } from './utils';

export interface BolhaMensagemProps {
  mensagem: MensagemAgenda;
  userId?: string | null;
  isRaiz?: boolean;
  isMural?: boolean;
}

export function BolhaMensagem({ mensagem, userId, isRaiz, isMural }: BolhaMensagemProps) {
  const minha = mensagemEhMinha(mensagem, userId);

  const horario = (() => {
    const data = new Date(mensagem.created_at);
    if (Number.isNaN(data.getTime())) return '';
    const h = String(data.getHours()).padStart(2, '0');
    const m = String(data.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  })();

  return (
    <div className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
          minha
            ? 'bg-salvia-100 dark:bg-salvia-800 text-slate-900 dark:text-salvia-50 rounded-br-md'
            : 'bg-white dark:bg-salvia-900 text-slate-800 dark:text-slate-200 border border-salvia-100 dark:border-salvia-800 rounded-bl-md'
        }`}
      >
        {!minha && (
          <div className="mb-1 pr-10">
            <p className="text-xs font-bold text-slate-900 dark:text-salvia-50 truncate">
              {mensagem.remetente_nome || 'Usuário'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-salvia-400">
              {perfilAmigavel(mensagem.remetente_role)}
            </p>
          </div>
        )}

        {isRaiz && isMural && (
          <span className="inline-block text-[10px] font-bold text-salvia-700 dark:text-salvia-300 mb-1">
            Aviso
          </span>
        )}

        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed pr-12">
          {mensagem.conteudo}
        </p>

        <span
          className={`absolute bottom-2 right-3 text-[10px] font-medium ${
            minha ? 'text-salvia-700 dark:text-salvia-300' : 'text-slate-500 dark:text-salvia-400'
          }`}
        >
          {horario}
        </span>
      </div>
    </div>
  );
}
