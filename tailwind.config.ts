/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cosmic Design System Colors
        cosmic: {
          primary: '#ff1744',
          secondary: '#e91e63',
          accent: '#f06292',
          background: '#1a1625',
          card: 'rgba(255, 255, 255, 0.1)',
          border: 'rgba(255, 255, 255, 0.3)',
          'border-focus': 'rgba(255, 255, 255, 0.6)',
          text: {
            primary: '#ffffff',
            secondary: 'rgba(255, 255, 255, 0.7)',
            muted: 'rgba(255, 255, 255, 0.5)',
          }
        },
        // Utility colors
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'cosmic-logo': ['32px', { lineHeight: '1.2', letterSpacing: '2px' }],
        'cosmic-heading': ['24px', { lineHeight: '1.3' }],
        'cosmic-body': ['16px', { lineHeight: '1.5' }],
        'cosmic-label': ['14px', { lineHeight: '1.4' }],
      },
      spacing: {
        'cosmic-card': '24px',
        'cosmic-input': '12px 16px',
        'cosmic-button': '12px 24px',
      },
      borderRadius: {
        'cosmic': '16px',
        'cosmic-card': '16px',
        'cosmic-input': '8px',
        'cosmic-button': '8px',
      },
      backdropBlur: {
        'cosmic': '15px',
      },
      boxShadow: {
        'cosmic': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'cosmic-hover': '0 12px 48px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'mobile-slide-up': 'mobileSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        mobileSlideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      screens: {
        'xs': '480px',
        'mobile-l': '425px',
        'mobile-m': '375px',
        'mobile-s': '320px',
      },
    },
  },
  plugins: [
    // Add custom Tailwind plugins for cosmic design system
    function({ addUtilities }: { addUtilities: any }) {
      const newUtilities = {
        '.cosmic-bg': {
          'background-image': 'url("/starry-background.jpg")',
          'background-size': 'cover',
          'background-position': 'center',
          'background-attachment': 'fixed',
          'background-repeat': 'no-repeat',
          'min-height': '100vh',
          'background-color': '#1a1625',
        },
        '.cosmic-card': {
          'background': 'rgba(255, 255, 255, 0.3)',
          'backdrop-filter': 'blur(15px)',
          '-webkit-backdrop-filter': 'blur(15px)',
          'border-radius': '16px',
          'border': '1px solid rgba(255, 255, 255, 0.4)',
          'padding': '24px',
          'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
        '.cosmic-glass': {
          'background': 'rgba(255, 255, 255, 0.1)',
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.2)',
        },
        '.touch-target': {
          'min-height': '44px',
          'min-width': '44px',
        },
        '.mobile-optimized': {
          '@screen sm': {
            'font-size': '16px !important', // Prevent zoom on iOS
          }
        }
      }
      addUtilities(newUtilities)
    }
  ],
}

export default config