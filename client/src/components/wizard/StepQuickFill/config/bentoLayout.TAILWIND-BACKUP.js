/**
 * Bento Layout Configuration - REDESIGNED
 * 
 * Visual Design System:
 * - Monochromatic palette (grays + indigo accent + green filled state)
 * - 12-column grid with proper hierarchy
 * - Subject (7 cols) dominates over Action (5 cols)
 * - Varied corner radii for visual rhythm
 * - Layered shadows for depth
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
 * Design System Colors
 */
export const BENTO_COLORS = {
  // Surfaces
  surfaceBase: '#FAFAFA',
  surfaceElevated: '#FAFBFC', // Subtle off-white for cards
  
  // Borders
  borderSubtle: '#E8E8E8',
  borderDefault: '#D0D0D0',
  borderRequired: 'rgba(91, 91, 214, 0.4)', // Visible indigo
  borderOptional: 'rgba(0, 0, 0, 0.12)',
  
  // Accents
  accentIndigo: '#5B5BD6',
  accentGreen: '#10B981',
  
  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textPlaceholder: '#9CA3AF',
};

/**
 * Shadow System
 */
export const BENTO_SHADOWS = {
  // Resting state - subtle elevation
  resting: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
  
  // Hover state - pronounced lift
  hover: '0 12px 28px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
  
  // Filled state - green-tinted elevation
  filled: '0 1px 3px rgba(16, 185, 129, 0.15), 0 1px 2px rgba(0, 0, 0, 0.08)',
  
  // Icon glow (hero fields only)
  iconGlow: 'drop-shadow(0 2px 4px rgba(91, 91, 214, 0.15))',
};

/**
 * Typography System
 */
export const BENTO_TYPOGRAPHY = {
  // Labels
  labelSize: '15px',
  labelWeight: 600, // Semibold
  labelColor: BENTO_COLORS.textPrimary,
  labelSpacing: '-0.01em',
  
  // Preview text
  previewSize: '13px',
  previewWeight: 400,
  previewColor: BENTO_COLORS.textSecondary,
  
  // Placeholder
  placeholderSize: '13px',
  placeholderWeight: 400,
  placeholderColor: BENTO_COLORS.textPlaceholder,
  placeholderStyle: 'italic',
};

/**
 * Bento field configuration
 * 12-column grid system with proper visual hierarchy
 */
