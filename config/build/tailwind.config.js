import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.resolve(__dirname, '../../client/index.html'),
    path.resolve(__dirname, '../../client/src/**/*.{js,ts,jsx,tsx}'),
  ],
  darkMode: false, // Disable dark mode completely
  theme: {
    extend: {
      // ============================================
      // COLOR SYSTEM - Airbnb DLS Aligned
      // Calm neutrals, confident accent, accessible contrast
      // ============================================
      colors: {
        // PRIMARY NEUTRAL SCALE (Charcoal / Ink)
        primary: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E6E6E6',
          300: '#D4D4D4',
          400: '#A8A8A8',
          500: '#7A7A7A',
          600: '#484848', // ⭐ MAIN - Headings / body text
          700: '#363636',
          800: '#222222', // Ink
          900: '#161616',
          950: '#0B0B0B',
        },

        // ACCENT SCALE (Rausch)
        accent: {
          50: '#FFF5F7',
          100: '#FFE3EA',
          200: '#FFC0CC',
          300: '#FF98AF',
          400: '#FF6D8C',
          500: '#FF385C', // ⭐ MAIN CTA
          600: '#E03252',
          700: '#C12745',
          800: '#971E36',
          900: '#711628',
          950: '#4C0E1C',
        },

        // SUPPORT SCALE (Teal)
        secondary: {
          50: '#E5FFFA',
          100: '#C0FFF1',
          200: '#8EFFE6',
          300: '#5AF6D8',
          400: '#2DE8C6',
          500: '#00A699', // ⭐ Support / success
          600: '#008C82',
          700: '#00736A',
          800: '#005953',
          900: '#00433F',
          950: '#012E2B',
        },

        // NEUTRAL BACKGROUND SCALE (Cloud to Charcoal)
        neutral: {
          50: '#FFFFFF',
          100: '#F7F7F7', // Cloud
          200: '#EFEFEF',
          300: '#E3E3E3',
          400: '#CFCFCF',
          500: '#B9B9B9',
          600: '#989898',
          700: '#787878',
          800: '#575757',
          900: '#373737',
          950: '#1B1B1B',
        },

        // SEMANTIC COLORS - Teal-based success
        success: {
          50: '#E8FFF8',
          100: '#C5FCEB',
          200: '#8FF8D7',
          300: '#59EDC0',
          400: '#2FDAAB',
          500: '#00B88F',
          600: '#009C79',
          700: '#007D62',
          800: '#005F4A',
          900: '#004838',
          950: '#002F25',
        },

        // SEMANTIC COLORS - Warm amber warnings
        warning: {
          50: '#FFF8EB',
          100: '#FFECCA',
          200: '#FFD79A',
          300: '#FFC066',
          400: '#FFAA3D',
          500: '#F7931E',
          600: '#D77C16',
          700: '#B1650F',
          800: '#8C4E0B',
          900: '#6A3A08',
          950: '#422206',
        },

        // SEMANTIC COLORS - Rosé error
        error: {
          50: '#FFF2F4',
          100: '#FFE3E7',
          200: '#FFBFC8',
          300: '#FF92A3',
          400: '#FF627C',
          500: '#F44366',
          600: '#DB2C53',
          700: '#B71F3D',
          800: '#901832',
          900: '#6B1125',
          950: '#420916',
        },

        // SEMANTIC COLORS - Calm info
        info: {
          50: '#EDF7FF',
          100: '#D6ECFF',
          200: '#ADD6FF',
          300: '#7AB8FF',
          400: '#4F9FFF',
          500: '#1F82FF',
          600: '#1664D6',
          700: '#114CAA',
          800: '#0B347A',
          900: '#072352',
          950: '#041633',
        },

        // Design token aliases for backwards compatibility
        'brand-primary': {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E6E6E6',
          300: '#D4D4D4',
          400: '#A8A8A8',
          500: '#7A7A7A',
          600: '#484848',
          700: '#363636',
          800: '#222222',
          900: '#161616',
          950: '#0B0B0B',
        },
        'brand-accent': {
          50: '#FFF5F7',
          100: '#FFE3EA',
          200: '#FFC0CC',
          300: '#FF98AF',
          400: '#FF6D8C',
          500: '#FF385C',
          600: '#E03252',
          700: '#C12745',
          800: '#971E36',
          900: '#711628',
          950: '#4C0E1C',
        },
        'surface-base': '#FFFFFF',
        'surface-subtle': '#F7F7F7',
        'surface-elevated': '#FFFFFF',
        'surface-overlay': 'rgba(255, 255, 255, 0.85)',
        'text-ink': '#222222',
        'text-charcoal': '#484848',
        'text-muted': '#6F6F6F',
        'text-subtle': '#949494',
        'border-default': '#E3E3E3',
        'border-strong': '#CFCFCF',
        'border-accent': '#FF385C',
        'ui-background': '#F7F7F7',
        'ui-surface': '#FFFFFF',
        'text-primary': '#222222',
        'text-secondary': '#484848',
        'borders-lines': '#E3E3E3',
      },

      // ============================================
      // TYPOGRAPHY SYSTEM
      // Harmonious type scale with proper hierarchy
      // ============================================
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Menlo',
          'Monaco',
          'Courier New',
          'monospace',
        ],
      },
      fontSize: {
        // Display sizes
        'display-2xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-sm': ['1.875rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],

        // Text sizes
        'text-xl': ['1.25rem', { lineHeight: '1.75', letterSpacing: '0', fontWeight: '400' }],
        'text-lg': ['1.125rem', { lineHeight: '1.75', letterSpacing: '0', fontWeight: '400' }],
        'text-md': ['1rem', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'text-sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'text-xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '400' }],
      },

      // ============================================
      // SPACING SYSTEM
      // 4px base unit with consistent scale
      // ============================================
      spacing: {
        0.5: '0.125rem', // 2px
        1: '0.25rem', // 4px
        1.5: '0.375rem', // 6px
        2: '0.5rem', // 8px
        2.5: '0.625rem', // 10px
        3: '0.75rem', // 12px
        3.5: '0.875rem', // 14px
        4: '1rem', // 16px
        5: '1.25rem', // 20px
        6: '1.5rem', // 24px
        7: '1.75rem', // 28px
        8: '2rem', // 32px
        9: '2.25rem', // 36px
        10: '2.5rem', // 40px
        11: '2.75rem', // 44px
        12: '3rem', // 48px
        14: '3.5rem', // 56px
        16: '4rem', // 64px
        20: '5rem', // 80px
        24: '6rem', // 96px
        28: '7rem', // 112px
        32: '8rem', // 128px
        36: '9rem', // 144px
        40: '10rem', // 160px
        44: '11rem', // 176px
        48: '12rem', // 192px
        52: '13rem', // 208px
        56: '14rem', // 224px
        60: '15rem', // 240px
        64: '16rem', // 256px
        72: '18rem', // 288px
        80: '20rem', // 320px
        96: '24rem', // 384px
      },

      // ============================================
      // BORDER RADIUS SYSTEM
      // Consistent corner rounding
      // ============================================
      borderRadius: {
        none: '0',
        sm: '0.25rem', // 4px
        DEFAULT: '0.375rem', // 6px
        md: '0.5rem', // 8px
        lg: '0.75rem', // 12px
        xl: '1rem', // 16px
        '2xl': '1.25rem', // 20px
        '3xl': '1.5rem', // 24px
        full: '9999px',
      },

      // ============================================
      // SHADOW SYSTEM - Airbnb DLS Inspired
      // Sophisticated elevation with proper depth
      // ============================================
      boxShadow: {
        'none': 'none',
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        // Focus shadows
        'focus': '0 0 0 3px rgb(99 102 241 / 0.3)',
        'focus-accent': '0 0 0 3px rgb(99 102 241 / 0.3)',
        'focus-error': '0 0 0 3px rgb(244 63 94 / 0.3)',
        'focus-success': '0 0 0 3px rgb(16 185 129 / 0.3)',
        // Colored shadows for CTAs
        'primary': '0 10px 15px -3px rgb(99 102 241 / 0.3)',
        'accent': '0 10px 15px -3px rgb(99 102 241 / 0.3)',
        'success': '0 10px 15px -3px rgb(16 185 129 / 0.3)',
      },

      // ============================================
      // ANIMATION & TRANSITIONS
      // Consistent timing and easing
      // ============================================
      transitionDuration: {
        75: '75ms',
        100: '100ms',
        150: '150ms',
        200: '200ms',
        250: '250ms',
        300: '300ms',
        400: '400ms',
        500: '500ms',
        700: '700ms',
        1000: '1000ms',
      },
      transitionTimingFunction: {
        'ease-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'ease-spring': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'ease-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up': 'slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideDown 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
        // Enhanced mockup animations
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-slide-in': 'fadeSlideIn 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in-bounce': 'scaleInBounce 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-from-right': 'slideFromRight 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-from-bottom': 'slideFromBottom 350ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        // Enhanced mockup keyframes
        pulseSubtle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.95', transform: 'scale(1.03)' },
        },
        fadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleInBounce: {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideFromRight: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideFromBottom: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },

      // ============================================
      // BREAKPOINTS (using default Tailwind)
      // sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px
      // ============================================

      // ============================================
      // Z-INDEX SCALE
      // Consistent layering system
      // ============================================
      zIndex: {
        0: '0',
        10: '10',
        20: '20',
        30: '30',
        40: '40',
        50: '50',
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'toast': '1080',
      },

      // ============================================
      // CONTAINER
      // Max width container with consistent padding
      // ============================================
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1.5rem',
          lg: '2rem',
          xl: '2.5rem',
          '2xl': '3rem',
        },
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1400px',
        },
      },

      // ============================================
      // OPACITY SCALE
      // Consistent transparency levels
      // ============================================
      opacity: {
        0: '0',
        5: '0.05',
        10: '0.1',
        15: '0.15',
        20: '0.2',
        25: '0.25',
        30: '0.3',
        40: '0.4',
        50: '0.5',
        60: '0.6',
        70: '0.7',
        75: '0.75',
        80: '0.8',
        90: '0.9',
        95: '0.95',
        100: '1',
      },
    },
  },
  plugins: [],
};
