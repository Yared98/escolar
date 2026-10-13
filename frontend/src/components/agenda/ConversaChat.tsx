import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ThreadAgenda } from './types';
import { rotuloCanal, tituloTema, agruparMensagensPorDia } from './utils';
import { BolhaMensagem } from './BolhaMensagem';

export interface ConversaChatProps {
  thread: ThreadAgenda;
  respostaTexto: string;
  setRespostaTexto: (v: string) => void;
  respondendo: boolean;
  onEnviar: () => void;
  onVoltar: () => void;
  nomeTurma: (id?: string | null) => string;
  isMobile?: boolean;
}

const MAX_LINHAS = 5;

export function ConversaChat({
  thread,
  respostaTexto,
  setRespostaTexto,
  respondendo,
  onEnviar,
  onVoltar,
  nomeTurma,
  isMobile,
}: ConversaChatProps) {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [areaAltura, setAreaAltura] = useState('2.5rem');
  const grupos = agruparMensagensPorDia(thread.mensagens);
  const isMural = thread.raiz.canal === 'mural_turma';

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread.mensagens, thread.id]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    const altura = Math.min(textareaRef.current.scrollHeight, MAX_LINHAS * 24);
    setAreaAltura(`${Math.max(40, altura)}px`);
  }, [respostaTexto]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
      e.preventDefault();
      if (respostaTexto.trim() && !respondendo) {
        onEnviar();
      }
    }
  };

  const handleEnviarClick = () => {
    if (respostaTexto.trim() && !respondendo) {
      onEnviar();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-[#0c120e]/50">
      <header className="shrink-0 px-4 py-3 border-b border-salvia-200 dark:border-salvia-800 bg-white dark:bg-salvia-900 flex items-center gap-3">
        <button
          type="button"
          onClick={onVoltar}
          aria-label="Voltar para as conversas"
          className="lg:hidden w-11 h-11 min-h-[44px] -ml-2 inline-flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-salvia-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-salvia-200" />
        </button>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-salvia-50 truncate">
            {tituloTema(thread.raiz.titulo)}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-salvia-400">
            <span className={`font-bold px-2 py-0.5 rounded-full ${isMural ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200' : 'bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200'}`}>
              {rotuloCanal(thread.raiz.canal)}
            </span>
            {thread.raiz.turma_id ? (
              <span className="truncate">{nomeTurma(thread.raiz.turma_id)}</span>
            ) : isMural ? (
              <span>Toda a escola</span>
            ) : null}
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-5"
      >
        {grupos.map((grupo) => (
          <div key={grupo.data.toISOString()} className="space-y-3">
            <div className="flex justify-center">
              <span className="text-[10px] font-bold text-slate-500 dark:text-salvia-400 bg-slate-200/60 dark:bg-salvia-800/60 px-3 py-1 rounded-full">
                {grupo.label}
              </span>
            </div>
            {grupo.mensagens.map((m) => (
              <BolhaMensagem
                key={m.id}
                mensagem={m}
                userId={user?.id}
                isRaiz={m.id === thread.raiz.id}
                isMural={isMural}
              />
            ))}
          </div>
        ))}
      </div>

      <div
        className="shrink-0 px-3 sm:px-4 py-3 border-t border-salvia-200 dark:border-salvia-800 bg-white dark:bg-salvia-900"
        style={{ paddingBottom: isMobile ? 'max(0.75rem, env(safe-area-inset-bottom))' : undefined }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={respostaTexto}
            onChange={(e) => setRespostaTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Mensagem"
            disabled={respondendo}
            className="flex-1 min-h-[40px] max-h-[120px] bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-2xl px-3 py-2.5 text-sm text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600 resize-none"
            style={{ height: areaAltura }}
          />
          <button
            type="button"
            onClick={handleEnviarClick}
            disabled={respondendo || !respostaTexto.trim()}
            aria-label="Enviar mensagem"
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-salvia-700 text-white inline-flex items-center justify-center hover:bg-salvia-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