export const BENTO_FIELD_CONFIG = {
  subject: {
    size: 'hero',
    gridColumn: 7,  // 58% width - DOMINATES
    gridRow: 2,     // Double height
    
    // Visual properties
    icon: Target,
    iconSize: 36,           // Larger icon for hero
    iconStrokeWidth: 1.5,
    iconColor: BENTO_COLORS.accentIndigo,
    iconFilter: BENTO_SHADOWS.iconGlow,
    
    // Styling
    borderRadius: '16px',
    borderWidth: '2px',     // Heavier border
    borderColor: BENTO_COLORS.borderRequired,
    backgroundColor: BENTO_COLORS.surfaceElevated,
    padding: '40px',
    
    // States
    borderColorFilled: BENTO_COLORS.accentGreen,
    backgroundColorFilled: 'rgba(16, 185, 129, 0.03)',
    
    order: 1,
  },
  
  action: {
    size: 'large',
    gridColumn: 5,  // 42% width - Secondary hero
    gridRow: 2,     // Double height
    
    // Visual properties
    icon: Activity,
    iconSize: 32,           // Slightly smaller than subject
    iconStrokeWidth: 1.5,
    iconColor: BENTO_COLORS.accentIndigo,
    iconFilter: BENTO_SHADOWS.iconGlow,
    
    // Styling
    borderRadius: '16px',
    borderWidth: '1px',     // Standard border
    borderColor: BENTO_COLORS.borderRequired,
    backgroundColor: BENTO_COLORS.surfaceElevated,
    padding: '40px',
    
    // States
    borderColorFilled: BENTO_COLORS.accentGreen,
    backgroundColorFilled: 'rgba(16, 185, 129, 0.03)',
    
    order: 2,
  },
  
  location: {
    size: 'medium',
    gridColumn: 3,  // 25% width
    gridRow: 1,
    
    // Visual properties
    icon: MapPin,
    iconSize: 28,
    iconStrokeWidth: 1.5,
    iconColor: BENTO_COLORS.textSecondary,
    
    // Styling
    borderRadius: '12px',
    borderWidth: '1px',
    borderColor: BENTO_COLORS.borderOptional,
    backgroundColor: BENTO_COLORS.surfaceElevated,
    padding: '32px',
    
    // States
    borderColorFilled: BENTO_COLORS.accentGreen,
    backgroundColorFilled: 'rgba(16, 185, 129, 0.03)',
    
    group: 'location-time', // Grouped with time
    order: 3,
  },
  
  time: {
    size: 'medium',
    gridColumn: 3,  // 25% width
    gridRow: 1,
    
    // Visual properties
    icon: Clock,
    iconSize: 28,
    iconStrokeWidth: 1.5,
    iconColor: BENTO_COLORS.textSecondary,
    
    // Styling
    borderRadius: '12px',
    borderWidth: '1px',
    borderColor: BENTO_COLORS.borderOptional,
    backgroundColor: BENTO_COLORS.surfaceElevated,
    padding: '32px',
    
    // States
    borderColorFilled: BENTO_COLORS.accentGreen,
    backgroundColorFilled: 'rgba(16, 185, 129, 0.03)',
    
    group: 'location-time',
    order: 4,
  },
  
  mood: {
    size: 'medium',
    gridColumn: 3,  // 25% width
    gridRow: 1,
    
    // Visual properties
    icon: Theater,
    iconSize: 28,
    iconStrokeWidth: 1.5,
    iconColor: BENTO_COLORS.textSecondary,
    
    // Styling
    borderRadius: '12px',
    borderWidth: '1px',
    borderColor: BENTO_COLORS.borderOptional,
    backgroundColor: BENTO_COLORS.surfaceElevated,
    padding: '32px',
    
    // States
    borderColorFilled: BENTO_COLORS.accentGreen,
    backgroundColorFilled: 'rgba(16, 185, 129, 0.03)',
    
    group: 'mood-style',
    order: 5,
  },
  
  style: {
    size: 'medium',
    gridColumn: 3,  // 25% width
    gridRow: 1,
    
    // Visual properties
    icon: Palette,
    iconSize: 28,
    iconStrokeWidth: 1.5,
    iconColor: BENTO_COLORS.textSecondary,
    
    // Styling
    borderRadius: '12px',
    borderWidth: '1px',
    borderColor: BENTO_COLORS.borderOptional,
    backgroundColor: BENTO_COLORS.surfaceElevated,
    padding: '32px',
    
    // States
    borderColorFilled: BENTO_COLORS.accentGreen,
    backgroundColorFilled: 'rgba(16, 185, 129, 0.03)',
    
    group: 'mood-style',
    order: 6,
  },
  
  descriptors: {
    size: 'wide',
    gridColumn: 8,  // 67% width
    gridRow: 1,
    
    // Visual properties
    icon: Sparkles,
    iconSize: 28,
    iconStrokeWidth: 1.5,
    iconColor: BENTO_COLORS.textSecondary,
    
    // Styling
    borderRadius: '12px',
    borderWidth: '1px',
    borderColor: BENTO_COLORS.borderOptional,
    backgroundColor: BENTO_COLORS.surfaceElevated,
    padding: '32px',
    
    // States
    borderColorFilled: BENTO_COLORS.accentGreen,
    backgroundColorFilled: 'rgba(16, 185, 129, 0.03)',
    
    order: 7,
  },
  
  event: {
    size: 'small',
    gridColumn: 4,  // 33% width
    gridRow: 1,
    
    // Visual properties
    icon: PartyPopper,
    iconSize: 24,
    iconStrokeWidth: 1.5,
    iconColor: BENTO_COLORS.textSecondary,
    
    // Styling
    borderRadius: '8px',
    borderWidth: '1px',
    borderColor: BENTO_COLORS.borderOptional,
    backgroundColor: BENTO_COLORS.surfaceElevated,
    padding: '28px',
    
    // States
    borderColorFilled: BENTO_COLORS.accentGreen,
    backgroundColorFilled: 'rgba(16, 185, 129, 0.03)',
    
    order: 8,
  },
};

/**
 * Get all field IDs sorted by display order
 */
export function getBentoFieldOrder() {
  return Object.entries(BENTO_FIELD_CONFIG)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key]) => key);
}

/**
 * Grid configuration for responsive breakpoints
 */
export const GRID_CONFIG = {
  desktop: {
    columns: 12,
    gap: '36px',
    rowHeight: 'minmax(140px, auto)',
  },
  
  tablet: {
    columns: 2, // Simplified 2-column (not 4)
    gap: '24px',
    // Hero and large span full width, stack vertically
    // Medium fields pair up side-by-side
  },
  
  mobile: {
    // Small screens (<480px): pure stack
    small: {
      columns: 1,
      gap: '12px',
    },
    // Medium screens (481-767px): strategic 2-column
    medium: {
      columns: 2,
      gap: '12px',
    },
  },
};

/**
 * Animation timings
 */
export const BENTO_ANIMATIONS = {
  transition: '200ms ease-out',
  expandDuration: '300ms',
  collapseDuration: '250ms',
  hoverScale: 1.02,
  hoverTranslateY: '-2px',
};
