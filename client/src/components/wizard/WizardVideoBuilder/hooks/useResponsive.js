/**
 * useResponsive Hook
 * 
 * Detects screen size and provides responsive breakpoint information.
 */

import { useState, useEffect } from 'react';
import { BREAKPOINTS } from '../config/constants';

export function useResponsive() {
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < BREAKPOINTS.mobile : false
  );
  
  const [isTablet, setIsTablet] = useState(() => 
    typeof window !== 'undefined' 
      ? window.innerWidth >= BREAKPOINTS.mobile && window.innerWidth < BREAKPOINTS.tablet
      : false
  );

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= BREAKPOINTS.desktop : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < BREAKPOINTS.mobile);
      setIsTablet(width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet);
      setIsDesktop(width >= BREAKPOINTS.desktop);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop,
  };
}

