import type { LucideIcon } from 'lucide-react';
import { LayoutGrid, SlidersHorizontal, Users, Palette, Sparkles } from 'lucide-react';
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
    id: 'create',
    icon: Sparkles,
    label: 'Create',
    variant: 'default',
  },
  {
    id: 'studio',
    icon: SlidersHorizontal,
    label: 'Studio',
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
