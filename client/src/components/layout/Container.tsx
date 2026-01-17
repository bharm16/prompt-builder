/**
 * Container Component (PromptStudio System)
 *
 * Container's sole responsibility is to provide a consistent max-width to the
 * content it wraps.
 */

import React from 'react';
import { Box, type BoxProps } from './Box';

export interface ContainerProps extends BoxProps {
  /**
   * Container size variant
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  
  /**
   * Custom max width
   */
  maxWidth?: string;
}

/**
 * Container sizes
 */
const containerSizes = {
  sm: 'var(--ps-container-sm)', // Small content
  md: 'var(--ps-container-md)', // Medium content
  lg: 'var(--ps-container-lg)', // Large content (common)
  xl: 'var(--ps-container-xl)', // Extra large
  '2xl': 'var(--ps-container-2xl)', // Maximum width
  full: '100%', // Full width
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
