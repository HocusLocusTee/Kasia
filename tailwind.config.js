/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        modalFadeIn: {
          'from': { opacity: '0', transform: 'translateY(-20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
} 