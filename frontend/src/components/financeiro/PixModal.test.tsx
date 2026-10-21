import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PixModal } from './PixModal';
import { Fatura } from './types';

const mockFaturaComPix: Fatura = {
  id: 'fat-1',
  descricao: 'Mensalidade Abril/2026',
  valor: 980.0,
  data_vencimento: '2026-04-10',
  metodo_pagamento: 'pix',
  status: 'pendente',
  qr_code_pix: '00020126580014br.gov.bcb.pix0136testepix',
};

const mockFaturaSemPix: Fatura = {
  id: 'fat-2',
  descricao: 'Mensalidade Abril/2026',
  valor: 980.0,
  data_vencimento: '2026-04-10',
  metodo_pagamento: 'pix',
  status: 'pendente',
};

describe('financeiro/PixModal', () => {
  it('com EMV: exibe o QR Code SVG com aria-label e o texto da câmera', () => {
    const handleCopyPix = vi.fn();
    const setPixModalFatura = vi.fn();

    render(
      <PixModal
        pixModalFatura={mockFaturaComPix}
        setPixModalFatura={setPixModalFatura}
        handleCopyPix={handleCopyPix}
        copiedPix={false}
      />
    );

    const qr = screen.getByLabelText('QR Code Pix');
    expect(qr).toBeInTheDocument();
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(
      screen.getByText(/Aponte a câmera do aplicativo do seu banco para o QR Code acima para pagar via Pix/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Mensalidade Abril/2026')).toBeInTheDocument();
    expect(screen.getByText('R$ 980,00')).toBeInTheDocument();
  });

  it('sem EMV: não exibe o QR Code SVG nem o texto da câmera', () => {
    const handleCopyPix = vi.fn();
    const setPixModalFatura = vi.fn();

    render(
      <PixModal
        pixModalFatura={mockFaturaSemPix}
        setPixModalFatura={setPixModalFatura}
        handleCopyPix={handleCopyPix}
        copiedPix={false}
      />
    );

    expect(screen.queryByLabelText('QR Code Pix')).not.toBeInTheDocument();
    expect(screen.queryByText(/Aponte a câmera/i)).not.toBeInTheDocument();
    expect(screen.getByText('Código Pix não informado')).toBeInTheDocument();
  });

  it('permite copiar o código Pix chamando handleCopyPix', () => {
    const handleCopyPix = vi.fn();
    const setPixModalFatura = vi.fn();

    render(
      <PixModal
        pixModalFatura={mockFaturaComPix}
        setPixModalFatura={setPixModalFatura}
        handleCopyPix={handleCopyPix}
        copiedPix={false}
      />
    );

    fireEvent.click(screen.getByText('Copiar Código Pix Copia e Cola'));
    expect(handleCopyPix).toHaveBeenCalled();
  });
});
