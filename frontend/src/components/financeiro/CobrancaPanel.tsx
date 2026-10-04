import React from 'react';
import { Info, Clock, BellRing, AlertTriangle, Send, CheckCircle2, RefreshCw, Search, Filter, MessageSquare, Mail, Check, Copy } from 'lucide-react';
import { ReguaLog } from './types';

export interface ReguaMensagensProps {
  lembretes_preventivos: number;
  avisos_vencimento_hoje: number;
  cobrancas_ativas: number;
}

export interface ReguaResultProps {
  disparos_executados: number;
  mensagens: ReguaMensagensProps;
}

export interface CobrancaPanelProps {
  handleExecutarRegua: () => Promise<void>;
  loadingRegua: boolean;
  reguaResult: ReguaResultProps | null;
  logsFiltrados: ReguaLog[];
  reguaLogs: ReguaLog[];
  handleRecarregarLogs: () => Promise<void>;
  loadingLogs: boolean;
  logSearchQuery: string;
  setLogSearchQuery: (query: string) => void;
  logCanalFilter: 'todos' | 'whatsapp' | 'email';
  setLogCanalFilter: (canal: 'todos' | 'whatsapp' | 'email') => void;
  logTipoFilter: 'todos' | 'lembrete_preventivo' | 'aviso_vencimento' | 'cobranca_ativa';
  setLogTipoFilter: (tipo: 'todos' | 'lembrete_preventivo' | 'aviso_vencimento' | 'cobranca_ativa') => void;
  handleCopyLogMensagem: (logId: string, texto?: string) => void;
  copiedLogId: string | null;
}

