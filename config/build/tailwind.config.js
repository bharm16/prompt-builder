import path from 'path';
import { fileURLToPath } from 'url';
import promptStudioPreset from '@promptstudio/system/tailwind.preset';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.resolve(__dirname, '../../client/index.html'),
    path.resolve(__dirname, '../../client/src/**/*.{js,ts,jsx,tsx}'),
    // Include design-system components (Tailwind classes live there)
    path.resolve(
      __dirname,
      '../../packages/promptstudio-system/src/**/*.{js,ts,jsx,tsx}'
    ),
  ],
  darkMode: false, // Disable dark mode completely
  presets: [promptStudioPreset],
  theme: {
    extend: {
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
        'border-pulse': 'borderPulse 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        // Enhanced mockup animations
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-slide-in': 'fadeSlideIn 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in-bounce': 'scaleInBounce 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-from-right': 'slideFromRight 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-from-bottom': 'slideFromBottom 350ms cubic-bezier(0.4, 0, 0.2, 1)',
        // Mesh gradient blob animation
        'blob': 'blob 20s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', filter: 'blur(4px)' },
          '100%': { opacity: '1', filter: 'blur(0)' },
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
        borderPulse: {
          '0%, 100%': {
            borderColor: 'color-mix(in srgb, var(--ps-accent) 50%, transparent)',
            boxShadow: '0 0 0 0 color-mix(in srgb, var(--ps-accent) 0%, transparent)',
          },
          '50%': {
            borderColor: 'color-mix(in srgb, var(--ps-accent) 80%, transparent)',
            boxShadow: '0 0 8px 0 color-mix(in srgb, var(--ps-accent) 15%, transparent)',
          },
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
        // Blob animation for mesh gradient background
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(20px, -50px) scale(1.1)' },
          '50%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '75%': { transform: 'translate(50px, 50px) scale(1.05)' },
        },
      },

      // ============================================
      // BREAKPOINTS (using default Tailwind)
      // sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px
      // ============================================

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

    },
  },
  plugins: [],
};
