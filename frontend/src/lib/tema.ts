export const TONS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type Tom = (typeof TONS)[number];
export type Escala = Record<Tom, string>; // hex '#rrggbb' minúsculo

export interface TemaEscola {
  corPrimaria: string;
  corDestaque: string;
}

export const ESCALA_SALVIA: Escala = {
  50: '#f2f7f4',
  100: '#e1ede5',
  200: '#c3dccb',
  300: '#9ac3a6',
  400: '#6ea37d',
  500: '#4e865d',
  600: '#3a6b47',
  700: '#2d5338',
  800: '#25432f',
  900: '#1e3727',
  950: '#0f1c13',
};

export const ESCALA_AMBAR: Escala = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
};

export const PRESETS: {
  salvia: TemaEscola & { nome: string };
  azulLaranja: TemaEscola & { nome: string };
} = {
  salvia: {
    nome: 'Sálvia',
    corPrimaria: '#2d5338',
    corDestaque: '#f59e0b',
  },
  azulLaranja: {
    nome: 'Azul & Laranja',
    corPrimaria: '#1d4ed8',
    corDestaque: '#ea580c',
  },
};

type BaseTokenChave =
  | 'canvas'
  | 'canvas-dark'
  | 'surface-dark'
  | 'ink'
  | 'ink-dark'
  | 'scrollbar'
  | 'scrollbar-dark';

const BASE_SALVIA: Record<BaseTokenChave, string> = {
  canvas: '#f4f7f4',
  'canvas-dark': '#0c120e',
  'surface-dark': '#141d17',
  ink: '#1a261d',
  'ink-dark': '#f8fafc',
  scrollbar: '#a3b8a8',
  'scrollbar-dark': '#28382f',
};

/**
 * Normaliza uma representação hexadecimal de cor (#ABC, abc, #AABBCC)
 * para o formato padronizado minúsculo '#aabbcc'. Retorna null se for inválido.
 */
export function normalizarHex(valor: string): string | null {
  if (typeof valor !== 'string') {
    return null;
  }
  const limpo = valor.trim();
  const semHash = limpo.startsWith('#') ? limpo.slice(1) : limpo;
  if (/^[0-9a-fA-F]{3}$/.test(semHash)) {
    const r = semHash[0];
    const g = semHash[1];
    const b = semHash[2];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(semHash)) {
    return `#${semHash.toLowerCase()}`;
  }
  return null;
}

function srgbParaLinear(c: number): number {
  const norm = c / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function linearParaSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function hexParaRgb(hex: string): [number, number, number] {
  const norm = normalizarHex(hex);
  if (!norm) {
    throw new Error('Cor inválida');
  }
  return [
    parseInt(norm.slice(1, 3), 16),
    parseInt(norm.slice(3, 5), 16),
    parseInt(norm.slice(5, 7), 16),
  ];
}

function rgbParaHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calcula a luminância relativa WCAG 2.x (0 a 1) para uma cor hexadecimal.
 */
export function luminancia(hex: string): number {
  const [r, g, b] = hexParaRgb(hex);
  return 0.2126 * srgbParaLinear(r) + 0.7152 * srgbParaLinear(g) + 0.0722 * srgbParaLinear(b);
}

function luminanciaRgb(r: number, g: number, b: number): number {
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  return (
    0.2126 * srgbParaLinear(clamp(r)) +
    0.7152 * srgbParaLinear(clamp(g)) +
    0.0722 * srgbParaLinear(clamp(b))
  );
}

/**
 * Calcula a razão de contraste WCAG (L1+0.05)/(L2+0.05) entre duas cores, sem arredondar.
 */
export function contraste(a: string, b: string): number {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  const maisClaro = Math.max(l1, l2);
  const maisEscuro = Math.min(l1, l2);
  return (maisClaro + 0.05) / (maisEscuro + 0.05);
}

/**
 * Determina a cor de texto com maior contraste sobre o fundo dado (#ffffff ou #111827).
 */
export function textoSobre(fundo: string): '#ffffff' | '#111827' {
  const cBranco = contraste('#ffffff', fundo);
  const cEscuro = contraste('#111827', fundo);
  return cBranco >= cEscuro ? '#ffffff' : '#111827';
}

function rgbParaOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbParaLinear(r);
  const lg = srgbParaLinear(g);
  const lb = srgbParaLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function oklabParaRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [
    linearParaSrgb(lr) * 255,
    linearParaSrgb(lg) * 255,
    linearParaSrgb(lb) * 255,
  ];
}

