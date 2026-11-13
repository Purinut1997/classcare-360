/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Noto Sans Thai',
          'Anuphan',
          'Sarabun',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'Anuphan',
          'Noto Sans Thai',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        linen: {
          DEFAULT: '#F6F7F3',
          soft: '#FAFBF8',
          muted: '#EDF1EA',
          border: '#DCE3D7',
        },
        sage: {
          DEFAULT: '#2F7D5B',
          dark: '#1C573D',
          soft: '#E6F4EC',
          forest: '#1C342B',
          'forest-deep': '#152821',
        },
        botanical: {
          ink: '#1F2A22',
          muted: '#5B6A5F',
          honey: '#D98B26',
          'honey-soft': '#FDF4E1',
          stream: '#2D72A3',
          'stream-soft': '#E9F3FA',
          rose: '#C25970',
          'rose-soft': '#FBEFF2',
          lavender: '#6B63B5',
          'lavender-soft': '#F1F0FA',
        },
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(31, 42, 34, 0.04)',
        xs: '0 1px 2px 0 rgba(31, 42, 34, 0.05)',
        soft: '0 14px 36px rgba(28, 52, 43, 0.07)',
      },
    },
  },
  plugins: [],
};
