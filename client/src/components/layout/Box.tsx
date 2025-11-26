/**
 * Box Component (Radix UI Themes inspired)
 * 
 * The most fundamental layout component. Box is used to:
 * - Provide spacing to child elements
 * - Impose sizing constraints on content
 * - Control layout behaviour within flex and grid containers
 * - Hide content based on screen size using responsive display prop
 * 
 * Based on: https://www.radix-ui.com/themes/docs/overview/layout
 */

import React from 'react';
import type { HTMLAttributes } from 'react';

export interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Padding - can use space scale steps or any valid CSS padding value
   * Supports responsive object: { sm: '4', lg: '6' }
   */
  p?: string | { [key: string]: string };
  px?: string | { [key: string]: string };
  py?: string | { [key: string]: string };
  pt?: string | { [key: string]: string };
  pr?: string | { [key: string]: string };
  pb?: string | { [key: string]: string };
  pl?: string | { [key: string]: string };

  /**
   * Margin - can use space scale steps or any valid CSS margin value
   */
  m?: string | { [key: string]: string };
  mx?: string | { [key: string]: string };
  my?: string | { [key: string]: string };
  mt?: string | { [key: string]: string };
  mr?: string | { [key: string]: string };
  mb?: string | { [key: string]: string };
  ml?: string | { [key: string]: string };

  /**
   * Width - accepts any valid CSS width value
   */
  width?: string | { [key: string]: string };
  minWidth?: string | { [key: string]: string };
  maxWidth?: string | { [key: string]: string };

  /**
   * Height - accepts any valid CSS height value
   */
  height?: string | { [key: string]: string };
  minHeight?: string | { [key: string]: string };
  maxHeight?: string | { [key: string]: string };

  /**
   * Positioning
   */
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky' | { [key: string]: string };
  inset?: string | { [key: string]: string };
  top?: string | { [key: string]: string };
  right?: string | { [key: string]: string };
  bottom?: string | { [key: string]: string };
  left?: string | { [key: string]: string };

  /**
   * Display - responsive display control
   */
  display?: 'block' | 'inline-block' | 'inline' | 'flex' | 'inline-flex' | 'grid' | 'none' | { [key: string]: string };

  /**
   * Background color
   */
  backgroundColor?: string;

  /**
   * Border radius
   */
  borderRadius?: string;

  /**
   * Box shadow
   */
  boxShadow?: string;
}

/**
 * Converts responsive prop to Tailwind classes
 */
function getResponsiveClasses(
  prop: string | { [key: string]: string } | undefined,
  prefix: string
): string {
  if (!prop) return '';
  
  if (typeof prop === 'string') {
    // Handle Polaris spacing tokens
    if (prop.startsWith('polaris-')) {
      return `${prefix}-${prop}`;
    }
    // Handle regular spacing
    return `${prefix}-${prop}`;
  }

  // Handle responsive object
  const classes: string[] = [];
  Object.entries(prop).forEach(([breakpoint, value]) => {
    if (breakpoint === 'initial' || breakpoint === 'base') {
      classes.push(`${prefix}-${value}`);
    } else {
      classes.push(`${breakpoint}:${prefix}-${value}`);
    }
  });
  return classes.join(' ');
}

export const Box = React.forwardRef<HTMLDivElement, BoxProps>(
  (
    {
      p,
      px,
      py,
      pt,
      pr,
      pb,
      pl,
      m,
      mx,
      my,
      mt,
      mr,
      mb,
      ml,
      width,
      minWidth,
      maxWidth,
      height,
      minHeight,
      maxHeight,
      position,
      inset,
      top,
      right,
      bottom,
      left,
      display,
      backgroundColor,
      borderRadius,
      boxShadow,
      className = '',
      style = {},
      children,
      ...props
    },
    ref
  ): React.ReactElement => {
    // Build Tailwind classes
    const positionClass = typeof position === 'string' 
      ? (position === 'relative' ? 'relative' :
         position === 'absolute' ? 'absolute' :
         position === 'fixed' ? 'fixed' :
         position === 'sticky' ? 'sticky' :
         position === 'static' ? 'static' : '')
      : '';
    
    const displayClass = typeof display === 'string' 
      ? (display === 'none' ? 'hidden' : 
         display === 'block' ? 'block' : 
         display === 'inline-block' ? 'inline-block' : 
         display === 'inline' ? 'inline' : 
         display === 'flex' ? 'flex' : 
         display === 'inline-flex' ? 'inline-flex' : 
         display === 'grid' ? 'grid' : '')
      : '';
    
    const classes = [
      getResponsiveClasses(p, 'p'),
      getResponsiveClasses(px, 'px'),
      getResponsiveClasses(py, 'py'),
      getResponsiveClasses(pt, 'pt'),
      getResponsiveClasses(pr, 'pr'),
      getResponsiveClasses(pb, 'pb'),
      getResponsiveClasses(pl, 'pl'),
      getResponsiveClasses(m, 'm'),
      getResponsiveClasses(mx, 'mx'),
      getResponsiveClasses(my, 'my'),
      getResponsiveClasses(mt, 'mt'),
      getResponsiveClasses(mr, 'mr'),
      getResponsiveClasses(mb, 'mb'),
      getResponsiveClasses(ml, 'ml'),
      positionClass,
      displayClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // Build inline styles for properties not covered by Tailwind
    const inlineStyles: React.CSSProperties = {
      ...style,
      ...(width && typeof width === 'string' ? { width } : {}),
      ...(minWidth && typeof minWidth === 'string' ? { minWidth } : {}),
      ...(maxWidth && typeof maxWidth === 'string' ? { maxWidth } : {}),
      ...(height && typeof height === 'string' ? { height } : {}),
      ...(minHeight && typeof minHeight === 'string' ? { minHeight } : {}),
      ...(maxHeight && typeof maxHeight === 'string' ? { maxHeight } : {}),
      ...(inset && typeof inset === 'string' ? { inset } : {}),
      ...(top && typeof top === 'string' ? { top } : {}),
      ...(right && typeof right === 'string' ? { right } : {}),
      ...(bottom && typeof bottom === 'string' ? { bottom } : {}),
      ...(left && typeof left === 'string' ? { left } : {}),
      ...(backgroundColor ? { backgroundColor } : {}),
      ...(borderRadius ? { borderRadius } : {}),
      ...(boxShadow ? { boxShadow } : {}),
    };

    return (
      <div ref={ref} className={classes} style={inlineStyles} {...props}>
        {children}
      </div>
    );
  }
);

Box.displayName = 'Box';

export default Box;

