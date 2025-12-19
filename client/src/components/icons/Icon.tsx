/**
 * Icon Component
 * Wrapper component for Geist icons with consistent styling
 * 
 * Provides a unified API for using Geist icons throughout the application
 */

import React from 'react';
import * as GeistIcons from '@geist-ui/icons';
import { iconSizes } from '@/styles/tokens';
import { logger } from '@/services/LoggingService';
import type { CSSProperties } from 'react';

export type IconSize = keyof typeof iconSizes;
export type GeistIconName = keyof typeof GeistIcons;

export interface IconProps {
  /**
   * Geist icon name (e.g., 'User', 'Video', 'Settings')
   */
  name: GeistIconName;
  
  /**
   * Icon size
   * @default 'md'
   */
  size?: IconSize | number;
  
  /**
   * Icon color (CSS color value)
   * @default 'currentColor'
   */
  color?: string;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Additional inline styles
   */
  style?: CSSProperties;
  
  /**
   * Accessibility label
   */
  'aria-label'?: string;
  
  /**
   * Accessibility hidden
   */
  'aria-hidden'?: boolean;
}

/**
 * Icon Component
 * 
 * Usage:
 * ```tsx
 * <Icon name="User" size="lg" color="#5B5BD6" />
 * ```
 */
export function Icon({
  name,
  size = 'md',
  color = 'currentColor',
  className = '',
  style = {},
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
}: IconProps): React.ReactElement | null {
  const GeistIcon = GeistIcons[name];
  
  if (!GeistIcon) {
    logger.warn('Geist icon not found', {
      component: 'Icon',
      iconName: name,
    });
    return null;
  }
  
  // Calculate size
  const sizeValue = typeof size === 'number' 
    ? `${size}px` 
    : iconSizes[size] || iconSizes.md;
  
  const iconStyle: CSSProperties = {
    width: sizeValue,
    height: sizeValue,
    color,
    ...style,
  };
  
  return (
    <GeistIcon
      className={className}
      style={iconStyle}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
    />
  );
}

/**
 * Create an icon component from a Geist icon name
 * Useful for creating icon components that can be passed around
 */
export function createIconComponent(name: GeistIconName) {
  return function IconComponent(props: Omit<IconProps, 'name'>) {
    return <Icon name={name} {...props} />;
  };
}

