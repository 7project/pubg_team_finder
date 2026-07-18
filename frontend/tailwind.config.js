module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF6B00',
          50: '#FFF5E6',
          100: '#FFE0BF',
          200: '#FFC999',
          300: '#FFB373',
          400: '#FF9C4D',
          500: '#FF6B00',
          600: '#CC5500',
          700: '#994000',
          800: '#662B00',
          900: '#331500',
        },
        background: {
          dark: '#1A1A1A',
          darker: '#121212',
          light: '#F5F5F5',
          lighter: '#FFFFFF',
        },
        military: {
          DEFAULT: '#4A5D4F',
          light: '#6B7D6F',
          dark: '#2E3D32',
        },
      },
      minHeight: {
        'button': '44px',
      },
    },
  },
  plugins: [],
}