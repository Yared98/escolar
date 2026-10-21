import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  IdentidadeVisualPanel,
  IdentidadeVisualForm,
} from './IdentidadeVisualPanel';
import { PRESETS, temaParaVariaveis } from '@/lib/tema';
import { isRouteAllowed } from '@/components/Sidebar';

describe('IdentidadeVisualPanel', () => {
  const formPadrao: IdentidadeVisualForm = {
    corPrimaria: '#2d5338',
    corDestaque: '#f59e0b',
    nomeExibicao: 'Escola Modelo Sálvia',
  };

  it('renderiza a pré-visualização com --brand-700 igual a temaParaVariaveis(form)[\'--brand-700\'] no style do bloco', () => {
    render(
      <IdentidadeVisualPanel
        form={formPadrao}
        logoSrc={null}
        onChange={vi.fn()}
        onAplicarPreset={vi.fn()}
        onSalvar={vi.fn()}
        onEnviarLogo={vi.fn()}
        onRemoverLogo={vi.fn()}
        onRestaurar={vi.fn()}
      />
    );

    const blocoClaro = screen.getByTestId('preview-bloco-claro');
    const blocoEscuro = screen.getByTestId('preview-bloco-escuro');
    const varsEsperadas = temaParaVariaveis(formPadrao);

    expect(blocoClaro.style.getPropertyValue('--brand-700')).toBe(varsEsperadas['--brand-700']);
    expect(blocoEscuro.style.getPropertyValue('--brand-700')).toBe(varsEsperadas['--brand-700']);
  });

  it('clicar no preset "Azul & Laranja" chama onAplicarPreset com o preset certo', () => {
    const onAplicarPreset = vi.fn();
    render(
      <IdentidadeVisualPanel
        form={formPadrao}
        logoSrc={null}
        onChange={vi.fn()}
        onAplicarPreset={onAplicarPreset}
        onSalvar={vi.fn()}
        onEnviarLogo={vi.fn()}
        onRemoverLogo={vi.fn()}
        onRestaurar={vi.fn()}
      />
    );

    const btnAzulLaranja = screen.getByRole('button', { name: /azul & laranja/i });
    fireEvent.click(btnAzulLaranja);

    expect(onAplicarPreset).toHaveBeenCalledTimes(1);
    expect(onAplicarPreset).toHaveBeenCalledWith(PRESETS.azulLaranja);
  });

  it('clicar no preset "Sálvia" chama onAplicarPreset com o preset Sálvia', () => {
    const onAplicarPreset = vi.fn();
    render(
      <IdentidadeVisualPanel
        form={formPadrao}
        logoSrc={null}
        onChange={vi.fn()}
        onAplicarPreset={onAplicarPreset}
        onSalvar={vi.fn()}
        onEnviarLogo={vi.fn()}
        onRemoverLogo={vi.fn()}
        onRestaurar={vi.fn()}
      />
    );

    const btnSalvia = screen.getByRole('button', { name: /^sálvia$/i });
    fireEvent.click(btnSalvia);

    expect(onAplicarPreset).toHaveBeenCalledTimes(1);
    expect(onAplicarPreset).toHaveBeenCalledWith(PRESETS.salvia);
  });

  it('hex inválido mostra aviso e o botão Salvar fica desabilitado', () => {
    const formInvalido: IdentidadeVisualForm = {
      corPrimaria: 'invalido',
      corDestaque: '#f59e0b',
      nomeExibicao: 'Escola Teste',
    };

    render(
      <IdentidadeVisualPanel
        form={formInvalido}
        logoSrc={null}
        onChange={vi.fn()}
        onAplicarPreset={vi.fn()}
        onSalvar={vi.fn()}
        onEnviarLogo={vi.fn()}
        onRemoverLogo={vi.fn()}
        onRestaurar={vi.fn()}
      />
    );

    expect(screen.getByText(/código hexadecimal inválido/i)).toBeInTheDocument();

    const btnSalvar = screen.getByRole('button', { name: /salvar identidade visual/i });
    expect(btnSalvar).toBeDisabled();
  });

  it('relatório lista os pares e o Salvar fica habilitado para Azul & Laranja', () => {
    const formAzul: IdentidadeVisualForm = {
      corPrimaria: PRESETS.azulLaranja.corPrimaria,
      corDestaque: PRESETS.azulLaranja.corDestaque,
      nomeExibicao: 'Colégio Azul & Laranja',
    };

    render(
      <IdentidadeVisualPanel
        form={formAzul}
        logoSrc={null}
        onChange={vi.fn()}
        onAplicarPreset={vi.fn()}
        onSalvar={vi.fn()}
        onEnviarLogo={vi.fn()}
        onRemoverLogo={vi.fn()}
        onRestaurar={vi.fn()}
      />
    );

    // Verifica que pares críticos estão listados no relatório
    expect(screen.getByText(/texto branco sobre botão principal \(700\)/i)).toBeInTheDocument();
    expect(screen.getByText(/texto adaptativo sobre destaque accent-500/i)).toBeInTheDocument();

    // Azul & Laranja atende a todos os critérios WCAG AA
    expect(screen.getByText(/✓ aprovado/i)).toBeInTheDocument();

    const btnSalvar = screen.getByRole('button', { name: /salvar identidade visual/i });
    expect(btnSalvar).not.toBeDisabled();
  });

  it('exibe o tom mais próximo da cor principal e de destaque quando válidas', () => {
    render(
      <IdentidadeVisualPanel
        form={formPadrao}
        logoSrc={null}
        onChange={vi.fn()}
        onAplicarPreset={vi.fn()}
        onSalvar={vi.fn()}
        onEnviarLogo={vi.fn()}
        onRemoverLogo={vi.fn()}
        onRestaurar={vi.fn()}
      />
    );

    expect(screen.getByText(/sua cor principal ficou como o tom 700/i)).toBeInTheDocument();
    expect(screen.getByText(/sua cor de destaque ficou como o tom 500/i)).toBeInTheDocument();
  });

  it('dispara onChange ao alterar o nome de exibição e os campos de cor', () => {
    const onChange = vi.fn();
    render(
      <IdentidadeVisualPanel
        form={formPadrao}
        logoSrc={null}
        onChange={onChange}
        onAplicarPreset={vi.fn()}
        onSalvar={vi.fn()}
        onEnviarLogo={vi.fn()}
        onRemoverLogo={vi.fn()}
        onRestaurar={vi.fn()}
      />
    );

    const inputNome = screen.getByLabelText(/nome de exibição da escola/i);
    fireEvent.change(inputNome, { target: { value: 'Nova Escola' } });
    expect(onChange).toHaveBeenCalledWith('nomeExibicao', 'Nova Escola');

    const inputCorPrimariaHex = screen.getByLabelText(/código hexadecimal da cor principal/i);
    fireEvent.change(inputCorPrimariaHex, { target: { value: '#123456' } });
    expect(onChange).toHaveBeenCalledWith('corPrimaria', '#123456');

    const inputCorDestaqueHex = screen.getByLabelText(/código hexadecimal da cor de destaque/i);
    fireEvent.change(inputCorDestaqueHex, { target: { value: '#654321' } });
    expect(onChange).toHaveBeenCalledWith('corDestaque', '#654321');
  });

  it('chama onRestaurar ao clicar no botão "Restaurar Sálvia"', () => {
    const onRestaurar = vi.fn();
    render(
      <IdentidadeVisualPanel
        form={formPadrao}
        logoSrc={null}
        onChange={vi.fn()}
        onAplicarPreset={vi.fn()}
        onSalvar={vi.fn()}
        onEnviarLogo={vi.fn()}
        onRemoverLogo={vi.fn()}
        onRestaurar={onRestaurar}
      />
    );

    const btnRestaurar = screen.getByRole('button', { name: /restaurar sálvia/i });
    fireEvent.click(btnRestaurar);
    expect(onRestaurar).toHaveBeenCalledTimes(1);
  });

  it('permite envio e remoção de logotipo', () => {
    const onEnviarLogo = vi.fn();
    const onRemoverLogo = vi.fn();

    const { rerender } = render(
      <IdentidadeVisualPanel
        form={formPadrao}
        logoSrc={null}
        onChange={vi.fn()}
        onAplicarPreset={vi.fn()}
        onSalvar={vi.fn()}
        onEnviarLogo={onEnviarLogo}
        onRemoverLogo={onRemoverLogo}
        onRestaurar={vi.fn()}
      />
    );

    // Botão de upload
    const inputArquivo = screen.getByLabelText(/upload de logotipo/i) as HTMLInputElement;
    const dummyFile = new File(['dummy-content'], 'logo.png', { type: 'image/png' });

    fireEvent.change(inputArquivo, { target: { files: [dummyFile] } });
    expect(onEnviarLogo).toHaveBeenCalledWith(dummyFile);

    // Quando logoSrc está presente, exibe a imagem e botão de remoção
    rerender(
      <IdentidadeVisualPanel
        form={formPadrao}
        logoSrc="https://escola.local/logo.png"
        onChange={vi.fn()}
        onAplicarPreset={vi.fn()}
        onSalvar={vi.fn()}
        onEnviarLogo={onEnviarLogo}
        onRemoverLogo={onRemoverLogo}
        onRestaurar={vi.fn()}
      />
    );

    const img = screen.getByAltText(/miniatura do logotipo da escola/i);
    expect(img).toBeInTheDocument();

    const btnRemover = screen.getByTitle(/remover logotipo/i);
    fireEvent.click(btnRemover);
    expect(onRemoverLogo).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de erro passada via prop error', () => {
    render(
      <IdentidadeVisualPanel
        form={formPadrao}
        logoSrc={null}
        error="Erro de conexão com o servidor ao carregar tema"
        onChange={vi.fn()}
        onAplicarPreset={vi.fn()}
        onSalvar={vi.fn()}
        onEnviarLogo={vi.fn()}
        onRemoverLogo={vi.fn()}
        onRestaurar={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/erro de conexão com o servidor/i);
  });

  it('valida regras de permissão da rota configuracoes via isRouteAllowed', () => {
    // Permite gestão e admin
    expect(isRouteAllowed('configuracoes', 'gestor')).toBe(true);
    expect(isRouteAllowed('configuracoes', 'admin')).toBe(true);

    // Nega acesso a perfis não-gestores
    expect(isRouteAllowed('configuracoes', 'professor')).toBe(false);
    expect(isRouteAllowed('configuracoes', 'secretaria')).toBe(false);
    expect(isRouteAllowed('configuracoes', 'financeiro')).toBe(false);
    expect(isRouteAllowed('configuracoes', 'nutricionista')).toBe(false);
    expect(isRouteAllowed('configuracoes', 'responsavel')).toBe(false);
    expect(isRouteAllowed('configuracoes', 'aluno')).toBe(false);
  });
});
