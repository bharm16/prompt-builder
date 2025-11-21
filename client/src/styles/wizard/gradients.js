/**
 * Gradient Generators for Card Backgrounds
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

