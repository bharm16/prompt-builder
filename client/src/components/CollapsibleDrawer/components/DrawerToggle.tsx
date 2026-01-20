import React from 'react';
import { CaretLeft, CaretRight, CaretUp, CaretDown, Icon } from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import { cn } from '@/utils/cn';
import type { DrawerPosition } from '../hooks/useDrawerState';

interface DrawerToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  position?: DrawerPosition;
  label?: string;
  className?: string;
}

export function DrawerToggle({
  isOpen,
  onToggle,
  position = 'left',
  label = 'Toggle drawer',
  className,
}: DrawerToggleProps): React.ReactElement {
  const getIcon = () => {
    if (position === 'bottom') {
      return isOpen ? CaretDown : CaretUp;
    }
    if (position === 'left') {
      return isOpen ? CaretLeft : CaretRight;
    }
    // position === 'right'
    return isOpen ? CaretRight : CaretLeft;
  };

  return (
    <Button
      type="button"
      variant="canvas"
      size="icon-sm"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={cn('shadow-sm', className)}
    >
      <Icon icon={getIcon()} size="sm" weight="bold" aria-hidden="true" />
    </Button>
  );
}
