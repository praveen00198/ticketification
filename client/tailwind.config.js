/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#292524',
          700: '#1c1917',
          800: '#18181b',
          900: '#09090b',
          DEFAULT: '#18181b',
        },
        surface: {
          bg: '#FAFAF9',
          card: '#FFFFFF',
          elevated: '#FFFFFF',
          border: '#E7E5E4',
          charcoal: '#1C1917',
          muted: '#78716C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Libre Baskerville"', 'Georgia', 'Cambria', 'serif'],
        mono: ['"Cutive Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
