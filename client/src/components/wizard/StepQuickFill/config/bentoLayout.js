/**
 * Bento Layout Configuration
 * 
 * Defines visual and structural properties for bento box fields:
 * - Grid sizing (large for required, small for optional)
 * - Visual styling (icons, colors)
 * - Display order in the grid
 * 
 * @module bentoLayout
 */

import { 
  Target, 
  Activity, 
  Sparkles, 
  MapPin, 
  Clock, 
  Theater, 
  Palette, 
  PartyPopper 
} from 'lucide-react';

/**
 * Bento field configuration
 * Maps each field to its display properties
 * Layout: Asymmetric 6-column grid with tall Subject/Action boxes
 */
export const BENTO_FIELD_CONFIG = {
  subject: {
    size: 'tall',
    icon: Target,
    color: '#FF385C',
    borderColor: 'rgba(255, 56, 92, 0.3)',
    bgColor: 'rgba(255, 56, 92, 0.05)',
    gridColumn: 2,
    gridRow: 2,
    order: 1,
  },
  location: {
    size: 'small',
    icon: MapPin,
    color: '#34D399',
    borderColor: 'rgba(52, 211, 153, 0.3)',
    bgColor: 'rgba(52, 211, 153, 0.05)',
    gridColumn: 1,
    gridRow: 1,
    order: 2,
  },
  time: {
    size: 'small',
    icon: Clock,
    color: '#FBBF24',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    bgColor: 'rgba(251, 191, 36, 0.05)',
    gridColumn: 1,
    gridRow: 1,
    order: 3,
  },
  action: {
    size: 'tall',
    icon: Activity,
    color: '#A78BFA',
    borderColor: 'rgba(167, 139, 250, 0.3)',
    bgColor: 'rgba(167, 139, 250, 0.05)',
    gridColumn: 2,
    gridRow: 2,
    order: 4,
  },
  mood: {
    size: 'small',
    icon: Theater,
    color: '#F472B6',
    borderColor: 'rgba(244, 114, 182, 0.3)',
    bgColor: 'rgba(244, 114, 182, 0.05)',
    gridColumn: 1,
    gridRow: 1,
    order: 5,
  },
  style: {
    size: 'small',
    icon: Palette,
    color: '#8B5CF6',
    borderColor: 'rgba(139, 92, 246, 0.3)',
    bgColor: 'rgba(139, 92, 246, 0.05)',
    gridColumn: 1,
    gridRow: 1,
    order: 6,
  },
  descriptors: {
    size: 'wide',
    icon: Sparkles,
    color: '#60A5FA',
    borderColor: 'rgba(96, 165, 250, 0.3)',
    bgColor: 'rgba(96, 165, 250, 0.05)',
    gridColumn: 4,
    gridRow: 1,
    order: 7,
  },
  event: {
    size: 'small',
    icon: PartyPopper,
    color: '#EC4899',
    borderColor: 'rgba(236, 72, 153, 0.3)',
    bgColor: 'rgba(236, 72, 153, 0.05)',
    gridColumn: 1,
    gridRow: 1,
    order: 8,
  },
};

/**
 * Get all field IDs sorted by display order
 * @returns {string[]} Array of field IDs in display order
 */
export function getBentoFieldOrder() {
  return Object.entries(BENTO_FIELD_CONFIG)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key]) => key);
}

/**
 * Grid column and row span configuration
 * - Desktop: Tall = 2 cols × 2 rows, Wide = 4 cols × 1 row, Small = 1 col × 1 row (6-column grid)
 * - Tablet: Tall = 2 cols × 1 row, Wide = 2 cols, Small = 1 col (3-column grid)
 * - Mobile: All = 1 col × 1 row (1-column grid)
 */
export const GRID_CONFIG = {
  desktop: {
    columns: 6,
    tallSpan: { column: 2, row: 2 },
    wideSpan: { column: 4, row: 1 },
    smallSpan: { column: 1, row: 1 },
    rowHeight: '140px',
  },
  tablet: {
    columns: 3,
    tallSpan: { column: 2, row: 1 },
    wideSpan: { column: 2, row: 1 },
    smallSpan: { column: 1, row: 1 },
  },
  mobile: {
    columns: 1,
    tallSpan: { column: 1, row: 1 },
    wideSpan: { column: 1, row: 1 },
    smallSpan: { column: 1, row: 1 },
  },
};

