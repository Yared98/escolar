import React from 'react';
import { X, Check, Copy } from 'lucide-react';
import { QrCodePix } from '../QrCodePix';
import { Fatura } from './types';

export interface PixModalProps {
  pixModalFatura: Fatura;
  setPixModalFatura: (fatura: Fatura | null) => void;
  handleCopyPix: () => void;
  copiedPix: boolean;
}

export function PixModal({
  pixModalFatura,
  setPixModalFatura,
  handleCopyPix,
  copiedPix,
}: PixModalProps) {
  const pixCode = pixModalFatura.gateway_pix_code || pixModalFatura.qr_code_pix || '';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-salvia-900 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-salvia-100 dark:border-salvia-800 mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Pagamento Pix Instantâneo</h3>
          <button
            onClick={() => setPixModalFatura(null)}
            className="text-salvia-400 hover:text-salvia-900 dark:hover:text-salvia-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {pixCode && (
          <div className="mb-3 space-y-2">
            <div className="bg-white p-3 rounded-xl border border-salvia-200 shadow-sm inline-block">
              <QrCodePix emv={pixCode} tamanho={160} className="mx-auto" />
            </div>
            <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
              Aponte a câmera do aplicativo do seu banco para o QR Code acima para pagar via Pix.
            </p>
          </div>
        )}

        <p className="text-xs text-slate-900 dark:text-salvia-50 font-bold">{pixModalFatura.descricao}</p>
        <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono my-1">
          R$ {pixModalFatura.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>

        <div className="mt-3 bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 p-2 rounded-xl text-[10px] font-mono text-salvia-700 dark:text-salvia-300 break-all select-all font-semibold max-h-24 overflow-y-auto">
          {pixCode || 'Código Pix não informado'}
        </div>

        <button
          disabled={!pixCode}
          onClick={handleCopyPix}
          className={`mt-4 w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50 ${
            copiedPix
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-salvia-700 dark:bg-salvia-500 hover:bg-salvia-800 text-white'
          }`}
        >
          {copiedPix ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copiado com Sucesso!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copiar Código Pix Copia e Cola</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
