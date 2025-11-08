/**
 * Bento Grid Configuration
 * Category metadata for the Span Bento Grid display
 * Colors match CategoryLegend.jsx exactly for the NLP categories
 */

/**
 * Category Configuration
 * Maps category identifiers to their visual and metadata properties
 */
export const CATEGORY_CONFIG = {
  subject: {
    label: 'Subject',
    color: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
    icon: '🎯',
    order: 1,
  },
  appearance: {
    label: 'Appearance',
    color: 'rgba(255, 105, 180, 0.35)',
    borderColor: 'rgba(255, 105, 180, 0.8)',
    icon: '👤',
    order: 2,
  },
  wardrobe: {
    label: 'Wardrobe',
    color: 'rgba(255, 214, 0, 0.35)',
    borderColor: 'rgba(255, 214, 0, 0.8)',
    icon: '👔',
    order: 3,
  },
  action: {
    label: 'Action',
    color: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.5)',
    icon: '🏃',
    order: 4,
  },
  environment: {
    label: 'Environment',
    color: 'rgba(34, 197, 94, 0.18)',
    borderColor: 'rgba(34, 197, 94, 0.55)',
    icon: '🌲',
    order: 5,
  },
  lighting: {
    label: 'Lighting',
    color: 'rgba(253, 224, 71, 0.2)',
    borderColor: 'rgba(253, 224, 71, 0.6)',
    icon: '💡',
    order: 6,
  },
  timeOfDay: {
    label: 'Time of Day',
    color: 'rgba(135, 206, 235, 0.35)',
    borderColor: 'rgba(135, 206, 235, 0.8)',
    icon: '🌅',
    order: 7,
  },
  cameraMove: {
    label: 'Camera Movement',
    color: 'rgba(56, 189, 248, 0.18)',
    borderColor: 'rgba(56, 189, 248, 0.55)',
    icon: '🎥',
    order: 8,
  },
  framing: {
    label: 'Shot Framing',
    color: 'rgba(147, 197, 253, 0.18)',
    borderColor: 'rgba(59, 130, 246, 0.45)',
    icon: '🎬',
    order: 9,
  },
  technical: {
    label: 'Technical Specs',
    color: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
    icon: '⚙️',
    order: 10,
  },
  descriptive: {
    label: 'Descriptive',
    color: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
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

