import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface QrCodePixProps {
  emv?: string | null;
  tamanho?: number;
  className?: string;
}

export function QrCodePix({ emv, tamanho = 160, className = '' }: QrCodePixProps) {
  if (!emv || !emv.trim()) {
    return null;
  }

  return (
    <QRCodeSVG
      value={emv.trim()}
      size={tamanho}
      level="M"
      bgColor="#ffffff"
      fgColor="#000000"
      marginSize={4}
      aria-label="QR Code Pix"
      role="img"
      className={className}
    />
  );
}
