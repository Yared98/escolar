import React, { useState } from 'react';
import { X, Check, Copy, Landmark, AlertTriangle, Barcode } from 'lucide-react';
import { QrCodePix } from '../QrCodePix';
import { Fatura } from './types';

export interface BoletoItauModalProps {
  fatura: Fatura;
  onClose: () => void;
  modo?: string;
}

export function BoletoItauModal({ fatura, onClose, modo }: BoletoItauModalProps) {
  const [copiouLinha, setCopiouLinha] = useState(false);
  const [copiouPix, setCopiouPix] = useState(false);
  const [copiouCodigoBarras, setCopiouCodigoBarras] = useState(false);

  const isSimulado = fatura.simulado || modo === 'mock';
  const linhaDigitavel = fatura.gateway_digitable_line || fatura.linha_digitavel || '';
  const pixCode = fatura.gateway_pix_code || fatura.qr_code_pix || '';
  const codigoBarras = fatura.codigo_barras || '';

  const handleCopiarLinha = () => {
    if (!linhaDigitavel) return;
    navigator.clipboard.writeText(linhaDigitavel);
    setCopiouLinha(true);
    setTimeout(() => setCopiouLinha(false), 2000);
  };

  const handleCopiarPix = () => {
    if (!pixCode) return;
    navigator.clipboard.writeText(pixCode);
    setCopiouPix(true);
    setTimeout(() => setCopiouPix(false), 2000);
  };

  const handleCopiarCodigoBarras = () => {
    if (!codigoBarras) return;
    navigator.clipboard.writeText(codigoBarras);
    setCopiouCodigoBarras(true);
    setTimeout(() => setCopiouCodigoBarras(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-salvia-900 border border-salvia-300 dark:border-salvia-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-salvia-100 dark:border-salvia-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-salvia-100 dark:bg-salvia-800 rounded-xl text-salvia-700 dark:text-salvia-300">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-salvia-50">Bolecode Itaú</h3>
                {isSimulado && (
                  <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                    Simulado
                  </span>
                )}
              </div>
              <span className="text-[10px] text-salvia-500 font-medium">
                Boleto com QR Code Pix integrado (Bolecode)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-salvia-100 dark:hover:bg-salvia-800 text-salvia-600 dark:text-salvia-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informações da Fatura */}
        <div className="space-y-1">
          <span className="text-xs text-salvia-600 dark:text-salvia-400 font-medium">{fatura.descricao}</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-salvia-50">
            R$ {fatura.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-salvia-500 font-mono block">
            Vencimento: {fatura.data_vencimento}
          </span>
        </div>

        {/* QR Code Pix */}
        {pixCode && (
          <div className="bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-2xl p-4 text-center space-y-2">
            <div className="bg-white p-3 rounded-xl border border-salvia-200 shadow-sm inline-block">
              <QrCodePix emv={pixCode} tamanho={160} className="mx-auto" />
            </div>
            <p className="text-[11px] text-salvia-600 dark:text-salvia-400">
              Aponte a câmera do aplicativo do seu banco para o QR Code acima para pagar via Pix.
            </p>
          </div>
        )}

        {/* Aviso Obrigatório */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong>Atenção:</strong> Depois do vencimento, pague pelo código de barras.
          </p>
        </div>

        {/* Linha Digitável */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-salvia-600 dark:text-salvia-400 block">
            Linha digitável do boleto
          </label>
          <div className="flex items-center space-x-2">
            <input
              readOnly
              value={linhaDigitavel || 'Linha digitável não informada'}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-700 dark:text-salvia-300 focus:outline-none"
            />
            <button
              disabled={!linhaDigitavel}
              onClick={handleCopiarLinha}
              className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 transition-all shadow-sm disabled:opacity-50"
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

        {/* Pix Copia e Cola */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-salvia-600 dark:text-salvia-400 block">
            Pix Copia e Cola
          </label>
          <div className="flex items-center space-x-2">
            <input
              readOnly
              value={pixCode || 'Código Pix não informado'}
              className="w-full bg-salvia-50 dark:bg-salvia-950 border border-salvia-200 dark:border-salvia-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-700 dark:text-salvia-300 focus:outline-none"
            />
            <button
              disabled={!pixCode}
              onClick={handleCopiarPix}
              className="bg-salvia-700 hover:bg-salvia-800 text-white dark:bg-salvia-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0 transition-all shadow-sm disabled:opacity-50"
            >
              {copiouPix ? (
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

        {/* Código de barras (se houver) */}
        {codigoBarras && (
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
            onClick={onClose}
            className="w-full bg-salvia-100 hover:bg-salvia-200 dark:bg-salvia-800 dark:hover:bg-salvia-700 text-salvia-800 dark:text-salvia-200 py-2.5 rounded-xl font-bold text-xs transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
