import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  TONS,
  ESCALA_SALVIA,
  ESCALA_AMBAR,
  PRESETS,
  normalizarHex,
  luminancia,
  contraste,
  textoSobre,
  gerarEscala,
  tomMaisProximo,
  gerarTema,
  temaParaVariaveis,
  validarTema,
} from './tema';

describe('tema', () => {
  describe('normalizarHex', () => {
    it('normaliza hex de 3 e 6 dígitos com ou sem #', () => {
      expect(normalizarHex('#ABC')).toBe('#aabbcc');
      expect(normalizarHex('abc')).toBe('#aabbcc');
      expect(normalizarHex('#AABBCC')).toBe('#aabbcc');
      expect(normalizarHex('1d4ed8')).toBe('#1d4ed8');
    });

    it('retorna null para formatos inválidos', () => {
      expect(normalizarHex('zzz')).toBeNull();
      expect(normalizarHex('#12345')).toBeNull();
      expect(normalizarHex('')).toBeNull();
      expect(normalizarHex('#1234567')).toBeNull();
      expect(normalizarHex('#12g456')).toBeNull();
      // @ts-expect-error testando tipo incorreto
      expect(normalizarHex(null)).toBeNull();
    });
  });

  describe('luminancia', () => {
    it('calcula limites preto e branco', () => {
      expect(luminancia('#000000')).toBeCloseTo(0, 5);
      expect(luminancia('#ffffff')).toBeCloseTo(1, 5);
    });

    it('lança erro para hex inválido', () => {
      expect(() => luminancia('invalido')).toThrow('Cor inválida');
    });
  });

  describe('contraste e textoSobre', () => {
    it('bate com contrastes conhecidos com 2 casas decimais', () => {
      // #1d4ed8 × #ffffff = 6,70
      expect(contraste('#1d4ed8', '#ffffff')).toBeCloseTo(6.70, 2);
      // #ea580c × #ffffff = 3,56
      expect(contraste('#ea580c', '#ffffff')).toBeCloseTo(3.56, 2);
      // #ea580c × #111827 = 4,98
      expect(contraste('#ea580c', '#111827')).toBeCloseTo(4.98, 2);
      // #2d5338 × #ffffff = 8,73
      expect(contraste('#2d5338', '#ffffff')).toBeCloseTo(8.73, 2);
    });

    it('define a cor de maior contraste via textoSobre', () => {
      expect(textoSobre('#ea580c')).toBe('#111827');
      expect(textoSobre('#1d4ed8')).toBe('#ffffff');
      expect(textoSobre('#2d5338')).toBe('#ffffff');
      expect(textoSobre('#ffffff')).toBe('#111827');
    });
  });

  describe('tomMaisProximo', () => {
    it('encontra o tom com luminância mais próxima', () => {
      expect(tomMaisProximo('#2d5338', ESCALA_SALVIA)).toBe(700);
      expect(tomMaisProximo('#f59e0b', ESCALA_AMBAR)).toBe(500);
      expect(tomMaisProximo('#ffffff', ESCALA_SALVIA)).toBe(50);
      expect(tomMaisProximo('#000000', ESCALA_SALVIA)).toBe(950);
    });
  });

  describe('gerarEscala', () => {
    it('não satura os tons extremos (fundos do modo escuro) com cor muito viva', () => {
      const amplitude = (hex: string) => {
        const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return Math.max(...canais) - Math.min(...canais);
      };
      const escala = gerarEscala(PRESETS.azulLaranja.corPrimaria, ESCALA_SALVIA);
      expect(amplitude(escala[950])).toBeLessThan(80);
      expect(amplitude(escala[900])).toBeLessThan(amplitude(escala[600]));
    });

    it('gera escala monotônica com diferença de luminância <= 0.002 para azulLaranja e #808080', () => {
      const cores = [
        { hex: PRESETS.azulLaranja.corPrimaria, ref: ESCALA_SALVIA },
        { hex: PRESETS.azulLaranja.corDestaque, ref: ESCALA_AMBAR },
        { hex: '#808080', ref: ESCALA_SALVIA },
        { hex: '#808080', ref: ESCALA_AMBAR },
      ];

      for (const { hex, ref } of cores) {
        const escala = gerarEscala(hex, ref);
        let lumAnterior = Number.POSITIVE_INFINITY;

        for (const tom of TONS) {
          const corTom = escala[tom];
          expect(corTom).toMatch(/^#[0-9a-f]{6}$/);

          const lumGerada = luminancia(corTom);
          const lumRef = luminancia(ref[tom]);
          const diferenca = Math.abs(lumGerada - lumRef);

          expect(
            diferenca,
            `Tom ${tom} de ${hex} diferiu ${diferenca} da referência (máx 0.002)`
          ).toBeLessThanOrEqual(0.002);

          expect(
            lumGerada,
            `Escala para ${hex} deve ser monotônica decrescente no tom ${tom}`
          ).toBeLessThan(lumAnterior);

          lumAnterior = lumGerada;
        }
      }
    });

    it('lança erro para hex inválido', () => {
      expect(() => gerarEscala('invalido', ESCALA_SALVIA)).toThrow('Cor inválida');
    });
  });

  describe('gerarTema e temaParaVariaveis', () => {
    it('devolve ESCALA_SALVIA e ESCALA_AMBAR exatas para PRESETS.salvia', () => {
      const tema = gerarTema(PRESETS.salvia);
      expect(tema.brand).toEqual(ESCALA_SALVIA);
      expect(tema.accent).toEqual(ESCALA_AMBAR);
      expect(tema.base['ink-dark']).toBe('#f8fafc');
      expect(tema.base.canvas).toBe('#f4f7f4');
    });

    it('temaParaVariaveis(PRESETS.salvia) é idêntico às variáveis lidas de globals.css', () => {
      const cssPath = path.resolve(__dirname, '../app/globals.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      const rootMatch = cssContent.match(/:root\s*\{([\s\S]*?)\}/);
      expect(rootMatch).not.toBeNull();

      const cssVars: Record<string, string> = {};
      for (const line of rootMatch![1].split('\n')) {
        const m = line.match(/--([\w-]+):\s*([^;]+);/);
        if (m) {
          cssVars[`--${m[1]}`] = m[2].trim();
        }
      }

      const variaveisTema = temaParaVariaveis(PRESETS.salvia);

      expect(Object.keys(variaveisTema).length).toBe(Object.keys(cssVars).length);
      for (const [k, v] of Object.entries(cssVars)) {
        expect(variaveisTema[k], `Variável ${k} deve ser idêntica a globals.css`).toBe(v);
      }
    });

    it('lança erro ao receber hex inválido em gerarTema ou temaParaVariaveis', () => {
      expect(() => gerarTema({ corPrimaria: 'invalido', corDestaque: '#f59e0b' })).toThrow(
        'Cor inválida'
      );
      expect(() => gerarTema({ corPrimaria: '#2d5338', corDestaque: 'zzz' })).toThrow(
        'Cor inválida'
      );
      expect(() => temaParaVariaveis({ corPrimaria: 'err', corDestaque: 'err' })).toThrow(
        'Cor inválida'
      );
    });
  });

  describe('validarTema', () => {
    it('aprova PRESETS.salvia e PRESETS.azulLaranja com contraste >= 4.5 em todos os pares', () => {
      const salviaRes = validarTema(PRESETS.salvia);
      expect(salviaRes.aprovado).toBe(true);
      expect(salviaRes.pares.length).toBe(11);
      for (const par of salviaRes.pares) {
        expect(par.aprovado, `Par "${par.nome}" deve ser aprovado`).toBe(true);
        expect(par.razao).toBeGreaterThanOrEqual(par.minimo);
      }

      const azulRes = validarTema(PRESETS.azulLaranja);
      expect(azulRes.aprovado).toBe(true);
      expect(azulRes.pares.length).toBe(11);
      for (const par of azulRes.pares) {
        expect(par.aprovado, `Par "${par.nome}" deve ser aprovado`).toBe(true);
        expect(par.razao).toBeGreaterThanOrEqual(par.minimo);
      }
    });
  });
});
