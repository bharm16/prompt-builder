/**
 * useResponsiveLayout - Responsive breakpoints and padding
 *
 * Manages responsive layout state based on window width:
 * - Breakpoint detection (mobile, tablet, desktop)
 * - Dynamic padding calculation using wizardTheme
 * - Window resize listener with cleanup
 *
 * @module useResponsiveLayout
 */

import { useState, useEffect } from 'react';
import { wizardTheme } from '../../../../styles/wizardTheme';

const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
};

/**
 * Custom hook for responsive layout management
 * @returns {Object} Layout state and padding values
 */
export function useResponsiveLayout() {
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

  // Calculate responsive padding values using wizardTheme
  const cardPadding = isDesktop
    ? wizardTheme.getCardPadding('desktop')
    : isTablet
    ? wizardTheme.getCardPadding('tablet')
    : wizardTheme.getCardPadding('mobile');

  const containerPadding = wizardTheme.getContainerPadding(
    isDesktop ? 'desktop' : isTablet ? 'tablet' : 'mobile'
  );

  return {
    isDesktop,
    isTablet,
    cardPadding,
    containerPadding,
  };
}

