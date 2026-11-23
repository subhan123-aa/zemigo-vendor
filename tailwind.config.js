/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        zemigo: {
          green: '#16A34A',
          darkGreen: '#15803D',
          lightGreen: '#EAF7EF',
          pillGreen: '#DFF8E5',
          text: '#111827',
          muted: '#6B7280',
          border: '#ECEEF2',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 2px 12px rgba(15, 23, 42, 0.035)',
      },
    },
  },
  plugins: [],
};
