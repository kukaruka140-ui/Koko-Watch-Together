/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Основная палитра RAVE — глубокий тёмный с неоново-фиолетовым акцентом
        rave: {
          bg:       '#0A0A0F',   // фон приложения
          surface:  '#12121A',   // карточки и панели
          elevated: '#1A1A26',   // приподнятые элементы
          border:   '#2A2A3E',   // границы
          accent:   '#7C5CFC',   // основной акцент (фиолетовый)
          'accent-dim': '#5A3FD4',
          glow:     '#7C5CFC33', // полупрозрачный акцент для свечения
          text:     '#E8E8F0',   // основной текст
          muted:    '#6B6B8A',   // второстепенный текст
          host:     '#FF6B9D',   // цвет хоста в чате
          guest:    '#56CFE1',   // цвет гостя в чате
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif']
      },
      animation: {
        'float-up':     'floatUp 2.5s ease-out forwards',
        'fade-in':      'fadeIn 0.2s ease-out',
        'slide-up':     'slideUp 0.3s ease-out',
        'pulse-glow':   'pulseGlow 2s ease-in-out infinite',
        'bounce-in':    'bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
      },
      keyframes: {
        floatUp: {
          '0%':   { transform: 'translateY(0) scale(1)', opacity: '1' },
          '80%':  { opacity: '1' },
          '100%': { transform: 'translateY(-200px) scale(0.6)', opacity: '0' }
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' }
        },
        slideUp: {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to:   { transform: 'translateY(0)', opacity: '1' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px #7C5CFC33' },
          '50%':      { boxShadow: '0 0 20px #7C5CFC66' }
        },
        bounceIn: {
          from: { transform: 'scale(0.7)', opacity: '0' },
          to:   { transform: 'scale(1)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
};
