import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QrCodePix } from './QrCodePix';

describe('QrCodePix', () => {
  it('renderiza svg com aria-label="QR Code Pix" quando recebe um EMV válido', () => {
    const { container } = render(
      <QrCodePix emv="00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-42661417400052040000530398654071250.005802BR5915Escola Exemplo6009Sao Paulo62070503***6304ABCD" />
    );

    const svg = screen.getByLabelText('QR Code Pix');
    expect(svg).toBeInTheDocument();
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('não renderiza nada quando emv é ausente ou vazio', () => {
    const { container: c1 } = render(<QrCodePix emv="" />);
    expect(c1.firstChild).toBeNull();
    expect(screen.queryByLabelText('QR Code Pix')).not.toBeInTheDocument();

    const { container: c2 } = render(<QrCodePix emv={undefined} />);
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(<QrCodePix emv={null} />);
    expect(c3.firstChild).toBeNull();

    const { container: c4 } = render(<QrCodePix emv="   " />);
    expect(c4.firstChild).toBeNull();
  });

  it('respeita o tamanho configurado', () => {
    render(
      <QrCodePix
        emv="00020126580014br.gov.bcb.pix0136teste"
        tamanho={220}
      />
    );

    const svg = screen.getByLabelText('QR Code Pix');
    expect(svg).toHaveAttribute('width', '220');
    expect(svg).toHaveAttribute('height', '220');
  });
});
