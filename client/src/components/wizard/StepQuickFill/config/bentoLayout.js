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
 */
export const BENTO_FIELD_CONFIG = {
  subject: {
    size: 'large',
    icon: Target,
    color: '#FF385C',
    borderColor: 'rgba(255, 56, 92, 0.3)',
    bgColor: 'rgba(255, 56, 92, 0.05)',
    order: 1,
  },
  action: {
    size: 'large',
    icon: Activity,
    color: '#A78BFA',
    borderColor: 'rgba(167, 139, 250, 0.3)',
    bgColor: 'rgba(167, 139, 250, 0.05)',
    order: 2,
  },
  descriptor1: {
    size: 'small',
    icon: Sparkles,
    color: '#60A5FA',
    borderColor: 'rgba(96, 165, 250, 0.3)',
    bgColor: 'rgba(96, 165, 250, 0.05)',
    order: 3,
  },
  location: {
    size: 'small',
    icon: MapPin,
    color: '#34D399',
    borderColor: 'rgba(52, 211, 153, 0.3)',
    bgColor: 'rgba(52, 211, 153, 0.05)',
    order: 4,
  },
  descriptor2: {
    size: 'small',
    icon: Sparkles,
    color: '#60A5FA',
    borderColor: 'rgba(96, 165, 250, 0.3)',
    bgColor: 'rgba(96, 165, 250, 0.05)',
    order: 5,
  },
  time: {
    size: 'small',
    icon: Clock,
    color: '#FBBF24',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    bgColor: 'rgba(251, 191, 36, 0.05)',
    order: 6,
  },
  descriptor3: {
    size: 'small',
    icon: Sparkles,
    color: '#60A5FA',
    borderColor: 'rgba(96, 165, 250, 0.3)',
    bgColor: 'rgba(96, 165, 250, 0.05)',
    order: 7,
  },
  mood: {
    size: 'small',
    icon: Theater,
    color: '#F472B6',
    borderColor: 'rgba(244, 114, 182, 0.3)',
    bgColor: 'rgba(244, 114, 182, 0.05)',
    order: 8,
  },
  style: {
    size: 'small',
    icon: Palette,
    color: '#8B5CF6',
    borderColor: 'rgba(139, 92, 246, 0.3)',
    bgColor: 'rgba(139, 92, 246, 0.05)',
    order: 9,
  },
  event: {
    size: 'small',
    icon: PartyPopper,
    color: '#EC4899',
    borderColor: 'rgba(236, 72, 153, 0.3)',
    bgColor: 'rgba(236, 72, 153, 0.05)',
    order: 10,
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
 * Grid column span configuration
 * - Desktop: Large = 2 columns, Small = 1 column (4-column grid)
 * - Tablet: All = 1 column (2-column grid)
 * - Mobile: All = 1 column (1-column grid)
 */
export const GRID_CONFIG = {
  desktop: {
    columns: 4,
    largeSpan: 2,
    smallSpan: 1,
  },
  tablet: {
    columns: 2,
    largeSpan: 1,
    smallSpan: 1,
  },
  mobile: {
    columns: 1,
    largeSpan: 1,
    smallSpan: 1,
  },
};

