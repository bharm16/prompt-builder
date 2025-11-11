/**
 * Pattern Utilities
 * CSS-only background patterns inspired by Hero Patterns
 * No external dependencies or images required
 * 
 * Usage:
 * import { PATTERNS } from './patternUtils';
 * 
 * <div style={PATTERNS.dots('#3b82f6', 0.1)} />
 */

export const PATTERNS = {
  /**
   * Dots pattern - simple circular dots
   */
  dots: (color = '#3b82f6', opacity = 0.1) => ({
    backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
    opacity
  }),

  /**
   * Grid pattern - clean grid lines
   */
  grid: (color = '#3b82f6', opacity = 0.1) => ({
    backgroundImage: `
      linear-gradient(${color} 1px, transparent 1px),
      linear-gradient(90deg, ${color} 1px, transparent 1px)
    `,
    backgroundSize: '20px 20px',
    opacity
  }),

  /**
   * Diagonal lines pattern
   */
  diagonalLines: (color = '#3b82f6', opacity = 0.1) => ({
    backgroundImage: `repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      ${color} 10px,
      ${color} 11px
    )`,
    opacity
  }),

  /**
   * Zigzag pattern
   */
  zigzag: (color = '#3b82f6', opacity = 0.1) => ({
    backgroundImage: `
      linear-gradient(135deg, ${color} 25%, transparent 25%),
      linear-gradient(225deg, ${color} 25%, transparent 25%),
      linear-gradient(45deg, ${color} 25%, transparent 25%),
      linear-gradient(315deg, ${color} 25%, transparent 25%)
    `,
    backgroundPosition: '10px 0, 10px 0, 0 0, 0 0',
    backgroundSize: '10px 10px',
    backgroundRepeat: 'repeat',
    opacity
  }),

  /**
   * Topography pattern - organic flowing lines
   */
  topography: (color = '#3b82f6', opacity = 0.1) => ({
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${encodeURIComponent(color)}' fill-opacity='${opacity}'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
  }),

  /**
   * Circuit pattern - tech-inspired
   */
  circuit: (color = '#3b82f6', opacity = 0.1) => ({
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='${encodeURIComponent(color)}' fill-opacity='${opacity}' fill-rule='evenodd'/%3E%3C/svg%3E")`
  }),

  /**
   * Plus pattern - simple crosses
   */
  plus: (color = '#3b82f6', opacity = 0.1) => ({
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${encodeURIComponent(color)}' fill-opacity='${opacity}'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
  }),

  /**
   * Boxes pattern - 3D cubes
   */
  boxes: (color = '#3b82f6', opacity = 0.1) => ({
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z' fill='${encodeURIComponent(color)}' fill-opacity='${opacity}' fill-rule='evenodd'/%3E%3C/svg%3E")`,
  })
};

/**
 * Gradient generators for card backgrounds
 */
export const GRADIENTS = {
  /**
   * Subtle mesh gradient
   */
  mesh: (color1, color2, color3) => ({
    background: `
      radial-gradient(at 0% 0%, ${color1} 0px, transparent 50%),
      radial-gradient(at 100% 0%, ${color2} 0px, transparent 50%),
      radial-gradient(at 100% 100%, ${color3} 0px, transparent 50%)
    `
  }),

  /**
   * Soft gradient with direction
   */
  soft: (from, to, direction = '135deg') => ({
    background: `linear-gradient(${direction}, ${from}, ${to})`
  }),

  /**
   * Glass effect background
   */
  glass: (color, opacity = 0.8) => ({
    background: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)'
  })
};

/**
 * Animation utilities
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

/**
 * Pre-configured color schemes for different field types
 */
export const COLOR_SCHEMES = {
  subject: {
    gradient: { from: '#dbeafe', to: '#e0e7ff' },
    icon: { from: '#3b82f6', to: '#6366f1' },
    glow: '#60a5fa',
    pattern: '#3b82f6'
  },
  action: {
    gradient: { from: '#fae8ff', to: '#fce7f3' },
    icon: { from: '#a855f7', to: '#ec4899' },
    glow: '#c084fc',
    pattern: '#a855f7'
  },
  location: {
    gradient: { from: '#d1fae5', to: '#d9f99d' },
    icon: { from: '#10b981', to: '#84cc16' },
    glow: '#34d399',
    pattern: '#10b981'
  },
  time: {
    gradient: { from: '#fef3c7', to: '#fed7aa' },
    icon: { from: '#f59e0b', to: '#f97316' },
    glow: '#fbbf24',
    pattern: '#f59e0b'
  },
  mood: {
    gradient: { from: '#fecaca', to: '#fecdd3' },
    icon: { from: '#ef4444', to: '#f43f5e' },
    glow: '#f87171',
    pattern: '#ef4444'
  },
  style: {
    gradient: { from: '#e0e7ff', to: '#ddd6fe' },
    icon: { from: '#6366f1', to: '#8b5cf6' },
    glow: '#818cf8',
    pattern: '#6366f1'
  },
  descriptors: {
    gradient: { from: '#fbcfe8', to: '#fae8ff' },
    icon: { from: '#ec4899', to: '#d946ef' },
    glow: '#f472b6',
    pattern: '#ec4899'
  },
  event: {
    gradient: { from: '#ccfbf1', to: '#cffafe' },
    icon: { from: '#14b8a6', to: '#06b6d4' },
    glow: '#2dd4bf',
    pattern: '#14b8a6'
  }
};

/**
 * Helper function to get all styles for a field type
 */
export const getFieldStyles = (fieldType, patternType = 'dots') => {
  const scheme = COLOR_SCHEMES[fieldType] || COLOR_SCHEMES.subject;
  
  return {
    gradientFrom: scheme.gradient.from,
    gradientTo: scheme.gradient.to,
    iconGradientFrom: scheme.icon.from,
    iconGradientTo: scheme.icon.to,
    glowColor: scheme.glow,
    pattern: PATTERNS[patternType](scheme.pattern, 0.3)
  };
};

export default {
  PATTERNS,
  GRADIENTS,
  ANIMATIONS,
  COLOR_SCHEMES,
  getFieldStyles
};

