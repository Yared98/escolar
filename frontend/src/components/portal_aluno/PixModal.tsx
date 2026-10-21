import React, { useState } from 'react';
import { QrCode, X, Check, Copy, Landmark, AlertTriangle, Barcode } from 'lucide-react';
import { QrCodePix } from '../QrCodePix';
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
  const [copiouLinha, setCopiouLinha] = useState(false);
  const [copiouCodigoBarras, setCopiouCodigoBarras] = useState(false);

  const isItau =
    pixModalFatura.gateway_name === 'itau' &&
    Boolean(pixModalFatura.gateway_digitable_line || pixModalFatura.linha_digitavel);

  const linhaDigitavel = pixModalFatura.gateway_digitable_line || pixModalFatura.linha_digitavel || '';
  const pixCode = pixModalFatura.gateway_pix_code || pixModalFatura.qr_code_pix || '';
  const codigoBarras = pixModalFatura.codigo_barras || '';

  const handleCopiarLinha = () => {
    if (!linhaDigitavel) return;
    navigator.clipboard.writeText(linhaDigitavel);
    setCopiouLinha(true);
    setTimeout(() => setCopiouLinha(false), 2000);
  };

  const handleCopiarCodigoBarras = () => {
    if (!codigoBarras) return;
    navigator.clipboard.writeText(codigoBarras);
    setCopiouCodigoBarras(true);
    setTimeout(() => setCopiouCodigoBarras(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-salvia-100 dark:bg-salvia-800 rounded-xl text-salvia-700 dark:text-salvia-300">
              {isItau ? <Landmark className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">
                  {isItau ? '2ª Via • Bolecode Itaú' : '2ª Via de Pagamento Pix'}
                </h3>
                {isItau && pixModalFatura.simulado && (
                  <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                    Simulado
                  </span>
                )}
              </div>
              <span className="text-[10px] text-salvia-500 font-medium">
                {isItau ? 'Bolecode com Pix integrado' : 'Conferido pela tesouraria'}
              </span>
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

        {/* QR Code */}
        {pixCode && (
          <div className="bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-6 text-center space-y-2">
            <div className="bg-white p-3 rounded-xl border border-salvia-200 shadow-sm inline-block">
              <QrCodePix emv={pixCode} tamanho={160} className="mx-auto" />
            </div>
            <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
              Aponte a câmera do aplicativo do seu banco para o QR Code acima para pagar via Pix.
            </p>
          </div>
        )}

        {/* Nota informativa */}
        {isItau ? (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              Depois do vencimento, pague pelo código de barras.
            </p>
          </div>
        ) : (
          <div className="p-2.5 bg-salvia-100/60 dark:bg-salvia-950/70 border border-salvia-200 dark:border-salvia-800 rounded-xl text-[11px] text-salvia-700 dark:text-salvia-300">
            <p className="leading-snug">
              Pix para pagar a 2ª via. A confirmação do pagamento é feita pela tesouraria da escola (a confirmação automática pelo banco ainda não está ligada).
            </p>
          </div>
        )}

        {/* Linha Digitável (Apenas quando for Bolecode Itaú) */}
        {isItau && linhaDigitavel && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-salvia-600 dark:text-salvia-400 block">
              Linha Digitável
            </label>
            <div className="flex items-center space-x-2">
              <input
                readOnly
                value={linhaDigitavel}
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-700 dark:text-salvia-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopiarLinha}
                className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 transition-all shadow-sm"
              >
                {copiouLinha ? (
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
        )}

        {/* Código Copia e Cola */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-salvia-600 dark:text-salvia-400 block">
            Pix Copia e Cola
          </label>
          <div className="flex items-center space-x-2">
            <input
              readOnly
              value={pixCode || 'Código Pix ainda não foi gerado para esta fatura.'}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-700 dark:text-salvia-300 focus:outline-none"
            />
            <button
              disabled={!pixCode}
              onClick={() => {
                if (pixCode) handleCopyPix(pixCode);
              }}
              className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 transition-all shadow-sm disabled:opacity-50"
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

        {/* Código de barras se houver */}
        {isItau && codigoBarras && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-salvia-600 dark:text-salvia-400 flex items-center gap-1">
              <Barcode className="w-3 h-3" />
              <span>Código de barras</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                readOnly
                value={codigoBarras}
                className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-700 dark:text-salvia-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopiarCodigoBarras}
                className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 transition-all shadow-sm"
              >
                {copiouCodigoBarras ? (
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
        )}

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
