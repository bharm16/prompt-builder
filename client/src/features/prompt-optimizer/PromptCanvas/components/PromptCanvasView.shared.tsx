import React from 'react';
import { Button, type ButtonProps } from '@promptstudio/system/components/ui/button';

export const CanvasButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, ...props }, ref) => (
    <Button ref={ref} variant={variant ?? 'canvas'} {...props} />
  )
);

CanvasButton.displayName = 'CanvasButton';

export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
} as const;
