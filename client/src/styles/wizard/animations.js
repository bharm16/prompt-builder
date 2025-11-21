/**
 * Animation Utilities
 */

export const ANIMATIONS = {
  /**
   * Floating animation for elements
   */
  float: {
    animation: 'float 6s ease-in-out infinite',
    '@keyframes float': {
      '0%, 100%': { transform: 'translateY(0px)' },
      '50%': { transform: 'translateY(-20px)' }
    }
  },

  /**
   * Pulse glow animation
   */
  pulseGlow: (color) => ({
    animation: 'pulseGlow 2s ease-in-out infinite',
    '@keyframes pulseGlow': {
      '0%, 100%': { boxShadow: `0 0 0 0 ${color}00` },
      '50%': { boxShadow: `0 0 20px 10px ${color}40` }
    }
  }),

  /**
   * Shimmer effect for buttons/cards
   */
  shimmer: {
    overflow: 'hidden',
    position: 'relative',
    '::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: '-100%',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
      animation: 'shimmer 2s infinite'
    },
    '@keyframes shimmer': {
      '0%': { left: '-100%' },
      '100%': { left: '100%' }
    }
  }
};

