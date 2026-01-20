/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#F25912', // Laranja principal
          600: '#d94606',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        purple: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#5C3E94', // Roxo médio
          600: '#412B6B', // Roxo escuro
          700: '#2d1a4d',
          800: '#211832', // Roxo muito escuro
          900: '#1a1328',
        },
        dark: {
          bg: '#211832', // Fundo principal escuro
          surface: '#2d1a4d', // Superfície escura
          border: '#412B6B', // Bordas
          text: '#f3f4f6', // Texto claro
          muted: '#9ca3af', // Texto secundário
        },
      },
    },
  },
  plugins: [],
}

