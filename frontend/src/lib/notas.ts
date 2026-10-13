export interface ParseNotaResult {
  nota?: number | null;
  erro?: string;
}

export function parseNotaInput(valor: string, original: number | null = null): ParseNotaResult {
  const limpo = valor.trim();

  if (limpo === '') {
    return { nota: original };
  }

  if (!/^-?\d+([,.]\d+)?$/.test(limpo)) {
    return { erro: 'Digite um número válido.' };
  }

  const normalizado = limpo.replace(',', '.');
  const numero = parseFloat(normalizado);

  if (numero < 0 || numero > 10) {
    return { erro: 'A nota deve estar entre 0 e 10.' };
  }

  return { nota: numero };
}
