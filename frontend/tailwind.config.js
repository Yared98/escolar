/** @type {import('tailwindcss').Config} */
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
        // High-Contrast Sálvia Botanical Theme
        salvia: {
          50: '#f2f7f4',
          100: '#e1ede5',
          200: '#c3dccb',
          300: '#9ac3a6',
          400: '#6ea37d',
          500: '#4e865d',
          600: '#3a6b47',
          700: '#2d5338', // Sálvia Primary (Light Mode)
          800: '#25432f',
          900: '#1e3727',
          950: '#0f1c13', // Sálvia Dark Background
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
