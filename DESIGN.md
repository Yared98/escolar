---
name: Escolar ERP - Gift Sálvia Edition
colors:
  # Base Canvas & Surface (Dark Mode - Inspired by Gift Sálvia & Floresta)
  surface: '#18221d' # Dark Sage Surface
  surface-dim: '#0f1612' # Dark Sage Canvas
  surface-bright: '#28382f'
  surface-container-lowest: '#090e0b'
  surface-container-low: '#151e19'
  surface-container: '#1b2620'
  surface-container-high: '#28382f'
  surface-container-highest: '#384d41'

  # Typography & Borders (Dark Mode)
  on-surface: '#f2f7f3'
  on-surface-variant: '#a8efca'
  inverse-surface: '#f2f7f3'
  inverse-on-surface: '#0f1612'
  outline: '#28382f' # Subtle organic border
  outline-variant: '#1e2d25'

  # Primary Brand Colors (Sálvia Botanical Green from Gift)
  primary: '#52c27e' # Emerald Sage (Dark)
  on-primary: '#0f1612'
  primary-container: '#1b3320'
  on-primary-container: '#a8efca'
  inverse-primary: '#2d5940'

  # Secondary Colors (Financial / Approved)
  secondary: '#10b981' # Vivid Emerald
  on-secondary: '#ffffff'
  secondary-container: '#064e3b'
  on-secondary-container: '#d1fae5'

  # Tertiary & Alerts (Warm Amber from Gift)
  tertiary: '#f59e0b' # Amber Warm Accent
  on-tertiary: '#ffffff'
  tertiary-container: '#78350f'
  on-tertiary-container: '#fef3c7'

  error: '#ef4444'
  on-error: '#ffffff'
  error-container: '#991b1b'
  on-error-container: '#fee2e2'

  background: '#0f1612'
  on-background: '#f2f7f3'
  surface-variant: '#151e19'

# Light Mode Tokens (Gift Sálvia Light Preset)
light-theme:
  background: '#f2f7f3' # Warm Botanical Off-White
  surface: '#ffffff'
  surface-container: '#edf5ee' # Sálvia Container
  surface-low: '#e7efe8'
  on-surface: '#1a3d26' # Deep Forest Text
  on-surface-variant: '#4e7058'
  outline: '#d1ddd2' # Fine Botanical Border
  primary: '#2d5940' # Deep Sálvia Green
  primary-hover: '#22452f'
  secondary: '#059669'
  tertiary: '#b45309'

typography:
  display-lg:
    fontFamily: Inter, sans-serif
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
  headline-lg:
    fontFamily: Inter, sans-serif
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter, sans-serif
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
  headline-sm:
    fontFamily: Inter, sans-serif
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter, sans-serif
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter, sans-serif
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter, sans-serif
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter, sans-serif
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px

rounded:
  sm: 0.375rem
  DEFAULT: 0.5rem # 8px - Gift Organic Roundedness
  md: 0.75rem # 12px
  lg: 1rem # 16px - Soft Gift Cards
  full: 9999px # Pill Badges & Chips

spacing:
  gutter: 1.5rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

# Escolar ERP - Design System (Gift Sálvia Edition)

## 🌿 Psicologia das Cores & Diretrizes Visuais
- **Por que a Sálvia Botânica (`#2D5940` / `#52C27E`)?**
  Na psicologia cromática aplicada à educação e pedagogia, a cor **Sálvia** (verde botânico calmo e acolhedor) reduz a fadiga visual do docente/gestor durante longos períodos de trabalho, transmite serenidade, foco cognitivo, equilíbrio emocional e sensação de acolhimento. Ela desconstruiu com sucesso a rigidez dos ERPs industriais frios.

- **Dualidade Modo Claro & Modo Escuro (Alternância Dinâmica)**:
  - **Modo Claro (Light)**: Fundo papel sálvia acolhedor (`#F2F7F3`), superfícies de leitura puras (`#FFFFFF`), containers verde floresta suave (`#EDF5EE`) e tipografia em tom floresta profundo (`#1A3D26`).
  - **Modo Escuro (Dark)**: Fundo floresta noturna (`#0F1612`), superfícies de trabalho (`#18221D`), bordas orgânicas finas (`#28382F`) e destaques em verde sálvia vivo (`#52C27E`).

- **Chave de Alternância (Theme Switcher)**:
  - Botão interativo no Header com ícones Sun/Moon e sincronização via `localStorage` e suporte nativo ao selector `class="dark"` do Tailwind CSS.

- **Componentação Acolhedora**:
  - Cards acolhedores com cantos arredondados (`rounded-2xl` / 16px), bordas de 1px suavemente contrastadas e chips em formato de pílula (`rounded-full`).

## 🎨 Tokens e variáveis CSS (tema por escola)

As cores de marca não ficam mais fixas no Tailwind: cada token lê uma variável CSS com os canais RGB (ex.: `--brand-700: 45 83 56`), definida em `frontend/src/app/globals.css` com os valores Sálvia como padrão. O tema da escola (cards TEMA-T2..T5) sobrescreve essas variáveis em `document.documentElement`.

| Classe Tailwind | Variável | Uso |
|---|---|---|
| `salvia-50..950` | `--brand-50..950` | Cor principal da escola (o nome `salvia` foi mantido para não reescrever os componentes). |
| `accent-50..950` | `--accent-50..950` | Cor de destaque (padrão: âmbar). Ainda sem uso nos componentes. |
| `canvas` / `canvas-dark` | `--canvas` / `--canvas-dark` | Fundo da página (claro / escuro). |
| `surface-dark` | `--surface-dark` | Superfície de cards no modo escuro. |
| `ink` / `ink-dark` | `--ink` / `--ink-dark` | Texto base (claro / escuro). |

Regras: não usar hex arbitrário (`bg-[#...]`) em componentes; usar os tokens acima. Opacidade funciona normalmente (`dark:bg-canvas-dark/80`). Cores de status (verde sucesso, âmbar aviso, vermelho erro) usam a paleta padrão do Tailwind e **não** seguem o tema da escola.


### Gerador de tema e validador de contraste (`src/lib/tema.ts`)

A função `gerarTema(tema)` calcula as escalas `--brand-*` e `--accent-*` a partir de uma cor primária e de destaque usando o espaço perceptual OKLCH, preservando as mesmas luminâncias relativas (WCAG 2.x) da paleta Sálvia de referência. Isso garante que qualquer par de contraste aprovado na paleta padrão permaneça conforme as diretrizes de acessibilidade (WCAG AA ≥ 4,5:1), o que é auditado por `validarTema(tema)`.
