import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5b6cff',
          dark: '#4955d6',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
