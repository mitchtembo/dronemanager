/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0E1A',
          surface: '#111827',
          elevated: '#1C2333',
        },
        border: { DEFAULT: '#2D3748' },
        accent: { DEFAULT: '#3B82F6' },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
        text: {
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        }
      },
      fontFamily: {
        heading: ['"Rajdhani"', '"Barlow Condensed"', 'sans-serif'],
        data: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
        sans: ['"Inter"', '"DM Sans"', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': 'radial-gradient(circle, #2D3748 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-pattern': '24px 24px',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        }
      }
    },
  },
  plugins: [],
}
