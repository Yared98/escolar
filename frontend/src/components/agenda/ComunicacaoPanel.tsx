import React from 'react';
import { Inbox, Lock, MessageCircle, Plus, Search, Send, Users } from 'lucide-react';
import { FiltroCanal, ThreadAgenda } from './types';
import { estiloCanal, formatarQuando, rotuloCanal, tituloTema } from './utils';

export interface ComunicacaoPanelProps {
  filtroCanal: FiltroCanal;
  setFiltroCanal: (v: FiltroCanal) => void;
  busca: string;
  setBusca: (v: string) => void;
  campo: string;
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
}

export function ComunicacaoPanel({
  filtroCanal,
  setFiltroCanal,
  busca,
  setBusca,
  campo,
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
}: ComunicacaoPanelProps) {
  return (
    <div className="space-y-4">
      {/* Filtros e busca */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full max-w-lg overflow-x-auto">
          {([
            ['todos', 'Todos'],
            ['mural', 'Mural'],
            ['privado', 'Privadas'],
            ['coordenacao', 'Coordenação'],
          ] as const).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltroCanal(id)}
              className={`flex-1 min-w-[4.5rem] py-1.5 px-2 text-xs font-bold rounded-lg whitespace-nowrap ${
                filtroCanal === id ? 'bg-salvia-700 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <label className="relative block w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar temas ou mensagens…"
            className={`${campo} pl-8`}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] gap-0 xl:gap-0 items-stretch border border-salvia-200 dark:border-salvia-800 rounded-2xl overflow-hidden bg-white dark:bg-salvia-900 min-h-[28rem]">
        {/* Lista de temas */}
        <div className="border-b xl:border-b-0 xl:border-r border-salvia-200 dark:border-salvia-800 flex flex-col min-h-[14rem] max-h-[36rem]">
          <div className="px-4 py-3 border-b border-salvia-100 dark:border-salvia-800 flex justify-between items-center shrink-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Temas ({threads.length})
            </p>
            <div className="flex gap-2">
              {isResponsavel ? (
                <button
                  type="button"
                  onClick={() => abrirComposer('familia')}
                  className="text-[11px] font-bold text-salvia-800 dark:text-salvia-200 inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Nova
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => abrirComposer('mural')}
                    className="text-[11px] font-bold text-salvia-800 dark:text-salvia-200 inline-flex items-center gap-1"
                  >
                    <Users className="w-3 h-3" /> Mural
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirComposer('privado')}
                    className="text-[11px] font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" /> Privada
                  </button>
                </>
              )}
            </div>
          </div>

          {carregando ? (
            <p className="p-6 text-xs text-slate-500">Carregando conversas…</p>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center space-y-2 flex-1 flex flex-col justify-center">
              <Inbox className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nada por aqui</p>
              <p className="text-xs text-slate-500">
                {busca || filtroCanal !== 'todos'
                  ? 'Nenhum tema com esses filtros.'
                  : 'Publique o primeiro mural ou mensagem privada.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-salvia-100 dark:divide-salvia-800 overflow-y-auto flex-1">
              {threads.map((t) => {
                const ativa = threadIdAtiva === t.id;
                const preview =
                  t.respostas > 0 ? t.ultima.conteudo : t.raiz.conteudo;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => abrirThread(t)}
                      className={`w-full text-left px-4 py-3 space-y-1.5 transition-colors ${
                        ativa
                          ? 'bg-salvia-50 dark:bg-salvia-950/50 border-l-2 border-l-salvia-600'
                          : 'hover:bg-slate-50 dark:hover:bg-salvia-950/30 border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estiloCanal(t.raiz.canal)}`}>
                              {rotuloCanal(t.raiz.canal)}
                            </span>
                            {t.respostas > 0 && (
                              <span className="text-[10px] font-bold text-slate-500">
                                {t.respostas} resp.
                              </span>
                            )}
                            {t.temNaoLida && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                Nova
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {tituloTema(t.raiz.titulo)}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                            {t.ultima.remetente_nome ? `${t.ultima.remetente_nome}: ` : ''}
                            {preview}
                          </p>
                          {t.raiz.turma_id && (
                            <p className="text-[10px] text-slate-500">{nomeTurma(t.raiz.turma_id)}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap font-medium">
                          {formatarQuando(t.ultima.created_at)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Painel da thread */}
        <aside className="flex flex-col min-h-[18rem] max-h-[36rem] bg-slate-50/40 dark:bg-[#0c120e]/40">
          {threadAtiva ? (
            <>
              <div className="px-4 py-3 border-b border-salvia-100 dark:border-salvia-800 bg-white dark:bg-salvia-900 shrink-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estiloCanal(threadAtiva.raiz.canal)}`}>
                    {rotuloCanal(threadAtiva.raiz.canal)}
                  </span>
                  {threadAtiva.raiz.turma_id && (
                    <span className="text-[10px] text-slate-500">{nomeTurma(threadAtiva.raiz.turma_id)}</span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {threadAtiva.respostas} resposta{threadAtiva.respostas === 1 ? '' : 's'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {tituloTema(threadAtiva.raiz.titulo)}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {threadAtiva.mensagens.map((m, idx) => {
                  const isRoot = idx === 0 || m.id === threadAtiva.raiz.id;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl px-3.5 py-3 space-y-1.5 ${
                        isRoot && m.id === threadAtiva.raiz.id
                          ? 'bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 shadow-sm'
                          : 'bg-white/80 dark:bg-salvia-900/70 border border-salvia-100 dark:border-salvia-800 ml-3'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-salvia-50 truncate">
                            {m.remetente_nome || 'Usuário'}
                            {m.remetente_role ? (
                              <span className="font-medium text-slate-500"> · {m.remetente_role}</span>
                            ) : null}
                          </p>
                          {m.id === threadAtiva.raiz.id && (
                            <span className="text-[10px] font-bold text-salvia-700 dark:text-salvia-300">
                              Mensagem inicial
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {formatarQuando(m.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {m.conteudo}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 py-3 border-t border-salvia-100 dark:border-salvia-800 bg-white dark:bg-salvia-900 shrink-0 space-y-2">
                <textarea
                  value={respostaTexto}
                  onChange={(e) => setRespostaTexto(e.target.value)}
                  rows={2}
                  placeholder="Responder nesta conversa…"
                  className={campo}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={respondendo || !respostaTexto.trim()}
                    onClick={handleResponderMensagem}
                    className="inline-flex items-center gap-1.5 bg-salvia-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-salvia-800 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {respondendo ? 'Enviando…' : 'Enviar na thread'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-16 px-6">
              <MessageCircle className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Selecione um tema</p>
              <p className="text-xs text-slate-500 max-w-[16rem]">
                À direita aparece a conversa completa — mensagem inicial e respostas, como no Slack.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
