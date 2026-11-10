/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#18181b',
        'surface-elevated': '#27272a',
        border: '#27272a',
        primary: '#fafafa',
        secondary: '#a1a1aa',
      },
    },
  },
  plugins: [],
};
