'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface BankIntegration {
  gateway_name: string;
  client_id: string;
  has_client_secret?: boolean;
  has_webhook_secret?: boolean;
  is_active: boolean;
  modo_gateway?: string;
}

export function BankingIntegrations() {
  const [integrations, setIntegrations] = useState<BankIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [coraClientId, setCoraClientId] = useState('');
  const [coraClientSecret, setCoraClientSecret] = useState('');
  const [isCoraActive, setIsCoraActive] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<BankIntegration[]>('/tenant/integrations/banking')
      .then((data) => {
        setIntegrations(data || []);
        const cora = (data || []).find((d) => d.gateway_name === 'cora');
        if (cora) {
          setCoraClientId(cora.client_id || '');
          setIsCoraActive(!!cora.is_active);
        }
      })
      .catch((err: unknown) => {
        setMsg(err instanceof Error ? err.message : 'Não foi possível carregar integrações.');
        setIntegrations([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const coraIntegration = integrations.find((i) => i.gateway_name === 'cora');
  const modoGateway = coraIntegration?.modo_gateway || 'mock';

  const handleSave = async () => {
    setMsg(null);
    try {
      await apiFetch('/tenant/integrations/banking', {
        method: 'PUT',
        body: JSON.stringify({
          gateway_name: 'cora',
          client_id: coraClientId,
          client_secret: coraClientSecret || undefined,
          is_active: isCoraActive,
        }),
      });
      setCoraClientSecret('');
      setMsg('Integração salva. A emissão de faturas via Cora ainda depende de credenciais reais e client ativo — hoje o webhook baixa por gateway_invoice_id quando o PSP notifica.');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Falha ao salvar integração.');
    }
  };

  if (loading) {
    return <p className="text-xs text-slate-500 p-4">Carregando configurações bancárias...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px] text-amber-900 dark:text-amber-200">
        Configuração de gateway (Cora). Pix/boleto gerados pelo sistema são locais/demonstrativos até a emissão pelo PSP estar ligada ao fluxo de faturas.
      </div>

      {msg && (
        <div className="rounded-xl border border-salvia-200 dark:border-salvia-800 bg-salvia-50 dark:bg-salvia-950/40 p-3 text-xs text-salvia-800 dark:text-salvia-200">
          {msg}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141d17] p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cora Bank</h3>
              {modoGateway === 'mock' ? (
                <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                  Simulado
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:text-rose-200">
                  Modo não suportado ainda
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              {coraIntegration?.has_client_secret
                ? 'Client secret cadastrado'
                : 'Sem client secret'}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isCoraActive}
              onChange={() => setIsCoraActive(!isCoraActive)}
              className="rounded border-slate-300 text-salvia-700"
            />
            Ativo
          </label>
        </div>

        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          Client ID
          <input
            value={coraClientId}
            onChange={(e) => setCoraClientId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c120e] px-3 py-2 text-xs"
          />
        </label>
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          Client Secret {coraIntegration?.has_client_secret ? '(deixe em branco para manter)' : ''}
          <input
            type="password"
            value={coraClientSecret}
            onChange={(e) => setCoraClientSecret(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c120e] px-3 py-2 text-xs"
            placeholder="••••••••"
          />
        </label>

        <button
          type="button"
          onClick={() => void handleSave()}
          className="rounded-xl bg-salvia-700 px-4 py-2 text-xs font-bold text-white hover:bg-salvia-800"
        >
          Salvar integração
        </button>
      </div>
    </div>
  );
}
