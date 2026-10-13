import React from 'react';
import { Plus } from 'lucide-react';
import { FiltroCanal, ThreadAgenda } from './types';
import { ConversasLista } from './ConversasLista';
import { ConversaChat } from './ConversaChat';

export interface ComunicacaoPanelProps {
  filtroCanal: FiltroCanal;
  setFiltroCanal: (v: FiltroCanal) => void;
  busca: string;
  setBusca: (v: string) => void;
  threads: ThreadAgenda[];
  isResponsavel: boolean;
  abrirComposer: (tipo: 'mural' | 'privado' | 'familia') => void;
  carregando: boolean;
  threadIdAtiva: string | null;
  abrirThread: (t: ThreadAgenda) => void;
  nomeTurma: (id?: string | null) => string;
  threadAtiva: ThreadAgenda | null;
  respostaTexto: string;
  setRespostaTexto: (v: string) => void;
  respondendo: boolean;
  handleResponderMensagem: () => void;
  onVoltar: () => void;
  isMobile: boolean;
}

export function ComunicacaoPanel({
  filtroCanal,
  setFiltroCanal,
  busca,
  setBusca,
  threads,
  isResponsavel,
  abrirComposer,
  carregando,
  threadIdAtiva,
  abrirThread,
  nomeTurma,
  threadAtiva,
  respostaTexto,
  setRespostaTexto,
  respondendo,
  handleResponderMensagem,
  onVoltar,
  isMobile,
}: ComunicacaoPanelProps) {
  return (
    <div className="relative">
      {/* Desktop: lado a lado */}
      <div className="hidden lg:flex border border-salvia-200 dark:border-salvia-800 rounded-2xl overflow-hidden h-[calc(100vh-12rem)] min-h-[28rem] bg-white dark:bg-salvia-900">
        <div className="w-[22rem] shrink-0 border-r border-salvia-200 dark:border-salvia-800">
          <ConversasLista
            threads={threads}
            threadIdAtiva={threadIdAtiva}
            filtroCanal={filtroCanal}
            setFiltroCanal={setFiltroCanal}
            busca={busca}
            setBusca={setBusca}
            isResponsavel={isResponsavel}
            abrirComposer={abrirComposer}
            carregando={carregando}
            abrirThread={abrirThread}
            nomeTurma={nomeTurma}
          />
        </div>

        <div className="flex-1 min-w-0">
          {threadAtiva ? (
            <ConversaChat
              thread={threadAtiva}
              respostaTexto={respostaTexto}
              setRespostaTexto={setRespostaTexto}
              respondendo={respondendo}
              onEnviar={handleResponderMensagem}
              onVoltar={onVoltar}
              nomeTurma={nomeTurma}
              isMobile={isMobile}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-salvia-800 flex items-center justify-center mb-1">
                <svg
                  className="w-8 h-8 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
                  />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Selecione uma conversa</p>
              <p className="text-xs text-slate-500 max-w-[16rem]">
                Toque num item à esquerda para ler e responder as mensagens.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: uma tela por vez */}
      <div className="lg:hidden">
        {!threadAtiva ? (
          <div className="relative min-h-[calc(100vh-12rem)]">
            <ConversasLista
              threads={threads}
              threadIdAtiva={threadIdAtiva}
              filtroCanal={filtroCanal}
              setFiltroCanal={setFiltroCanal}
              busca={busca}
              setBusca={setBusca}
              isResponsavel={isResponsavel}
              abrirComposer={abrirComposer}
              carregando={carregando}
              abrirThread={abrirThread}
              nomeTurma={nomeTurma}
            />
            <button
              type="button"
              onClick={() => abrirComposer(isResponsavel ? 'familia' : 'mural')}
              aria-label="Nova mensagem"
              className="fixed bottom-[calc(48px+env(safe-area-inset-bottom)+0.75rem)] right-4 z-40 w-14 h-14 min-h-[56px] min-w-[56px] rounded-full bg-salvia-700 text-white shadow-lg inline-flex items-center justify-center hover:bg-salvia-800 focus:outline-none focus:ring-2 focus:ring-salvia-400"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <div className="fixed inset-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] z-[60] flex flex-col bg-white dark:bg-salvia-900 lg:static lg:z-auto lg:block">
            {/* Dentro de uma conversa o chat cobre a tela inteira, inclusive a barra inferior (como no WhatsApp). */}
            <div className="flex-1 min-h-0">
              <ConversaChat
                thread={threadAtiva}
                respostaTexto={respostaTexto}
                setRespostaTexto={setRespostaTexto}
                respondendo={respondendo}
                onEnviar={handleResponderMensagem}
                onVoltar={onVoltar}
                nomeTurma={nomeTurma}
                isMobile={isMobile}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
