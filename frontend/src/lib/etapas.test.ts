import { describe, expect, it } from 'vitest';
import { etapaEnsinoLabel } from './etapas';

describe('etapaEnsinoLabel', () => {
  it('traduz os códigos conhecidos', () => {
    expect(etapaEnsinoLabel('fundamental_1')).toBe('Ensino Fundamental I');
    expect(etapaEnsinoLabel('educacao_infantil')).toBe('Educação Infantil');
    expect(etapaEnsinoLabel('medio')).toBe('Ensino Médio');
  });

  it('não mostra o código cru para valores desconhecidos ou vazios', () => {
    expect(etapaEnsinoLabel('eja_noturno')).toBe('eja noturno');
    expect(etapaEnsinoLabel(undefined)).toBe('Etapa não informada');
  });
});
