/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f0f7f1',
          100: '#c8e4d0',
          200: '#9fd0ab',
          300: '#6ba870',
          400: '#4f7a59',
          500: '#3e6448',
          600: '#36583f',
          700: '#2d4c34',
          800: '#1e3222',
          900: '#132118',
        },
        steel: {
          50:  '#d4eef8',
          100: '#b0d9ef',
          400: '#5c9ab8',
          500: '#5c9ab8',
          600: '#3a7a96',
          700: '#2a5f78',
        },
        cranberry: {
          50:  '#f3d4db',
          100: '#e9b0bf',
          400: '#a85268',
          500: '#a85268',
          600: '#7c3a4e',
          700: '#5a2838',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'btn-primary': '0 1px 3px rgba(0,0,0,.1),0 4px 12px rgba(62,100,72,.2)',
        'card-forest':  '0 12px 40px rgba(62,100,72,.12)',
        'card-steel':   '0 12px 40px rgba(92,154,184,.10)',
        'card-cranberry': '0 12px 40px rgba(168,82,104,.09)',
        'float': '0 1px 3px rgba(0,0,0,.04),0 12px 32px rgba(0,0,0,.07)',
      },
      borderRadius: {
        'ds-sm':   '4px',
        'ds-btn':  '7px',
        'ds-card': '12px',
      },
    },
  },
  plugins: [],
};
