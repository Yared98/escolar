import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecadoFamiliaModal } from './RecadoFamiliaModal';

describe('RecadoFamiliaModal', () => {
  it('não renderiza nada quando open é false', () => {
    const { container } = render(
      <RecadoFamiliaModal
        open={false}
        alunoNome="Lucas Silva"
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('exibe nome do aluno, responsável e campo de mensagem quando aberto', () => {
    render(
      <RecadoFamiliaModal
        open={true}
        alunoNome="Lucas Silva"
        responsavelNome="Ana Silva"
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText('Recado à família')).toBeDefined();
    expect(screen.getByText('Lucas Silva')).toBeDefined();
    expect(screen.getByText('Ana Silva')).toBeDefined();
    const textarea = screen.getByPlaceholderText('Digite o recado para a família do aluno...');
    expect(textarea).toBeDefined();
  });

  it('mantém o botão Enviar desabilitado quando a mensagem está vazia', () => {
    render(
      <RecadoFamiliaModal
        open={true}
        alunoNome="Lucas Silva"
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    const botaoEnviar = screen.getByRole('button', { name: /enviar/i });
    expect(botaoEnviar).toHaveProperty('disabled', true);
  });

  it('chama onSend com o texto digitado ao submeter o formulário', async () => {
    const onSendMock = vi.fn();
    render(
      <RecadoFamiliaModal
        open={true}
        alunoNome="Lucas Silva"
        onClose={vi.fn()}
        onSend={onSendMock}
      />
    );

    const textarea = screen.getByPlaceholderText('Digite o recado para a família do aluno...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Favor enviar autorização para o passeio.' } });
    });

    const botaoEnviar = screen.getByRole('button', { name: /enviar/i });
    expect(botaoEnviar).toHaveProperty('disabled', false);

    await act(async () => {
      fireEvent.click(botaoEnviar);
    });
    expect(onSendMock).toHaveBeenCalledWith('Favor enviar autorização para o passeio.');
  });

  it('chama onClose ao clicar em Cancelar ou no botão fechar', () => {
    const onCloseMock = vi.fn();
    render(
      <RecadoFamiliaModal
        open={true}
        alunoNome="Lucas Silva"
        onClose={onCloseMock}
        onSend={vi.fn()}
      />
    );

    const botaoCancelar = screen.getByRole('button', { name: /cancelar/i });
    fireEvent.click(botaoCancelar);
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('exibe mensagem de erro quando fornecida', () => {
    render(
      <RecadoFamiliaModal
        open={true}
        alunoNome="Lucas Silva"
        erro="Falha ao conectar ao servidor."
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByText('Falha ao conectar ao servidor.')).toBeDefined();
  });
});
