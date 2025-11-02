/**
 * Animation Configurations for StepQuickFill
 *
 * CSS keyframe animations and timing functions for:
 * - Staggered entrance animations
 * - Floating label transitions
 * - Success checkmark bounce
 * - Shimmer effects
 *
 * @module animations
 */

/**
 * CSS keyframes for animations
 * Injected as inline <style> tag
 */
export const ANIMATION_KEYFRAMES = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes bounceIn {
    0% { transform: translateY(-50%) scale(0); }
    50% { transform: translateY(-50%) scale(1.2); }
    100% { transform: translateY(-50%) scale(1); }
  }

  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

/**
 * Inject animation keyframes into document
 * SSR-safe - only runs in browser
 */
export function injectAnimations() {
  if (typeof document === 'undefined') return;

  const styleId = 'step-quickfill-animations';
  if (document.getElementById(styleId)) return; // Already injected

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = ANIMATION_KEYFRAMES;
  document.head.appendChild(style);
}

/**
 * Animation timing functions
 */
export const ANIMATION_TIMING = {
  easeOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

/**
 * Animation durations (ms)
 */
export const ANIMATION_DURATION = {
  fast: 200,
  base: 300,
  slow: 400,
  shimmer: 3000,
};
