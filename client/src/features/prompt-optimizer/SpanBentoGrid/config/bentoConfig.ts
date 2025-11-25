/**
 * Bento Grid Configuration
 * Category metadata for the Span Bento Grid display
 * 
 * Now aligned with unified taxonomy system:
 * - Uses taxonomy parent categories as box keys
 * - All attributes (e.g., subject.wardrobe) grouped under their parents
 * - Monochromatic design system with lucide-react icons
 */

import {
  Ruler,
  Target,
  Film,
  TreePine,
  Lightbulb,
  Video,
  Palette,
  Settings,
  Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TAXONOMY } from '@shared/taxonomy';

/**
 * Category Configuration
 * Maps taxonomy parent category IDs to their visual and metadata properties
 */
export const CATEGORY_CONFIG = {
  [TAXONOMY.SHOT.id]: {
    label: 'Shot Type',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: Ruler,
    order: 1,
    description: 'Framing and vantage of the camera',
  },
  [TAXONOMY.SUBJECT.id]: {
    label: 'Subject & Character',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: Target,
    order: 2,
    description: 'The focal point (person, object, animal) and their attributes',
  },
  [TAXONOMY.ACTION.id]: {
    label: 'Action & Motion',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: Film,
    order: 3,
    description: 'What the subject is doing (movement, state, gesture)',
  },
  [TAXONOMY.ENVIRONMENT.id]: {
    label: 'Environment',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: TreePine,
    order: 4,
    description: 'Location, weather, and spatial context',
  },
  [TAXONOMY.LIGHTING.id]: {
    label: 'Lighting',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: Lightbulb,
    order: 5,
    description: 'Light source, quality, and time of day',
  },
  [TAXONOMY.CAMERA.id]: {
    label: 'Camera',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: Video,
    order: 6,
    description: 'Framing, movement, lens, and angles',
  },
  [TAXONOMY.STYLE.id]: {
    label: 'Style & Aesthetic',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: Palette,
    order: 7,
    description: 'Visual treatment, film stock, and aesthetic',
  },
  [TAXONOMY.TECHNICAL.id]: {
    label: 'Technical Specs',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: Settings,
    order: 8,
    description: 'Frame rate, aspect ratio, and resolution',
  },
  [TAXONOMY.AUDIO.id]: {
    label: 'Audio',
    color: '#FFFFFF',
    borderColor: '#E8E8E8',
    icon: Volume2,
    order: 9,
    description: 'Music, score, and sound effects',
  },
} as const;

/**
 * Empty state message for categories with no spans
 */
export const EMPTY_STATE_MESSAGE = 'No items' as const;

/**
 * Category order array for consistent rendering
 * Sorted by the 'order' property in CATEGORY_CONFIG
 */
export const CATEGORY_ORDER = Object.entries(CATEGORY_CONFIG)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([key]) => key) as readonly string[];

