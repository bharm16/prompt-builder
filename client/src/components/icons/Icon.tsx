import React from 'react';
import * as LucideIcons from 'lucide-react';
import { iconSizes } from '@/styles/tokens';
import { logger } from '@/services/LoggingService';
import type { CSSProperties } from 'react';

export type IconSize = keyof typeof iconSizes;
export type IconName = keyof typeof LucideIcons;

export interface IconProps {
  /**
   * Icon name (e.g., 'User', 'Video', 'Settings')
   */
  name: IconName;
  
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
  const LucideIcon = LucideIcons[name] as unknown as React.ComponentType<Record<string, unknown>> | undefined;
  
  if (!LucideIcon) {
    logger.warn('Icon not found', {
      component: 'Icon',
      iconName: name,
    });
    return null;
  }
  
  const sizeValue = typeof size === 'number' ? size : Number.parseInt(iconSizes[size] || iconSizes.md, 10);
  
  const iconStyle: CSSProperties = {
    color,
    ...style,
  };
  
  return (
    <LucideIcon
      className={className}
      size={sizeValue}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      style={iconStyle}
    />
  );
}

/**
 * Create an icon component from an icon name
 * Useful for creating icon components that can be passed around
 */
export function createIconComponent(name: IconName): (props: Omit<IconProps, 'name'>) => React.ReactElement | null {
  return function IconComponent(props: Omit<IconProps, 'name'>) {
    return <Icon name={name} {...props} />;
  };
}
