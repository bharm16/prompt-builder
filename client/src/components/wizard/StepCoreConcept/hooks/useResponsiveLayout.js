/**
 * useResponsiveLayout - Responsive breakpoints and padding
 *
 * Manages responsive layout state based on window width:
 * - Breakpoint detection (mobile, tablet, desktop)
 * - Dynamic padding calculation
 * - Window resize listener with cleanup
 *
 * @module useResponsiveLayout
 */

import { useState, useEffect } from "react";
import { BREAKPOINTS, RESPONSIVE_PADDING } from "../config/constants";

/**
 * Custom hook for responsive layout management
 * @returns {Object} Layout state and padding values
 * @returns {boolean} returns.isDesktop - True if viewport >= 1024px
 * @returns {boolean} returns.isTablet - True if viewport >= 768px
 * @returns {string} returns.containerPadding - Dynamic container padding
 * @returns {string} returns.cardPadding - Dynamic card padding
 */
export function useResponsiveLayout() {
  // Responsive spacing state
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= BREAKPOINTS.desktop : true
  );
  const [isTablet, setIsTablet] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= BREAKPOINTS.tablet : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= BREAKPOINTS.desktop);
      setIsTablet(window.innerWidth >= BREAKPOINTS.tablet);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate responsive padding values
  const containerPadding = isDesktop
    ? RESPONSIVE_PADDING.container.desktop
    : isTablet
    ? RESPONSIVE_PADDING.container.tablet
    : RESPONSIVE_PADDING.container.mobile;

  const cardPadding = isDesktop
    ? RESPONSIVE_PADDING.card.desktop
    : isTablet
    ? RESPONSIVE_PADDING.card.tablet
    : RESPONSIVE_PADDING.card.mobile;

  return {
    isDesktop,
    isTablet,
    containerPadding,
    cardPadding,
  };
}
