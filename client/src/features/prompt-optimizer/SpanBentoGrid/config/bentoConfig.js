/**
 * Bento Grid Configuration
 * Category metadata for the Span Bento Grid display
 * 
 * Monochromatic design system:
 * - All categories use consistent neutral colors
 * - Emoji icons provide visual distinction
 * - No color coding - rely on icons and labels for identification
 */

/**
 * Category Configuration
 * Maps category identifiers to their visual and metadata properties
 */
export const CATEGORY_CONFIG = {
  subject: {
    label: 'Subject',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🎯',
    order: 1,
  },
  appearance: {
    label: 'Appearance',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '👤',
    order: 2,
  },
  wardrobe: {
    label: 'Wardrobe',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '👔',
    order: 3,
  },
  action: {
    label: 'Action',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🏃',
    order: 4,
  },
  environment: {
    label: 'Environment',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🌲',
    order: 5,
  },
  lighting: {
    label: 'Lighting',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '💡',
    order: 6,
  },
  timeOfDay: {
    label: 'Time of Day',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🌅',
    order: 7,
  },
  cameraMove: {
    label: 'Camera Movement',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🎥',
    order: 8,
  },
  framing: {
    label: 'Shot Framing',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🎬',
    order: 9,
  },
  technical: {
    label: 'Technical Specs',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '⚙️',
    order: 10,
  },
  descriptive: {
    label: 'Descriptive',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '📝',
    order: 11,
  },
};

/**
 * Empty state message for categories with no spans
 */
export const EMPTY_STATE_MESSAGE = 'No items';

/**
 * Category order array for consistent rendering
 * Sorted by the 'order' property in CATEGORY_CONFIG
 */
export const CATEGORY_ORDER = Object.entries(CATEGORY_CONFIG)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([key]) => key);

