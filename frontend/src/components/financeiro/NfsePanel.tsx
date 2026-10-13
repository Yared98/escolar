import React from 'react';
import { NfseItem } from './types';

export interface NfsePanelProps {
  nfseLista: NfseItem[];
}

export function NfsePanel({
  nfseLista,
}: NfsePanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px] text-amber-900 dark:text-amber-200">
        Emissões abaixo são <strong>simuladas</strong> (número/URL inventados). Não há transmissão para a prefeitura nesta versão de demonstração. Use “NFS-e” nas ações da fatura paga/pendente para registrar.
      </div>
      <div className="overflow-x-auto rounded-xl border border-salvia-200 dark:border-salvia-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-salvia-100 dark:bg-salvia-800 text-[11px] uppercase font-bold">
            <tr>
              <th className="p-3">Número</th>
              <th className="p-3">Fatura</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-salvia-100 dark:divide-salvia-800">
            {nfseLista.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-500">
                  Nenhuma NFS-e registrada.
                </td>
              </tr>
            ) : (
              nfseLista.map((n) => (
                <tr key={n.id}>
                  <td className="p-3 font-mono font-bold">{n.numero_nfse || '—'}</td>
                  <td className="p-3 font-mono text-[10px]">{n.fatura_id.slice(0, 8)}…</td>
                  <td className="p-3 font-mono">
                    R$ {n.valor_servico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3">{n.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
