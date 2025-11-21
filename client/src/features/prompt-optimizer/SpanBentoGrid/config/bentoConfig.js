/**
 * Bento Grid Configuration
 * Category metadata for the Span Bento Grid display
 * 
 * Now aligned with unified taxonomy system:
 * - Uses taxonomy parent categories as box keys
 * - All attributes (e.g., subject.wardrobe) grouped under their parents
 * - Monochromatic design system with emoji icons
 */

import { TAXONOMY } from '@shared/taxonomy.js';

/**
 * Category Configuration
 * Maps taxonomy parent category IDs to their visual and metadata properties
 */
export const CATEGORY_CONFIG = {
  [TAXONOMY.SUBJECT.id]: {
    label: 'Subject & Character',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🎯',
    order: 1,
    description: 'The focal point (person, object, animal) and their attributes',
  },
  [TAXONOMY.ENVIRONMENT.id]: {
    label: 'Environment',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🌲',
    order: 2,
    description: 'Location, weather, and spatial context',
  },
  [TAXONOMY.LIGHTING.id]: {
    label: 'Lighting',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '💡',
    order: 3,
    description: 'Light source, quality, and time of day',
  },
  [TAXONOMY.CAMERA.id]: {
    label: 'Camera',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🎥',
    order: 4,
    description: 'Framing, movement, lens, and angles',
  },
  [TAXONOMY.STYLE.id]: {
    label: 'Style & Aesthetic',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🎨',
    order: 5,
    description: 'Visual treatment, film stock, and aesthetic',
  },
  [TAXONOMY.TECHNICAL.id]: {
    label: 'Technical Specs',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '⚙️',
    order: 6,
    description: 'Frame rate, aspect ratio, and resolution',
  },
  [TAXONOMY.AUDIO.id]: {
    label: 'Audio',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: '🔊',
    order: 7,
    description: 'Music, score, and sound effects',
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

