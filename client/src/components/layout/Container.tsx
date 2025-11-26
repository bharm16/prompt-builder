/**
 * Container Component (Radix UI Themes inspired)
 * 
 * Container's sole responsibility is to provide a consistent max-width to the
 * content it wraps. Like Section, it comes just with a couple of pre-defined
 * sizes that work well with common breakpoints and typical content widths for
 * comfortable reading.
 * 
 * Based on: https://www.radix-ui.com/themes/docs/overview/layout
 */

import React from 'react';
import { Box, type BoxProps } from './Box';

export interface ContainerProps extends BoxProps {
  /**
   * Container size variant
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  
  /**
   * Custom max width
   */
  maxWidth?: string;
}

const containerSizes = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%',
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

