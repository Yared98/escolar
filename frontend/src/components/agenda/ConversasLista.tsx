import React from 'react';
import { Inbox, Megaphone, Plus, Search } from 'lucide-react';
import { FiltroCanal, ThreadAgenda } from './types';
import { estiloCanal, formatarHorarioCurto, iniciaisNome, rotuloCanal, tituloTema } from './utils';

export interface ConversasListaProps {
  threads: ThreadAgenda[];
  threadIdAtiva: string | null;
  filtroCanal: FiltroCanal;
  setFiltroCanal: (v: FiltroCanal) => void;
  busca: string;
  setBusca: (v: string) => void;
  isResponsavel: boolean;
  abrirComposer: (tipo: 'mural' | 'privado' | 'familia') => void;
  carregando: boolean;
  abrirThread: (t: ThreadAgenda) => void;
  nomeTurma: (id?: string | null) => string;
}

const filtros: { id: FiltroCanal; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todas' },
  { id: 'mural', rotulo: 'Mural' },
  { id: 'privado', rotulo: 'Privadas' },
  { id: 'coordenacao', rotulo: 'Coordenação' },
];

export function ConversasLista({
  threads,
  threadIdAtiva,
  filtroCanal,
  setFiltroCanal,
  busca,
  setBusca,
  isResponsavel,
  abrirComposer,
  carregando,
  abrirThread,
  nomeTurma,
}: ConversasListaProps) {
  const contagemNaoLidas = (t: ThreadAgenda) => t.mensagens.filter((m) => !m.lida).length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-salvia-900">
      <div className="px-4 py-3 border-b border-salvia-200 dark:border-salvia-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Conversas</h3>
          <button
            type="button"
            onClick={() => abrirComposer(isResponsavel ? 'familia' : 'mural')}
            className="hidden lg:inline-flex items-center gap-1.5 bg-salvia-700 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-salvia-800 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            {isResponsavel ? 'Nova mensagem' : 'Novo comunicado'}
          </button>
        </div>

        <label className="relative block w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conversas"
            className="w-full bg-slate-100 dark:bg-salvia-800 border-0 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-salvia-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-salvia-500"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {filtros.map(({ id, rotulo }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltroCanal(id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                filtroCanal === id
                  ? 'bg-salvia-700 text-white'
                  : 'bg-slate-100 dark:bg-salvia-800 text-slate-700 dark:text-salvia-200 hover:bg-slate-200 dark:hover:bg-salvia-700'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <p className="p-6 text-sm text-slate-500">Carregando conversas…</p>
      ) : threads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-6 py-12">
          <Inbox className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nada por aqui</p>
          <p className="text-xs text-slate-500 max-w-[16rem]">
            {busca || filtroCanal !== 'todos'
              ? 'Nenhuma conversa com esses filtros.'
              : 'Publique o primeiro mural ou mensagem privada.'}
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-salvia-100 dark:divide-salvia-800">
          {threads.map((t) => {
            const ativa = threadIdAtiva === t.id;
            const preview = t.respostas > 0 ? t.ultima.conteudo : t.raiz.conteudo;
            const remetentePreview = t.respostas > 0 ? t.ultima.remetente_nome : t.raiz.remetente_nome;
            const naoLidas = contagemNaoLidas(t);
            const isMural = t.raiz.canal === 'mural_turma';

            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => abrirThread(t)}
                  className={`w-full text-left px-4 py-3 transition-colors min-h-[64px] flex items-center gap-3 ${
                    ativa
                      ? 'bg-salvia-50 dark:bg-salvia-950/50'
                      : 'hover:bg-slate-50 dark:hover:bg-salvia-950/30'
                  }`}
                >
                  <div
                    className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold ${
                      isMural
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                        : 'bg-salvia-200 text-salvia-900 dark:bg-salvia-700 dark:text-salvia-100'
                    }`}
                    aria-hidden="true"
                  >
                    {isMural ? <Megaphone className="w-5 h-5" /> : iniciaisNome(remetentePreview || t.raiz.remetente_nome)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-salvia-50 truncate">
                        {tituloTema(t.raiz.titulo)}
                      </h4>
                      <span className="shrink-0 text-[11px] text-slate-500 dark:text-salvia-400">
                        {formatarHorarioCurto(t.ultima.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-salvia-300 line-clamp-1">
                      {remetentePreview ? `${remetentePreview}: ` : ''}
                      {preview}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estiloCanal(t.raiz.canal)}`}>
                        {rotuloCanal(t.raiz.canal)}
                      </span>
                      {naoLidas > 0 && (
                        <span className="shrink-0 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                          {naoLidas > 99 ? '99+' : naoLidas}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
