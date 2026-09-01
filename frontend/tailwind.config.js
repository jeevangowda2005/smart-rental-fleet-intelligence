/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cat: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde047',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          accent: '#eab308',
        },
        industrial: {
          bg: '#0B0F17',
          card: '#131A27',
          border: '#1E293B',
          hover: '#1E293D',
          muted: '#64748B',
          highlight: '#F59E0B'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
