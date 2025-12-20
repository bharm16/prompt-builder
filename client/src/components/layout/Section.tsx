/**
 * Section Component (Geist Design System)
 * 
 * Section provides a consistent vertical spacing between the larger parts of
 * your page content, creating a sense of hierarchy and separation. Uses Geist
 * spacing tokens for consistent rhythm.
 * 
 * Based on: https://vercel.com/geist
 */

import React from 'react';
import { Box, type BoxProps } from './Box';

export interface SectionProps extends BoxProps {
  /**
   * Section spacing size
   * Controls the margin-bottom spacing using Geist spacing scale
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Custom spacing value (supports Geist tokens: geist-quarter, geist-half, geist-base)
   */
  spacing?: string;
}

/**
 * Geist section spacing values
 * Based on Geist spacing scale (pt units: 1pt = 1.333px)
 */
const sectionSpacing = {
  xs: 'geist-half',    // 8pt (~11px) - tight spacing
  sm: 'geist-base',    // 16pt (~21px) - standard spacing
  md: '32pt',          // ~43px - medium spacing
  lg: '48pt',          // ~64px - large spacing
  xl: '64pt',          // ~85px - extra large spacing
};

export const Section = React.forwardRef<HTMLDivElement, SectionProps>(
  (
    {
      size = 'md',
      spacing,
      className = '',
      mb,
      children,
      ...boxProps
    },
    ref
  ): React.ReactElement => {
    // Use custom spacing if provided, otherwise use size-based spacing
    // Support both Geist tokens and standard values
    const sectionMarginBottom = spacing || (mb ? undefined : sectionSpacing[size]);
    const resolvedMarginBottom = sectionMarginBottom ?? mb;

    return (
      <Box
        ref={ref}
        className={className}
        {...(resolvedMarginBottom !== undefined ? { mb: resolvedMarginBottom } : {})}
        {...boxProps}
      >
        {children}
      </Box>
    );
  }
);

Section.displayName = 'Section';

export default Section;
