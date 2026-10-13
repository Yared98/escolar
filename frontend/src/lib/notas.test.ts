import { describe, it, expect } from 'vitest';
import { parseNotaInput } from './notas';

describe('parseNotaInput', () => {
  it('converte vírgula em ponto e aceita nota válida', () => {
    expect(parseNotaInput('7,5')).toEqual({ nota: 7.5 });
    expect(parseNotaInput('10')).toEqual({ nota: 10 });
    expect(parseNotaInput('0')).toEqual({ nota: 0 });
  });

  it('rejeita valores fora do intervalo 0–10', () => {
    expect(parseNotaInput('11')).toEqual({ erro: 'A nota deve estar entre 0 e 10.' });
    expect(parseNotaInput('-1')).toEqual({ erro: 'A nota deve estar entre 0 e 10.' });
  });

  it('rejeita texto que não é número', () => {
    expect(parseNotaInput('abc')).toEqual({ erro: 'Digite um número válido.' });
    expect(parseNotaInput('7,5,2')).toEqual({ erro: 'Digite um número válido.' });
  });

  it('interpreta vazio como ausência de alteração', () => {
    expect(parseNotaInput('', 8)).toEqual({ nota: 8 });
    expect(parseNotaInput('', null)).toEqual({ nota: null });
  });

  it('interpreta espaços em branco como vazio', () => {
    expect(parseNotaInput('   ', 6)).toEqual({ nota: 6 });
  });
});
