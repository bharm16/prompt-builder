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
 * Layout: Asymmetric 12-column grid with hero Subject (8 cols) and Action (4 cols)
 * 
 * Monochromatic color system:
 * - Required fields: Indigo accent (#5B5BD6)
 * - Optional fields: Neutral gray (#E8E8E8)
 * - Filled state: Green accent (#10B981)
 */
export const BENTO_FIELD_CONFIG = {
  subject: {
    size: 'hero',
    icon: Target,
    color: '#5B5BD6',
    borderColor: '#5B5BD6',
    bgColor: '#FFFFFF',
    gridColumn: 8,
    gridRow: 2,
    order: 1,
  },
  action: {
    size: 'large',
    icon: Activity,
    color: '#5B5BD6',
    borderColor: '#5B5BD6',
    bgColor: '#FFFFFF',
    gridColumn: 4,
    gridRow: 2,
    order: 2,
  },
  location: {
    size: 'medium',
    icon: MapPin,
    color: '#6B6B6B',
    borderColor: '#E8E8E8',
    bgColor: '#FFFFFF',
    gridColumn: 3,
    gridRow: 1,
    order: 3,
  },
  time: {
    size: 'medium',
    icon: Clock,
    color: '#6B6B6B',
    borderColor: '#E8E8E8',
    bgColor: '#FFFFFF',
    gridColumn: 3,
    gridRow: 1,
    order: 4,
  },
  mood: {
    size: 'medium',
    icon: Theater,
    color: '#6B6B6B',
    borderColor: '#E8E8E8',
    bgColor: '#FFFFFF',
    gridColumn: 3,
    gridRow: 1,
    order: 5,
  },
  style: {
    size: 'medium',
    icon: Palette,
    color: '#6B6B6B',
    borderColor: '#E8E8E8',
    bgColor: '#FFFFFF',
    gridColumn: 3,
    gridRow: 1,
    order: 6,
  },
  descriptors: {
    size: 'wide',
    icon: Sparkles,
    color: '#6B6B6B',
    borderColor: '#E8E8E8',
    bgColor: '#FFFFFF',
    gridColumn: 8,
    gridRow: 1,
    order: 7,
  },
  event: {
    size: 'small',
    icon: PartyPopper,
    color: '#6B6B6B',
    borderColor: '#E8E8E8',
    bgColor: '#FFFFFF',
    gridColumn: 4,
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
 * - Desktop: 12-column explicit grid with asymmetric sizing
 *   - Hero (Subject): 8 cols × 2 rows (67% width, dominant)
 *   - Large (Action): 4 cols × 2 rows (33% width)
 *   - Medium: 3 cols × 1 row (25% width)
 *   - Wide: 8 cols × 1 row (66% width)
 *   - Small: 4 cols × 1 row (33% width)
 * - Tablet: 2-column grid, stack required fields full width
 * - Mobile: 1-column stack with strategic 2-column for related pairs
 */
export const GRID_CONFIG = {
  desktop: {
    columns: 12,
    heroSpan: { column: 8, row: 2 },
    largeSpan: { column: 4, row: 2 },
    mediumSpan: { column: 3, row: 1 },
    wideSpan: { column: 8, row: 1 },
    smallSpan: { column: 4, row: 1 },
    rowHeight: '140px',
  },
  tablet: {
    columns: 2,
    heroSpan: { column: 2, row: 1 },
    largeSpan: { column: 2, row: 1 },
    mediumSpan: { column: 1, row: 1 },
    wideSpan: { column: 2, row: 1 },
    smallSpan: { column: 2, row: 1 },
  },
  mobile: {
    columns: 1,
    heroSpan: { column: 1, row: 1 },
    largeSpan: { column: 1, row: 1 },
    mediumSpan: { column: 1, row: 1 },
    wideSpan: { column: 1, row: 1 },
    smallSpan: { column: 1, row: 1 },
  },
};

