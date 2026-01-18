/**
 * LoadingDots Component
 * 
 * Simple three-dot loading indicator matching the app design system
 */

import React from 'react';
import { cn } from '@/utils/cn';

interface LoadingDotsProps {
  size?: number | 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  size = 'md',
  className,
}) => {
  const numericSizeMap: Record<number, string> = {
    2: 'h-0.5 w-0.5',
    3: 'h-1 w-1',
    4: 'h-1.5 w-1.5',
    5: 'h-2 w-2',
  };

  const sizeMap: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'h-1 w-1',
    md: 'h-1.5 w-1.5',
    lg: 'h-2 w-2',
  };

  const dotSizeClass =
    typeof size === 'number'
      ? numericSizeMap[size] ?? sizeMap.md
      : sizeMap[size];

  const dotClass = cn('rounded-full bg-current ps-animate-bounce', dotSizeClass);

  return (
    <div className={cn('flex items-center gap-1 text-muted', className)}>
      <div className={dotClass} />
      <div className={cn(dotClass, 'ps-delay-200')} />
      <div className={cn(dotClass, 'ps-delay-400')} />
    </div>
  );
};
