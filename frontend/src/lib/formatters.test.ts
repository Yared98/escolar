import { describe, it, expect } from 'vitest';
import {
  formatNumero,
  formatDateExtenso,
  cleanDigits,
  formatCpf,
  formatPhone,
  formatCep,
  formatCurrency,
  formatDateBr,
} from './formatters';

describe('formatters', () => {
  describe('cleanDigits', () => {
    it('retorna string vazia para valores nulos, vazios ou indefinidos', () => {
      expect(cleanDigits(null)).toBe('');
      expect(cleanDigits(undefined)).toBe('');
      expect(cleanDigits('')).toBe('');
    });

    it('remove caracteres não numéricos', () => {
      expect(cleanDigits('123.456.789-00')).toBe('12345678900');
      expect(cleanDigits('(11) 98765-4321')).toBe('11987654321');
      expect(cleanDigits('abc-123_xyz')).toBe('123');
    });
  });

  describe('formatCpf', () => {
    it('retorna vazio quando o valor for nulo ou vazio', () => {
      expect(formatCpf(null)).toBe('');
      expect(formatCpf(undefined)).toBe('');
      expect(formatCpf('')).toBe('');
    });

    it('formata CPF com máscara progressiva e completa', () => {
      expect(formatCpf('123')).toBe('123');
      expect(formatCpf('123456')).toBe('123.456');
      expect(formatCpf('123456789')).toBe('123.456.789');
      expect(formatCpf('12345678900')).toBe('123.456.789-00');
    });

    it('limpa pontuações prévias e limita a 11 dígitos', () => {
      expect(formatCpf('123.456.789-00')).toBe('123.456.789-00');
      expect(formatCpf('123456789009999')).toBe('123.456.789-00');
    });
  });

  describe('formatPhone', () => {
    it('retorna vazio quando o valor for nulo ou vazio', () => {
      expect(formatPhone(null)).toBe('');
      expect(formatPhone(undefined)).toBe('');
      expect(formatPhone('')).toBe('');
    });

    it('formata telefone fixo e celular', () => {
      expect(formatPhone('11')).toBe('(11');
      expect(formatPhone('11987')).toBe('(11) 987');
      expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
      expect(formatPhone('11988887777')).toBe('(11) 98888-7777');
    });
  });

  describe('formatCep', () => {
    it('retorna vazio quando o valor for nulo ou vazio', () => {
      expect(formatCep(null)).toBe('');
      expect(formatCep(undefined)).toBe('');
      expect(formatCep('')).toBe('');
    });

    it('formata CEP com máscara', () => {
      expect(formatCep('01234')).toBe('01234');
      expect(formatCep('01234567')).toBe('01234-567');
      expect(formatCep('01234-567')).toBe('01234-567');
    });
  });

  describe('formatCurrency', () => {
    it('retorna R$ 0,00 para nulo, indefinido ou NaN', () => {
      expect(formatCurrency(null)).toBe('R$ 0,00');
      expect(formatCurrency(undefined)).toBe('R$ 0,00');
      expect(formatCurrency(Number.NaN)).toBe('R$ 0,00');
    });

    it('formata valores positivos e zero no padrão BRL', () => {
      const zero = formatCurrency(0);
      expect(zero).toContain('0,00');

      const val = formatCurrency(1250.5);
      // Espaço no BRL pode ser non-breaking space \u00a0
      expect(val.replace(/\u00a0/g, ' ')).toMatch(/R\$\s*1\.250,50/);
    });

    it('formata valores negativos corretamente', () => {
      const negative = formatCurrency(-50.25);
      expect(negative.replace(/\u00a0/g, ' ')).toMatch(/-R\$\s*50,25/);
    });
  });

  describe('formatDateBr', () => {
    it('retorna traço quando data não fornecida', () => {
      expect(formatDateBr(null)).toBe('-');
      expect(formatDateBr(undefined)).toBe('-');
      expect(formatDateBr('')).toBe('-');
    });

    it('formata data ISO YYYY-MM-DD para DD/MM/YYYY', () => {
      expect(formatDateBr('2026-10-03')).toBe('03/10/2026');
      expect(formatDateBr('2026-10-03T15:30:00.000Z')).toBe('03/10/2026');
    });

    it('retorna a string original quando a data for inválida', () => {
      expect(formatDateBr('data-invalida')).toBe('data-invalida');
    });
  });
});

describe('formatNumero', () => {
  it('formata com as casas pedidas e usa "-" quando não há valor', () => {
    expect(formatNumero(7.25, 1)).toBe('7.3');
    expect(formatNumero(8, 2)).toBe('8.00');
    expect(formatNumero(null, 1)).toBe('-');
    expect(formatNumero(undefined, 2)).toBe('-');
  });
});

describe('formatDateExtenso', () => {
  it('escreve a data por extenso sem depender do fuso horário', () => {
    expect(formatDateExtenso('2026-10-13')).toBe('13 de outubro de 2026');
    expect(formatDateExtenso('2026-03-01T00:00:00Z')).toBe('1 de março de 2026');
    expect(formatDateExtenso(null)).toBe('');
  });
});
