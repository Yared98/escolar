import React from 'react';
import { Inbox, Send } from 'lucide-react';
import { AtendimentoProtocolo } from './types';
import { formatarQuando } from './utils';

export interface WhatsappPanelProps {
  filtroZap: 'abertos' | 'todos';
  setFiltroZap: (v: 'abertos' | 'todos') => void;
  protocolosFiltrados: AtendimentoProtocolo[];
  respostaZap: Record<string, string>;
  setRespostaZap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleResponderProtocolo: (id: string) => void;
  campo: string;
}

export function WhatsappPanel({
  filtroZap,
  setFiltroZap,
  protocolosFiltrados,
  respostaZap,
  setRespostaZap,
  handleResponderProtocolo,
  campo,
}: WhatsappPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full max-w-xs">
        <button
          type="button"
          onClick={() => setFiltroZap('abertos')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${filtroZap === 'abertos' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
        >
          Em aberto
        </button>
        <button
          type="button"
          onClick={() => setFiltroZap('todos')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${filtroZap === 'todos' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
        >
          Todos
        </button>
      </div>

      {protocolosFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-8 text-center space-y-2">
          <Inbox className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Fila vazia</p>
          <p className="text-xs text-slate-500">Nenhum protocolo aguardando resposta humana.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {protocolosFiltrados.map((p) => (
            <article
              key={p.id}
              className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 space-y-3"
            >
              <div className="flex flex-wrap justify-between gap-2 items-start">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{p.protocolo}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        p.status === 'finalizado'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {p.telefone_contato} · {p.setor_transbordo || 'Geral'} · {formatarQuando(p.created_at)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-[#0c120e] border border-slate-100 dark:border-slate-800 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Última mensagem</p>
                <p className="text-xs text-slate-800 dark:text-slate-200">{p.ultima_mensagem || p.assunto}</p>
              </div>

              {p.status === 'finalizado' ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Resposta enviada</p>
                  <p className="text-xs text-emerald-950 dark:text-emerald-100">{p.resposta_enviada}</p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={respostaZap[p.id] || ''}
                    onChange={(e) => setRespostaZap((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="Resposta ao responsável via WhatsApp…"
                    className={`${campo} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => handleResponderProtocolo(p.id)}
                    disabled={!respostaZap[p.id]?.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Responder
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
// Sabotagem
