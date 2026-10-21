/** @type {import('tailwindcss').Config} */

// As cores de marca vêm de variáveis CSS (canais RGB, definidas em
// src/app/globals.css) para que cada escola possa ter o próprio tema.
// O formato `rgb(var(--x) / <alpha-value>)` mantém as opacidades (`/40`).
const cor = (variavel) => `rgb(var(--${variavel}) / <alpha-value>)`;
const escala = (prefixo) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((tom) => [tom, cor(`${prefixo}-${tom}`)]),
  );

module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cor principal da escola (padrão: Sálvia). O nome `salvia` foi mantido
        // para não reescrever os componentes; o valor segue o tema da escola.
        salvia: escala('brand'),
        // Cor de destaque da escola (padrão: âmbar, o tertiary do DESIGN.md).
        accent: escala('accent'),
        // Fundos e texto base (claro e escuro).
        canvas: { DEFAULT: cor('canvas'), dark: cor('canvas-dark') },
        'surface-dark': cor('surface-dark'),
        ink: { DEFAULT: cor('ink'), dark: cor('ink-dark') },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
