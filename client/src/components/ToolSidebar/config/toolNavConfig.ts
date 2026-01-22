import type { LucideIcon } from 'lucide-react';
import { LayoutGrid, SlidersHorizontal, Users, Palette } from 'lucide-react';
import type { ToolPanelType } from '../types';

export interface ToolNavItem {
  id: ToolPanelType;
  icon: LucideIcon;
  label: string;
  variant: 'header' | 'default';
}

export const toolNavItems: ToolNavItem[] = [
  {
    id: 'sessions',
    icon: LayoutGrid,
    label: 'Sessions',
    variant: 'header',
  },
  {
    id: 'tool',
    icon: SlidersHorizontal,
    label: 'Tool',
    variant: 'default',
  },
  {
    id: 'characters',
    icon: Users,
    label: 'Chars',
    variant: 'default',
  },
  {
    id: 'styles',
    icon: Palette,
    label: 'Styles',
    variant: 'default',
  },
];
