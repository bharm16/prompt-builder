import { List, SlidersHorizontal, LayoutGrid, Users, Palette } from '@promptstudio/system/components/ui';
import type { ToolNavItem } from '../types';

export const toolNavItems: ToolNavItem[] = [
  {
    id: 'sessions',
    icon: List,
    label: 'Sessions',
    variant: 'header',
  },
  {
    id: 'studio',
    icon: SlidersHorizontal,
    label: 'Tool',
    variant: 'default',
  },
  {
    id: 'apps',
    icon: LayoutGrid,
    label: 'Apps',
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
