/**
 * Section Component (PromptStudio System)
 *
 * Section provides a consistent vertical spacing between the larger parts of
 * your page content, creating a sense of hierarchy and separation.
 */

import React from 'react';
import { Box, type BoxProps } from './Box';

export interface SectionProps extends BoxProps {
  /**
   * Section spacing size
   * Controls the margin-bottom spacing using system spacing scale
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Custom spacing value (supports system tokens: ps-1..ps-10)
   */
  spacing?: string;
}

/**
 * Section spacing values (system scale)
 */
const sectionSpacing = {
  xs: 'ps-3',  // 12px
  sm: 'ps-6',  // 24px
  md: 'ps-8',  // 40px
  lg: 'ps-9',  // 48px
  xl: 'ps-10', // 56px
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
