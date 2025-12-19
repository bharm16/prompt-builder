/**
 * Box Component (Geist Design System)
 * 
 * The most fundamental layout component. Box is used to:
 * - Provide spacing to child elements using Geist spacing tokens
 * - Impose sizing constraints on content
 * - Control layout behaviour within flex and grid containers
 * - Hide content based on screen size using responsive display prop
 * 
 * Geist spacing tokens: quarter (4pt), half (8pt), base (16pt)
 * Supports both Geist tokens (geist-quarter, geist-half, geist-base) and standard spacing values
 * 
 * Based on: https://vercel.com/geist
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
/**
 * Geist spacing token mapping
 * Converts Geist tokens to CSS values
 */
const geistSpacingMap: Record<string, string> = {
  'geist-quarter': '4pt',   // ~5px
  'geist-half': '8pt',       // ~11px
  'geist-base': '16pt',      // ~21px
  'geist-page': '16pt',      // ~21px (page margin)
};

function getResponsiveClasses(
  prop: string | { [key: string]: string } | undefined,
  prefix: string
): string {
  if (!prop) return '';
  
  if (typeof prop === 'string') {
    // Handle Geist spacing tokens
    if (prop.startsWith('geist-')) {
      const geistValue = geistSpacingMap[prop];
      if (geistValue) {
        // Return empty string - we'll handle Geist tokens via inline styles
        return '';
      }
    }
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
      if (typeof value === 'string' && value.startsWith('geist-')) {
        // Skip Geist tokens in classes, handle via inline styles
        return;
      }
      classes.push(`${prefix}-${value}`);
    } else {
      if (typeof value === 'string' && value.startsWith('geist-')) {
        return;
      }
      classes.push(`${breakpoint}:${prefix}-${value}`);
    }
  });
  return classes.join(' ');
}

/**
 * Get Geist spacing value for inline styles
 */
function getGeistSpacingValue(prop: string | { [key: string]: string } | undefined): string | undefined {
  if (!prop) return undefined;
  
  if (typeof prop === 'string' && prop.startsWith('geist-')) {
    return geistSpacingMap[prop];
  }
  
  return undefined;
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

    // Handle Geist spacing tokens via inline styles
    const geistPadding = getGeistSpacingValue(p);
    const geistPaddingX = getGeistSpacingValue(px);
    const geistPaddingY = getGeistSpacingValue(py);
    const geistPaddingTop = getGeistSpacingValue(pt);
    const geistPaddingRight = getGeistSpacingValue(pr);
    const geistPaddingBottom = getGeistSpacingValue(pb);
    const geistPaddingLeft = getGeistSpacingValue(pl);
    const geistMargin = getGeistSpacingValue(m);
    const geistMarginX = getGeistSpacingValue(mx);
    const geistMarginY = getGeistSpacingValue(my);
    const geistMarginTop = getGeistSpacingValue(mt);
    const geistMarginRight = getGeistSpacingValue(mr);
    const geistMarginBottom = getGeistSpacingValue(mb);
    const geistMarginLeft = getGeistSpacingValue(ml);

    // Build inline styles for properties not covered by Tailwind
    const inlineStyles: React.CSSProperties = {
      ...style,
      ...(geistPadding ? { padding: geistPadding } : {}),
      ...(geistPaddingX ? { paddingLeft: geistPaddingX, paddingRight: geistPaddingX } : {}),
      ...(geistPaddingY ? { paddingTop: geistPaddingY, paddingBottom: geistPaddingY } : {}),
      ...(geistPaddingTop ? { paddingTop: geistPaddingTop } : {}),
      ...(geistPaddingRight ? { paddingRight: geistPaddingRight } : {}),
      ...(geistPaddingBottom ? { paddingBottom: geistPaddingBottom } : {}),
      ...(geistPaddingLeft ? { paddingLeft: geistPaddingLeft } : {}),
      ...(geistMargin ? { margin: geistMargin } : {}),
      ...(geistMarginX ? { marginLeft: geistMarginX, marginRight: geistMarginX } : {}),
      ...(geistMarginY ? { marginTop: geistMarginY, marginBottom: geistMarginY } : {}),
      ...(geistMarginTop ? { marginTop: geistMarginTop } : {}),
      ...(geistMarginRight ? { marginRight: geistMarginRight } : {}),
      ...(geistMarginBottom ? { marginBottom: geistMarginBottom } : {}),
      ...(geistMarginLeft ? { marginLeft: geistMarginLeft } : {}),
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

