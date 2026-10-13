import React from 'react';
import { Calendar, MessageSquare, Clock, Send } from 'lucide-react';
import type { DiarioInfantilDia } from '@/lib/types/academico';
import { DiarioInfantilResumo } from '../academico/DiarioInfantilResumo';
import type { ThreadPortal } from './types';
import { tituloTemaPortal } from './utils';

export interface RotinaTabProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedAlunoId: string;
  selectedAlunoNome: string;
  diarioInfantil: DiarioInfantilDia | null;
  threadsPortal: ThreadPortal[];
  avisoMsg: string | null;
  threadIdAtiva: string | null;
  setThreadIdAtiva: (id: string | null) => void;
  setRespostaTexto: (texto: string) => void;
  setAvisoMsg: (msg: string | null) => void;
  formatarQuando: (iso: string) => string;
  threadPortalAtiva: ThreadPortal | null;
  respostaTexto: string;
  enviandoResposta: boolean;
  handleResponderThread: () => Promise<void>;
}

export function RotinaTab({
  selectedDate,
  setSelectedDate,
  selectedAlunoId,
  selectedAlunoNome,
  diarioInfantil,
  threadsPortal,
  avisoMsg,
  threadIdAtiva,
  setThreadIdAtiva,
  setRespostaTexto,
  setAvisoMsg,
  formatarQuando,
  threadPortalAtiva,
  respostaTexto,
  enviandoResposta,
  handleResponderThread,
}: RotinaTabProps) {
  return (
    <div className="space-y-6">
      {/* Date Picker */}
      <div className="flex justify-between items-center bg-salvia-50/60 dark:bg-salvia-950/50 p-3 rounded-xl border border-salvia-200 dark:border-salvia-800">
        <span className="text-xs font-bold text-salvia-800 dark:text-salvia-200">Data de Consulta do Diário:</span>
        <div className="bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-1 flex items-center space-x-2 shadow-sm">
          <Calendar className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-900 dark:text-salvia-50 focus:outline-none font-mono"
          />
        </div>
      </div>

      {selectedAlunoId ? (
        <DiarioInfantilResumo
          alunoNome={selectedAlunoNome}
          turmaNome={diarioInfantil?.turma?.nome}
          data={selectedDate}
          dia={diarioInfantil}
        />
      ) : (
        <p className="text-xs text-salvia-600 dark:text-salvia-400">
          Nenhum aluno vinculado a este acesso para consultar o diário.
        </p>
      )}

      {/* Mensagens & Recados — temas + thread */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-salvia-800 dark:text-salvia-200 uppercase tracking-wider flex items-center space-x-1.5">
            <MessageSquare className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
            <span>Recados da Coordenação & Professores</span>
          </h3>
          <span className="text-[10px] font-mono text-salvia-500 font-semibold">
            {threadsPortal.length} tema{threadsPortal.length === 1 ? '' : 's'}
          </span>
        </div>

        {avisoMsg && (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{avisoMsg}</p>
        )}

        {threadsPortal.length === 0 ? (
          <p className="text-xs text-salvia-600 dark:text-salvia-400 py-2">
            Nenhum recado para os filhos vinculados neste momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] border border-salvia-200 dark:border-salvia-800 rounded-2xl overflow-hidden bg-white dark:bg-salvia-900 min-h-[16rem]">
            <ul className="divide-y divide-salvia-100 dark:divide-salvia-800 border-b lg:border-b-0 lg:border-r border-salvia-200 dark:border-salvia-800 max-h-[22rem] overflow-y-auto">
              {threadsPortal.map((t) => {
                const ativa = threadIdAtiva === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setThreadIdAtiva(t.id);
                        setRespostaTexto('');
                        setAvisoMsg(null);
                      }}
                      className={`w-full text-left px-3 py-3 space-y-1 transition-colors ${
                        ativa
                          ? 'bg-salvia-50 dark:bg-salvia-950/50 border-l-2 border-l-salvia-600'
                          : 'hover:bg-salvia-50/60 dark:hover:bg-salvia-950/30 border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50 truncate">
                          {tituloTemaPortal(t.raiz.titulo)}
                        </h4>
                        <span className="text-[10px] text-salvia-500 whitespace-nowrap">
                          {formatarQuando(t.ultima.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-salvia-600 dark:text-salvia-400 line-clamp-1">
                        {t.respostas > 0
                          ? `${t.respostas} resp. · ${t.ultima.remetente_nome || 'Escola'}: ${t.ultima.conteudo}`
                          : t.raiz.conteudo}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col min-h-[14rem] max-h-[22rem] bg-salvia-50/30 dark:bg-[#0c120e]/30">
              {threadPortalAtiva ? (
                <>
                  <div className="px-3 py-2.5 border-b border-salvia-100 dark:border-salvia-800 bg-white dark:bg-salvia-900 shrink-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
                      {tituloTemaPortal(threadPortalAtiva.raiz.titulo)}
                    </h4>
                    <p className="text-[10px] text-salvia-500">
                      {threadPortalAtiva.respostas} resposta
                      {threadPortalAtiva.respostas === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                    {threadPortalAtiva.mensagens.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-xl px-3 py-2.5 space-y-1 border ${
                          m.id === threadPortalAtiva.raiz.id
                            ? 'bg-white dark:bg-salvia-900 border-salvia-200 dark:border-salvia-700'
                            : 'bg-white/70 dark:bg-salvia-900/60 border-salvia-100 dark:border-salvia-800 ml-2'
                        }`}
                      >
                        <div className="flex justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-salvia-100">
                            {m.remetente_nome || 'Escola'}
                            {m.remetente_role ? (
                              <span className="font-medium text-salvia-500"> · {m.remetente_role}</span>
                            ) : null}
                          </span>
                          <span className="text-[10px] text-salvia-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatarQuando(m.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-salvia-200 leading-relaxed whitespace-pre-wrap">
                          {m.conteudo}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="px-3 py-2.5 border-t border-salvia-100 dark:border-salvia-800 bg-white dark:bg-salvia-900 space-y-2 shrink-0">
                    <textarea
                      value={respostaTexto}
                      onChange={(e) => setRespostaTexto(e.target.value)}
                      rows={2}
                      placeholder="Responder nesta conversa…"
                      className="w-full bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-salvia-50 focus:outline-none focus:border-salvia-600"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={enviandoResposta || !respostaTexto.trim()}
                        onClick={handleResponderThread}
                        className="inline-flex items-center gap-1.5 bg-salvia-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold hover:bg-salvia-800 disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" />
                        {enviandoResposta ? 'Enviando…' : 'Enviar resposta'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6 text-center">
                  <p className="text-xs text-salvia-600">Selecione um tema à esquerda.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
