/**
 * Container Component (Geist Design System)
 * 
 * Container's sole responsibility is to provide a consistent max-width to the
 * content it wraps. Uses Geist's content width standards for optimal reading
 * and visual hierarchy.
 * 
 * Based on: https://vercel.com/geist
 */

import React from 'react';
import { Box, type BoxProps } from './Box';

export interface ContainerProps extends BoxProps {
  /**
   * Container size variant
   * Geist uses narrower content widths for optimal readability
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  
  /**
   * Custom max width
   */
  maxWidth?: string;
}

/**
 * Geist container sizes
 * Based on Vercel's content width standards
 */
const containerSizes = {
  sm: '640px',      // Small content
  md: '768px',      // Medium content
  lg: '1024px',     // Large content (common)
  xl: '1280px',     // Extra large
  '2xl': '1536px',  // Maximum width
  full: '100%',     // Full width
};

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      size = 'xl',
      maxWidth,
      className = '',
      style = {},
      children,
      ...boxProps
    },
    ref
  ): React.ReactElement => {
    const containerMaxWidth = maxWidth || containerSizes[size];
    
    const containerClasses = [
      'container',
      'mx-auto',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const inlineStyles: React.CSSProperties = {
      ...style,
      maxWidth: containerMaxWidth,
    };

    return (
      <Box
        ref={ref}
        className={containerClasses}
        style={inlineStyles}
        {...boxProps}
      >
        {children}
      </Box>
    );
  }
);

Container.displayName = 'Container';

export default Container;