function dentroGamutSrgb(r: number, g: number, b: number): boolean {
  return (
    r >= -0.0001 &&
    r <= 255.0001 &&
    g >= -0.0001 &&
    g <= 255.0001 &&
    b >= -0.0001 &&
    b <= 255.0001
  );
}

function limitarCroma(L: number, maxC: number, H: number): number {
  if (maxC <= 1e-6) return 0;
  const cosH = Math.cos(H);
  const sinH = Math.sin(H);
  const [r, g, b] = oklabParaRgb(L, maxC * cosH, maxC * sinH);
  if (dentroGamutSrgb(r, g, b)) {
    return maxC;
  }
  let low = 0;
  let high = maxC;
  for (let i = 0; i < 25; i++) {
    const mid = (low + high) / 2;
    const [cr, cg, cb] = oklabParaRgb(L, mid * cosH, mid * sinH);
    if (dentroGamutSrgb(cr, cg, cb)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}

function obterRgbParaL(L: number, maxC: number, H: number): [number, number, number] {
  const c = limitarCroma(L, maxC, H);
  return oklabParaRgb(L, c * Math.cos(H), c * Math.sin(H));
}

function buscarCorPorLuminancia(
  targetLum: number,
  maxC: number,
  H: number,
  limiteSuperiorLum?: number
): string {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const rgb = obterRgbParaL(mid, maxC, H);
    const lum = luminanciaRgb(...rgb);
    if (lum < targetLum) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const finalL = (low + high) / 2;
  const [fr, fg, fb] = obterRgbParaL(finalL, maxC, H);
  const baseR = Math.round(fr);
  const baseG = Math.round(fg);
  const baseB = Math.round(fb);

  let bestR = baseR;
  let bestG = baseG;
  let bestB = baseB;
  let bestDiff = Math.abs(luminanciaRgb(baseR, baseG, baseB) - targetLum);

  // Considerar vizinhos discretos +-2 para precisão de 8 bits
  for (let dr = -2; dr <= 2; dr++) {
    for (let dg = -2; dg <= 2; dg++) {
      for (let db = -2; db <= 2; db++) {
        const nr = baseR + dr;
        const ng = baseG + dg;
        const nb = baseB + db;
        if (nr >= 0 && nr <= 255 && ng >= 0 && ng <= 255 && nb >= 0 && nb <= 255) {
          const lum = luminanciaRgb(nr, ng, nb);
          if (limiteSuperiorLum !== undefined && lum >= limiteSuperiorLum) {
            continue;
          }
          const diff = Math.abs(lum - targetLum);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestR = nr;
            bestG = ng;
            bestB = nb;
          }
        }
      }
    }
  }

  return rgbParaHex(bestR, bestG, bestB);
}

/**
 * Gera uma escala de 11 tons (50 a 950) a partir de uma cor hexadecimal,
 * mantendo a luminância de cada tom da escala de referência via busca binária em OKLCH.
 */
export function gerarEscala(hex: string, referencia: Escala): Escala {
  const norm = normalizarHex(hex);
  if (!norm) {
    throw new Error('Cor inválida');
  }
  const [r, g, b] = hexParaRgb(norm);
  const [, a_orig, b_orig] = rgbParaOklab(r, g, b);
  const C_orig = Math.sqrt(a_orig * a_orig + b_orig * b_orig);
  const H_orig = Math.atan2(b_orig, a_orig);

  // O croma de cada tom segue o perfil da referência (pico = croma da cor dada):
  // sem isso os tons extremos (fundos do modo escuro, 900/950) ficam saturados demais.
  const cromaRef = {} as Record<Tom, number>;
  for (const tom of TONS) {
    const [, ra, rb] = rgbParaOklab(...hexParaRgb(referencia[tom]));
    cromaRef[tom] = Math.sqrt(ra * ra + rb * rb);
  }
  const picoRef = Math.max(...TONS.map((tom) => cromaRef[tom]));

  const res = {} as Escala;
  let prevLum: number | undefined;

  for (const tom of TONS) {
    const targetLum = luminancia(referencia[tom]);
    const maxC = picoRef > 1e-6 ? C_orig * (cromaRef[tom] / picoRef) : C_orig;
    const cor = buscarCorPorLuminancia(targetLum, maxC, H_orig, prevLum);
    res[tom] = cor;
    prevLum = luminancia(cor);
  }

  return res;
}

/**
 * Encontra o tom da escala cuja luminância é mais próxima da cor dada.
 */
export function tomMaisProximo(hex: string, escala: Escala): Tom {
  const norm = normalizarHex(hex);
  if (!norm) {
    throw new Error('Cor inválida');
  }
  const targetLum = luminancia(norm);
  let melhorTom: Tom = TONS[0];
  let menorDiff = Math.abs(luminancia(escala[TONS[0]]) - targetLum);

  for (let i = 1; i < TONS.length; i++) {
    const tom = TONS[i];
    const diff = Math.abs(luminancia(escala[tom]) - targetLum);
    if (diff < menorDiff) {
      menorDiff = diff;
      melhorTom = tom;
    }
  }

  return melhorTom;
}

/**
 * Gera o conjunto completo de paletas (brand, accent e tokens base) para uma escola.
 */
export function gerarTema(tema: TemaEscola): {
  brand: Escala;
  accent: Escala;
  base: Record<BaseTokenChave, string>;
} {
  const primariaNorm = normalizarHex(tema.corPrimaria);
  const destaqueNorm = normalizarHex(tema.corDestaque);

  if (!primariaNorm || !destaqueNorm) {
    throw new Error('Cor inválida');
  }

  const brand =
    primariaNorm === '#2d5338' ? ESCALA_SALVIA : gerarEscala(primariaNorm, ESCALA_SALVIA);

  const accent =
    destaqueNorm === '#f59e0b' ? ESCALA_AMBAR : gerarEscala(destaqueNorm, ESCALA_AMBAR);

  let base: Record<BaseTokenChave, string>;

  if (primariaNorm === '#2d5338') {
    base = { ...BASE_SALVIA };
  } else {
    const [pr, pg, pb] = hexParaRgb(primariaNorm);
    const [, pa, pb_orig] = rgbParaOklab(pr, pg, pb);
    const pH = Math.atan2(pb_orig, pa);
    const pC = Math.sqrt(pa * pa + pb_orig * pb_orig);

    base = {
      canvas: '',
      'canvas-dark': '',
      'surface-dark': '',
      ink: '',
      'ink-dark': '#f8fafc',
      scrollbar: '',
      'scrollbar-dark': '',
    };

    const chaves: BaseTokenChave[] = [
      'canvas',
      'canvas-dark',
      'surface-dark',
      'ink',
      'scrollbar',
      'scrollbar-dark',
    ];

    for (const chave of chaves) {
      const padraoHex = BASE_SALVIA[chave];
      const [dr, dg, db] = hexParaRgb(padraoHex);
      const [, da, db_val] = rgbParaOklab(dr, dg, db);
      const defC = Math.sqrt(da * da + db_val * db_val);
      const targetLum = luminancia(padraoHex);
      base[chave] = buscarCorPorLuminancia(targetLum, Math.min(defC, pC), pH);
    }
  }

  return { brand, accent, base };
}

function hexParaCanaisRgb(hex: string): string {
  const [r, g, b] = hexParaRgb(hex);
  return `${r} ${g} ${b}`;
}

/**
 * Converte o tema gerado no mapa de variáveis CSS com canais RGB ("r g b"),
 * compatível com globals.css e document.documentElement.style.setProperty.
 */
export function temaParaVariaveis(tema: TemaEscola): Record<string, string> {
  const t = gerarTema(tema);
  const vars: Record<string, string> = {};

  for (const tom of TONS) {
    vars[`--brand-${tom}`] = hexParaCanaisRgb(t.brand[tom]);
  }
  for (const tom of TONS) {
    vars[`--accent-${tom}`] = hexParaCanaisRgb(t.accent[tom]);
  }
  const chavesBase: BaseTokenChave[] = [
    'canvas',
    'canvas-dark',
    'surface-dark',
    'ink',
    'ink-dark',
    'scrollbar',
    'scrollbar-dark',
  ];
  for (const chave of chavesBase) {
    vars[`--${chave}`] = hexParaCanaisRgb(t.base[chave]);
  }

  return vars;
}

export interface ParContraste {
  nome: string;
  frente: string;
  fundo: string;
  razao: number;
  minimo: number;
  aprovado: boolean;
}

/**
 * Valida os pares críticos de contraste do tema para acessibilidade WCAG AA (mínimo 4,5:1).
 */
export function validarTema(tema: TemaEscola): { aprovado: boolean; pares: ParContraste[] } {
  const t = gerarTema(tema);

  const paresDef = [
    {
      nome: 'Texto branco sobre brand-600',
      frente: '#ffffff',
      fundo: t.brand[600],
      minimo: 4.5,
    },
    {
      nome: 'Texto branco sobre botão principal (700)',
      frente: '#ffffff',
      fundo: t.brand[700],
      minimo: 4.5,
    },
    {
      nome: 'Texto branco sobre brand-800',
      frente: '#ffffff',
      fundo: t.brand[800],
      minimo: 4.5,
    },
    {
      nome: 'Texto brand-800 sobre fundo brand-50',
      frente: t.brand[800],
      fundo: t.brand[50],
      minimo: 4.5,
    },
    {
      nome: 'Texto brand-700 sobre fundo branco',
      frente: t.brand[700],
      fundo: '#ffffff',
      minimo: 4.5,
    },
    {
      nome: 'Texto brand-50 sobre fundo brand-950',
      frente: t.brand[50],
      fundo: t.brand[950],
      minimo: 4.5,
    },
    {
      nome: 'Texto brand-300 sobre canvas-dark',
      frente: t.brand[300],
      fundo: t.base['canvas-dark'],
      minimo: 4.5,
    },
    {
      nome: 'Texto ink sobre canvas',
      frente: t.base.ink,
      fundo: t.base.canvas,
      minimo: 4.5,
    },
    {
      nome: 'Texto ink-dark sobre canvas-dark',
      frente: t.base['ink-dark'],
      fundo: t.base['canvas-dark'],
      minimo: 4.5,
    },
    {
      nome: 'Texto adaptativo sobre destaque accent-500',
      frente: textoSobre(t.accent[500]),
      fundo: t.accent[500],
      minimo: 4.5,
    },
    {
      nome: 'Texto accent-700 sobre fundo branco',
      frente: t.accent[700],
      fundo: '#ffffff',
      minimo: 4.5,
    },
  ];

  const pares: ParContraste[] = paresDef.map(p => {
    const razao = contraste(p.frente, p.fundo);
    return {
      nome: p.nome,
      frente: p.frente,
      fundo: p.fundo,
      razao,
      minimo: p.minimo,
      aprovado: razao >= p.minimo,
    };
  });

  return {
    aprovado: pares.every(p => p.aprovado),
    pares,
  };
}
