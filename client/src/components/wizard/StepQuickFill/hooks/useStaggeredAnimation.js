/**
 * useStaggeredAnimation - Entrance animation timing
 *
 * Manages mounted state for staggered entrance animations.
 * Fields animate in sequence based on their delay values.
 *
 * @module useStaggeredAnimation
 */

import { useState, useEffect } from 'react';

/**
 * Custom hook for staggered entrance animations
 * @returns {Object} Animation state
 * @returns {boolean} returns.mounted - True after component mounts (triggers animations)
 */
export function useStaggeredAnimation() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return { mounted };
}
