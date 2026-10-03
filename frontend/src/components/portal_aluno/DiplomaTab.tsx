import React from 'react';
import { QrCode, ExternalLink, Download } from 'lucide-react';
import type { DiplomaData } from './types';

export interface DiplomaTabProps {
  diploma: DiplomaData | null;
}

export function DiplomaTab({
  diploma,
}: DiplomaTabProps) {
  return (
    <div className="space-y-6">
      <div className="p-5 bg-salvia-50/60 dark:bg-salvia-950/50 border border-salvia-200 dark:border-salvia-800 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
              Portaria MEC nº 70/2025 Homologada
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-salvia-50">
              Diploma Digital & Histórico Escolar Oficial
            </h3>
            <p className="text-xs text-salvia-600 dark:text-salvia-400">
              Certificação acadêmica emitida no padrão XML/XAdES com carimbo do tempo ICP-Brasil e inviolabilidade garantida.
            </p>
          </div>

          <div className="p-3 bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-700 rounded-2xl shadow-sm text-center shrink-0">
            <QrCode className="w-16 h-16 text-slate-800 dark:text-salvia-100 mx-auto" />
            <span className="text-[9px] font-mono text-salvia-500 mt-1 block">Validação Oficial MEC</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-salvia-200 dark:border-salvia-800">
          <div className="bg-white dark:bg-salvia-900 p-3 rounded-xl border border-salvia-200 dark:border-salvia-800">
            <span className="text-[10px] text-salvia-500 font-semibold block">Código de Validação MEC:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-salvia-50">
              {diploma?.codigo_validacao || 'Não emitido'}
            </span>
          </div>

          <div className="bg-white dark:bg-salvia-900 p-3 rounded-xl border border-salvia-200 dark:border-salvia-800">
            <span className="text-[10px] text-salvia-500 font-semibold block">Carimbo do Tempo (RFC 3161):</span>
            <span className="font-mono font-bold text-slate-900 dark:text-salvia-50">
              {diploma?.carimbo_tempo ? new Date(diploma.carimbo_tempo).toLocaleString('pt-BR') : 'Não emitido'}
            </span>
          </div>

          <div className="bg-white dark:bg-salvia-900 p-3 rounded-xl border border-salvia-200 dark:border-salvia-800 md:col-span-2">
            <span className="text-[10px] text-salvia-500 font-semibold block">Assinatura Digital XAdES Enveloped:</span>
            <span className="font-mono text-[11px] text-salvia-700 dark:text-salvia-300 break-all">
              {diploma?.hash_xades || 'Não emitido'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {diploma?.qr_code_validacao_url ? (
            <a
              href={diploma.qr_code_validacao_url}
              target="_blank"
              rel="noreferrer"
              className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Verificar Autenticidade no Portal do MEC</span>
            </a>
          ) : (
            <span className="px-4 py-2 rounded-xl text-xs font-bold text-salvia-600 dark:text-salvia-400">
              Validação MEC disponível depois da emissão.
            </span>
          )}

          <button
            disabled={!diploma}
            onClick={() => {
              if (diploma) alert('Download do Diploma Digital (RVDD em PDF assinado) iniciado.');
            }}
            className="bg-white dark:bg-salvia-900 hover:bg-salvia-100 dark:hover:bg-salvia-800 border border-salvia-300 dark:border-salvia-700 text-salvia-800 dark:text-salvia-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Representação Visual (RVDD PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
