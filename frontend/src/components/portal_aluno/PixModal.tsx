import React from 'react';
import { QrCode, X, Check, Copy } from 'lucide-react';
import type { FaturaData } from './types';

export interface PixModalProps {
  pixModalFatura: FaturaData;
  setPixModalFatura: (fatura: FaturaData | null) => void;
  handleCopyPix: (pixCode: string) => void;
  copiedPix: boolean;
}

export function PixModal({
  pixModalFatura,
  setPixModalFatura,
  handleCopyPix,
  copiedPix,
}: PixModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-salvia-100 dark:bg-salvia-800 rounded-xl text-salvia-700 dark:text-salvia-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">2ª Via de Pagamento Pix</h3>
              <span className="text-[10px] text-salvia-500 font-medium">Conferência local • Padrão EMVCo</span>
            </div>
          </div>
          <button
            onClick={() => setPixModalFatura(null)}
            className="p-1.5 rounded-lg hover:bg-salvia-100 dark:hover:bg-salvia-800 text-salvia-600 dark:text-salvia-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-salvia-600 dark:text-salvia-400 font-medium">{pixModalFatura.descricao}</span>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-salvia-50">
            R$ {pixModalFatura.valor.toFixed(2)}
          </div>
          <span className="text-[10px] text-salvia-500 font-mono">
            Vencimento: {pixModalFatura.data_vencimento}
          </span>
        </div>

        {/* QR Code Graphic Mock */}
        <div className="bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 text-center space-y-2">
          <QrCode className="w-32 h-32 text-slate-900 dark:text-salvia-100 mx-auto" />
          <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
            Abra o aplicativo do seu banco e aponte a câmera para o QR Code acima.
          </p>
        </div>

        {/* Nota de esclarecimento sobre conciliação e geração local */}
        <div className="p-2.5 bg-salvia-100/60 dark:bg-salvia-950/70 border border-salvia-200 dark:border-salvia-800 rounded-xl text-[11px] text-salvia-700 dark:text-salvia-300">
          <p className="leading-snug">
            Chave Pix gerada no padrão EMVCo para 2ª via. A confirmação do pagamento é verificada pela tesouraria escolar (ou via webhook automático quando o PSP bancário estiver ativo).
          </p>
        </div>

        {/* Código Copia e Cola */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-salvia-600 dark:text-salvia-400 block">
            Pix Copia e Cola
          </label>
          <div className="flex items-center space-x-2">
            <input
              readOnly
              value={pixModalFatura.qr_code_pix || 'Código Pix ainda não foi gerado para esta fatura.'}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-700 dark:text-salvia-300 focus:outline-none"
            />
            <button
              disabled={!pixModalFatura.qr_code_pix}
              onClick={() => {
                if (pixModalFatura.qr_code_pix) handleCopyPix(pixModalFatura.qr_code_pix);
              }}
              className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 transition-all shadow-sm"
            >
              {copiedPix ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => setPixModalFatura(null)}
            className="w-full bg-salvia-100 hover:bg-salvia-200 dark:bg-salvia-800 dark:hover:bg-salvia-700 text-salvia-800 dark:text-salvia-200 py-2.5 rounded-xl font-bold text-xs transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
