import { LayoutGrid, SlidersHorizontal, Users, Palette, Sparkles, FilmSlate } from '@promptstudio/system/components/ui';
import type { ToolNavItem } from '../types';

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
  {
    id: 'continuity',
    icon: FilmSlate,
    label: 'Continuity',
    variant: 'default',
  },
];
