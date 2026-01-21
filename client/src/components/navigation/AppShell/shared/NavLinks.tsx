/**
 * Navigation links rendered in horizontal or vertical layout.
 */

import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@utils/cn';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@promptstudio/system/components/ui/tooltip';
import type { NavLinksProps } from '../types';

export function NavLinks({ items, variant, className }: NavLinksProps): ReactElement {
  if (variant === 'vertical-collapsed') {
    return (
      <TooltipProvider delayDuration={120}>
        <nav className={cn('flex flex-col items-center gap-2', className)}>
          {items.map((item) => (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex h-8 w-8 items-center justify-center rounded-md',
                      'text-muted transition-colors',
                      'hover:bg-[rgb(36,42,56)] hover:text-foreground',
                      isActive && 'bg-[rgb(44,48,55)] text-foreground'
                    )
                  }
                  aria-label={item.label}
                >
                  <item.icon size={18} />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="rounded-lg border border-[rgb(67,70,81)] bg-[rgb(24,25,28)] text-body-sm text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
              >
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </TooltipProvider>
    );
  }

  if (variant === 'vertical') {
    return (
      <nav className={cn('flex flex-col gap-1', className)}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2',
                'text-[13px] font-medium text-muted transition-colors',
                'hover:bg-[rgba(255,255,255,0.05)] hover:text-foreground',
                isActive && 'bg-[rgba(255,255,255,0.08)] text-foreground'
              )
            }
          >
            <item.icon size={16} className="flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <nav className={cn('flex items-center gap-2', className)}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'block rounded-md px-4 py-2 text-[13px] font-medium leading-4 uppercase tracking-[0.5px] text-muted transition-colors',
              isActive
                ? 'bg-surface-1 text-foreground'
                : 'text-muted hover:bg-surface-1 hover:text-foreground'
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
