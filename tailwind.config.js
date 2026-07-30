/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        paper: '#FFFFFF',
        cream: '#FAFAF7',
        ink: '#1A1A1A',
        muted: '#6B6B66',
        line: '#E8E6E1',
        coral: {
          DEFAULT: '#FF4D2E',
          50: '#FFF1ED',
          100: '#FFE0D6',
          600: '#E63E1F',
        },
        forest: '#1F3A2E',
        ocean: '#3B5BA5',
        amber: '#E8A33D',
        danger: '#E11D2A',
        wechat: '#07C160',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(26,26,26,0.04), 0 8px 24px -12px rgba(26,26,26,0.12)',
        lift: '0 2px 6px rgba(26,26,26,0.06), 0 20px 40px -16px rgba(26,26,26,0.18)',
        coral: '0 8px 24px -8px rgba(255,77,46,0.45)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', opacity: '0.7' },
          '70%': { transform: 'scale(1.3)', opacity: '0' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        wave: {
          '0%,100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'pop-in': 'pop-in 0.32s cubic-bezier(0.22,1,0.36,1)',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.22,1,0.36,1)',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.22,1,0.36,1) infinite',
        wave: 'wave 1s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
