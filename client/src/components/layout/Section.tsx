/**
 * Section Component (Radix UI Themes inspired)
 * 
 * Section provides a consistent vertical spacing between the larger parts of
 * your page content, creating a sense of hierarchy and separation. There's
 * just a few pre-defined sizes for different spacing levels to keep things
 * simple and consistent.
 * 
 * Based on: https://www.radix-ui.com/themes/docs/overview/layout
 */

import React from 'react';
import { Box, type BoxProps } from './Box';

export interface SectionProps extends BoxProps {
  /**
   * Section spacing size
   * Controls the margin-bottom spacing
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Custom spacing value
   */
  spacing?: string;
}

const sectionSpacing = {
  xs: 'section-xs',  // 32px
  sm: 'section-sm', // 48px
  md: 'section-md',  // 64px
  lg: 'section-lg', // 96px
  xl: 'section-xl', // 128px
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
    const sectionMarginBottom = spacing || (mb ? undefined : sectionSpacing[size]);

    return (
      <Box
        ref={ref}
        mb={sectionMarginBottom || mb}
        className={className}
        {...boxProps}
      >
        {children}
      </Box>
    );
  }
);

Section.displayName = 'Section';

export default Section;

