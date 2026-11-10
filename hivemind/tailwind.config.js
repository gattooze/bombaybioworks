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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
