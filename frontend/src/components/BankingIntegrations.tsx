'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BankIntegration {
  gateway_name: string;
  client_id: string;
  has_client_secret?: boolean;
  has_webhook_secret?: boolean;
  is_active: boolean;
  modo_gateway?: string;
  modo_label?: string;
  has_server_credentials?: boolean;
}

export function BankingIntegrations() {
  const [integrations, setIntegrations] = useState<BankIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<BankIntegration[]>('/tenant/integrations/banking')
      .then((data) => {
        setIntegrations(data || []);
      })
      .catch((err: unknown) => {
        setMsg(err instanceof Error ? err.message : 'Não foi possível carregar integrações.');
        setIntegrations([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const coraIntegration = integrations.find((i) => i.gateway_name === 'cora');
  const modoLabel = coraIntegration?.modo_label || 'Simulado';
  const modoGateway = coraIntegration?.modo_gateway || 'mock';
  const hasServerCredentials = !!coraIntegration?.has_server_credentials;

  if (loading) {
    return <p className="text-sm text-slate-500 p-4">Carregando configurações bancárias...</p>;
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50 dark:bg-salvia-950/40 p-3 text-xs text-salvia-800 dark:text-salvia-200">
          {msg}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141d17] p-4 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="p-2 bg-salvia-100 dark:bg-salvia-900 rounded-lg">
            <Shield className="w-5 h-5 text-salvia-700 dark:text-salvia-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cora Bank</h3>
            <p className="text-[11px] text-slate-500">
              Conexão usada para emitir boletos e QR Code Pix oficiais.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c120e] border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
              Modo de operação
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {modoLabel}
              </span>
              {modoGateway === 'mock' ? (
                <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                  Demonstração
                </span>
              ) : modoGateway === 'sandbox' ? (
                <span className="inline-flex items-center rounded-md bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-200">
                  Teste
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                  Ativo
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c120e] border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
              Credenciais no servidor
            </span>
            <div className="mt-1 flex items-center gap-2">
              {hasServerCredentials ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Presentes
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Faltando
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {modoGateway === 'mock' ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px] text-amber-900 dark:text-amber-200">
            O sistema está em modo de demonstração. O QR Code Pix e o boleto gerados nas faturas
            são locais e não se comunicam com o banco.
          </div>
        ) : !hasServerCredentials ? (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3 text-[11px] text-rose-900 dark:text-rose-200">
            As credenciais da Cora ainda não foram configuradas no servidor. Solicite as chaves em
            Conta &gt; Integrações via APIs no app da Cora, coloque os arquivos em{' '}
            <code>./segredos</code> e ligue <code>CORA_MODE=sandbox</code>.
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-[11px] text-emerald-900 dark:text-emerald-200">
            A conexão com a Cora está configurada. Faturas emitidas pelo botão correspondente serão
            registradas no banco.
          </div>
        )}

        {coraIntegration?.has_webhook_secret === false && modoGateway !== 'mock' && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px] text-amber-900 dark:text-amber-200">
            Configure um token secreto para que os avisos de pagamento da Cora sejam aceitos com
            segurança.
          </div>
        )}
      </div>
    </div>
  );
}
