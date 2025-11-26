/**
 * Grid Component (Geist Design System)
 * 
 * Grid is used to organize the content in columns and rows. Like Box and Flex,
 * it's made to provide convenient access to the underlying CSS grid properties
 * without any magic of its own. Supports Geist spacing tokens for gaps.
 * 
 * Supports Geist gap tokens: geist-quarter, geist-half, geist-base
 * 
 * Based on: https://vercel.com/geist
 */

import React from 'react';
import { Box, type BoxProps } from './Box';

export interface GridProps extends BoxProps {
  /**
   * Grid columns - accepts CSS grid-template-columns value
   * Examples: "1fr", "repeat(3, 1fr)", "1fr 2fr", etc.
   */
  columns?: string | { [key: string]: string };
  
  /**
   * Grid rows - accepts CSS grid-template-rows value
   */
  rows?: string | { [key: string]: string };
  
  /**
   * Gap between grid items
   */
  gap?: string | { [key: string]: string };
  
  /**
   * Column gap
   */
  columnGap?: string | { [key: string]: string };
  
  /**
   * Row gap
   */
  rowGap?: string | { [key: string]: string };
  
  /**
   * Grid area
   */
  area?: string | { [key: string]: string };
  
  /**
   * Grid column
   */
  column?: string | { [key: string]: string };
  
  /**
   * Grid row
   */
  row?: string | { [key: string]: string };
}

function getGridClasses(prop: string | { [key: string]: string } | undefined, prefix: string): string {
  if (!prop) return '';
  
  if (typeof prop === 'string') {
    return `${prefix}-${prop}`;
  }

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

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      columns,
      rows,
      gap,
      columnGap,
      rowGap,
      area,
      column,
      row,
      className = '',
      style = {},
      ...boxProps
    },
    ref
  ): React.ReactElement => {
    const gridClasses = [
      'grid',
      getGridClasses(gap, 'gap'),
      getGridClasses(columnGap, 'gap-x'),
      getGridClasses(rowGap, 'gap-y'),
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const inlineStyles: React.CSSProperties = {
      ...style,
      ...(columns && typeof columns === 'string' ? { gridTemplateColumns: columns } : {}),
      ...(rows && typeof rows === 'string' ? { gridTemplateRows: rows } : {}),
      ...(area && typeof area === 'string' ? { gridArea: area } : {}),
      ...(column && typeof column === 'string' ? { gridColumn: column } : {}),
      ...(row && typeof row === 'string' ? { gridRow: row } : {}),
    };

    return (
      <Box
        ref={ref}
        className={gridClasses}
        display="grid"
        style={inlineStyles}
        {...boxProps}
      />
    );
  }
);

Grid.displayName = 'Grid';

export default Grid;

