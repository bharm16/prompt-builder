import { LayoutGrid, Users, Palette } from '@promptstudio/system/components/ui';
import type { ToolNavItem } from '../types';

export const toolNavItems: ToolNavItem[] = [
  {
    id: 'sessions',
    icon: LayoutGrid,
    label: 'Sessions',
    variant: 'header',
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