export function CobrancaPanel({
  handleExecutarRegua,
  loadingRegua,
  reguaResult,
  logsFiltrados,
  reguaLogs,
  handleRecarregarLogs,
  loadingLogs,
  logSearchQuery,
  setLogSearchQuery,
  logCanalFilter,
  setLogCanalFilter,
  logTipoFilter,
  setLogTipoFilter,
  handleCopyLogMensagem,
  copiedLogId,
}: CobrancaPanelProps) {
  return (
    <div className="space-y-4">
      {/* Banner de Conformidade e Disclaimer Honesto */}
      <div className="rounded-xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50/70 dark:bg-salvia-950/40 p-4 text-xs text-salvia-800 dark:text-salvia-200 space-y-2">
        <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-salvia-50">
          <Info className="w-4 h-4 text-salvia-600 dark:text-salvia-400" />
          <span>Régua de Cobrança Escolar Automatizada · Modo Simulado (MVP)</span>
        </div>
        <p className="leading-relaxed">
          O motor de régua analisa faturas escolares e processa as regras de régua preventiva (D-5 a D-1), aviso no dia (D-0) e cobrança ativa em atraso (D+ com cálculo automático de multa de 2% e juros pro-rata de 1% a.m.).
        </p>
        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 font-medium">
          <strong>Aviso de integridade (MVP stub):</strong> Os disparos são registrados internamente no banco de dados para rastreabilidade e auditoria (<code className="font-mono">regua_cobranca_logs</code> com status <em>registrado</em>). <strong>Não há envio real de mensagens via WhatsApp ou E-mail</strong> para responsáveis ou alunos neste MVP (sem conector omnicanal externo ativo).
        </div>
      </div>

      {/* Cards dos Estágios da Régua */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
              D-5 a D-1 · Preventivo
            </span>
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Lembrete Preventivo</h4>
          <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
            Dispara notificação cordial com antecedência de até 5 dias contendo o Pix Copia e Cola para pagamento sem acréscimos.
          </p>
        </div>

        <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
              D-0 · Vencimento
            </span>
            <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Vencimento Hoje</h4>
          <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
            Alerta no dia do vencimento da mensalidade escolar para evitar incidência de encargos por esquecimento.
          </p>
        </div>

        <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
              D+ · Cobrança Ativa
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Cobrança em Atraso</h4>
          <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
            Altera o status da fatura para <em>atrasado</em> e calcula automaticamente a multa padrão (2%) e juros pro-rata (1% a.m.).
          </p>
        </div>
      </div>

      {/* Painel de Ação de Execução */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-xl">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-salvia-50">Processar Motor de Régua</h4>
          <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
            Dispara o endpoint POST /financeiro/cobranca/regua para classificar faturas e gravar logs no banco.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExecutarRegua}
          disabled={loadingRegua}
          className="bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 dark:hover:bg-salvia-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-sm transition-all whitespace-nowrap"
        >
          <Send className={`w-4 h-4 ${loadingRegua ? 'animate-pulse' : ''}`} />
          <span>{loadingRegua ? 'Processando régua...' : 'Executar régua agora'}</span>
        </button>
      </div>

      {/* Resumo da Execução Recente */}
      {reguaResult && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-600/40 rounded-xl text-xs space-y-1 animate-fade-in">
          <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Última Execução da Régua (Auditada)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-emerald-900 dark:text-emerald-100 font-mono">
            <div>Total: <strong>{reguaResult.disparos_executados}</strong> eventos</div>
            <div>D-5: <strong>{reguaResult.mensagens.lembretes_preventivos}</strong></div>
            <div>D-0: <strong>{reguaResult.mensagens.avisos_vencimento_hoje}</strong></div>
            <div>D+: <strong>{reguaResult.mensagens.cobrancas_ativas}</strong></div>
          </div>
        </div>
      )}

      {/* Seção de Logs e Filtros */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-salvia-100 dark:border-salvia-800">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-salvia-100 flex items-center space-x-2">
              <span>Auditoria & Logs de Cobrança ({logsFiltrados.length} de {reguaLogs.length})</span>
            </h3>
            <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
              Histórico detalhado das notificações geradas localmente com canal, fatura e payload.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRecarregarLogs}
            disabled={loadingLogs}
            className="self-start md:self-auto inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-salvia-300 dark:border-salvia-700 bg-white dark:bg-salvia-900 text-xs font-semibold text-salvia-700 dark:text-salvia-300 hover:bg-salvia-50 dark:hover:bg-salvia-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            <span>Atualizar logs</span>
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-salvia-400" />
            <input
              type="text"
              placeholder="Filtrar por mensagem ou fatura..."
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50 focus:outline-none focus:ring-1 focus:ring-salvia-500"
            />
          </div>

          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-salvia-500" />
            <select
              value={logCanalFilter}
              onChange={(e) => setLogCanalFilter(e.target.value as any)}
              className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
            >
              <option value="todos">Todos os canais</option>
              <option value="whatsapp">WhatsApp (simulado)</option>
              <option value="email">E-mail (simulado)</option>
            </select>
          </div>

          <div>
            <select
              value={logTipoFilter}
              onChange={(e) => setLogTipoFilter(e.target.value as any)}
              className="w-full py-1.5 px-2.5 text-xs rounded-xl border border-salvia-200 dark:border-salvia-700 bg-white dark:bg-salvia-950 text-slate-900 dark:text-salvia-50"
            >
              <option value="todos">Todos os eventos</option>
              <option value="lembrete_preventivo">Lembrete preventivo (D-5)</option>
              <option value="aviso_vencimento">Aviso de vencimento (D-0)</option>
              <option value="cobranca_ativa">Cobrança ativa (D+)</option>
            </select>
          </div>
        </div>

        {/* Listagem em Tabela */}
        <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-salvia-100 dark:bg-salvia-800 text-[11px] uppercase font-bold text-salvia-900 dark:text-salvia-200">
              <tr>
                <th className="p-3">Data/Hora</th>
                <th className="p-3">Canal</th>
                <th className="p-3">Evento</th>
                <th className="p-3">Status</th>
                <th className="p-3">Fatura</th>
                <th className="p-3">Mensagem / Notificação</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800">
              {logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    {reguaLogs.length === 0
                      ? 'Nenhum log registrado ainda. Clique em "Executar régua agora" para processar faturas pendentes.'
                      : 'Nenhum log correspondente aos filtros selecionados.'}
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => (
                  <tr key={log.id} className="hover:bg-salvia-50/50 dark:hover:bg-salvia-950/40 transition-colors">
                    <td className="p-3 font-mono text-[11px] whitespace-nowrap text-salvia-700 dark:text-salvia-300">
                      {new Date(log.enviado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 font-semibold text-[11px]">
                        {log.canal === 'whatsapp' ? (
                          <>
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>WhatsApp</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>E-mail</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          log.tipo_evento === 'lembrete_preventivo'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : log.tipo_evento === 'aviso_vencimento'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {log.tipo_evento.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-slate-100 dark:bg-salvia-800 text-slate-700 dark:text-salvia-300 border border-slate-200 dark:border-salvia-700">
                        {log.status_envio}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] whitespace-nowrap text-slate-500">
                      {log.fatura_id.slice(0, 8)}…
                    </td>
                    <td className="p-3 text-[11px] text-slate-700 dark:text-slate-300 max-w-md">
                      <div className="line-clamp-2 hover:line-clamp-none transition-all">
                        {log.mensagem_corpo || '—'}
                      </div>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {log.mensagem_corpo && (
                        <button
                          type="button"
                          onClick={() => handleCopyLogMensagem(log.id, log.mensagem_corpo)}
                          className="p-1 text-salvia-600 dark:text-salvia-400 hover:text-salvia-900 dark:hover:text-salvia-100 transition-colors"
                          title="Copiar mensagem"
                        >
                          {copiedLogId === log.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
