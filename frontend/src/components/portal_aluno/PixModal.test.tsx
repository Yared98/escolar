import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PixModal } from './PixModal';
import type { FaturaData } from './types';

const faturaComum: FaturaData = {
  id: 'fat-comum-1',
  aluno_id: 'aluno-1',
  descricao: 'Mensalidade Janeiro 2026',
  valor: 850.0,
  data_vencimento: '2026-01-10',
  status: 'pendente',
  metodo_pagamento: 'pix',
  qr_code_pix: '00020126580014br.gov.bcb.pix0136...local',
};

const faturaItau: FaturaData = {
  id: 'fat-itau-2',
  aluno_id: 'aluno-1',
  descricao: 'Mensalidade Fevereiro 2026',
  valor: 920.0,
  data_vencimento: '2026-02-10',
  status: 'pendente',
  metodo_pagamento: 'boleto_pix',
  gateway_name: 'itau',
  gateway_digitable_line: '34191.09008 12345.678901 23456.789012 3 99990000092000',
  gateway_pix_code: '00020126580014br.gov.bcb.pix0136...itau',
  codigo_barras: '34191999900000920001090000000123456789012345',
  simulado: true,
};

describe('PixModal do Portal da Família', () => {
  it('mostra o Bolecode oficial quando gateway_name === "itau" e tem linha digitável', () => {
    const setPixModalFatura = vi.fn();
    const handleCopyPix = vi.fn();

    render(
      <PixModal
        pixModalFatura={faturaItau}
        setPixModalFatura={setPixModalFatura}
        handleCopyPix={handleCopyPix}
        copiedPix={false}
      />
    );

    expect(screen.getByText('2ª Via • Bolecode Itaú')).toBeInTheDocument();
    expect(screen.getByText('Simulado')).toBeInTheDocument();
    expect(screen.getByText('Depois do vencimento, pague pelo código de barras.')).toBeInTheDocument();
    expect(screen.getByDisplayValue(faturaItau.gateway_digitable_line!)).toBeInTheDocument();
    expect(screen.getByDisplayValue(faturaItau.gateway_pix_code!)).toBeInTheDocument();
    expect(screen.getByDisplayValue(faturaItau.codigo_barras!)).toBeInTheDocument();
  });

  it('com EMV: exibe o QR Code SVG com aria-label e o texto da câmera', () => {
    render(
      <PixModal
        pixModalFatura={faturaItau}
        setPixModalFatura={vi.fn()}
        handleCopyPix={vi.fn()}
        copiedPix={false}
      />
    );

    const qr = screen.getByLabelText('QR Code Pix');
    expect(qr).toBeInTheDocument();
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(
      screen.getByText(/Aponte a câmera do aplicativo do seu banco para o QR Code acima para pagar via Pix/i)
    ).toBeInTheDocument();
  });

  it('sem EMV: não exibe o QR Code SVG nem o texto da câmera', () => {
    const faturaSemPix: FaturaData = {
      ...faturaItau,
      gateway_pix_code: undefined,
      qr_code_pix: undefined,
    };

    render(
      <PixModal
        pixModalFatura={faturaSemPix}
        setPixModalFatura={vi.fn()}
        handleCopyPix={vi.fn()}
        copiedPix={false}
      />
    );

    expect(screen.queryByLabelText('QR Code Pix')).not.toBeInTheDocument();
    expect(screen.queryByText(/Aponte a câmera/i)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(faturaItau.gateway_digitable_line!)).toBeInTheDocument();
  });

  it('mantém o Pix local com o aviso da tesouraria quando a fatura não é do Itaú', () => {
    const setPixModalFatura = vi.fn();
    const handleCopyPix = vi.fn();

    render(
      <PixModal
        pixModalFatura={faturaComum}
        setPixModalFatura={setPixModalFatura}
        handleCopyPix={handleCopyPix}
        copiedPix={false}
      />
    );

    expect(screen.getByText('2ª Via de Pagamento Pix')).toBeInTheDocument();
    expect(screen.getByText(/Conferido pela tesouraria/i)).toBeInTheDocument();
    expect(
      screen.getByText(/A confirmação do pagamento é feita pela tesouraria da escola/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Depois do vencimento, pague pelo código de barras/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Linha Digitável')).not.toBeInTheDocument();
  });

  it('permite copiar a linha digitável do Bolecode Itaú', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(
      <PixModal
        pixModalFatura={faturaItau}
        setPixModalFatura={vi.fn()}
        handleCopyPix={vi.fn()}
        copiedPix={false}
      />
    );

    const copyButtons = screen.getAllByText('Copiar');
    // Primeiro botão Copiar é para a linha digitável
    fireEvent.click(copyButtons[0]);
    expect(writeTextMock).toHaveBeenCalledWith(faturaItau.gateway_digitable_line);
  });
});
