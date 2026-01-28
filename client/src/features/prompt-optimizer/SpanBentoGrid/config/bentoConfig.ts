/**
 * Bento Grid Configuration
 * Category metadata for the Span Bento Grid display
 * 
 * Now aligned with unified taxonomy system:
 * - Uses taxonomy parent categories as box keys
 * - All attributes (e.g., subject.wardrobe) grouped under their parents
 * - Monochromatic design system with Phosphor icons
 */

import { FilmSlate, Gear, Lightbulb, Palette, Ruler, SpeakerHigh, Target, Tree, VideoCamera } from '@promptstudio/system/components/ui';
import { TAXONOMY } from '@shared/taxonomy';
import { getCategoryColor } from '@utils/PromptContext/categoryStyles';

/**
 * Category Configuration
 * Maps taxonomy parent category IDs to their visual and metadata properties
 */
// Get category colors from the highlight color system
const getCategoryColors = (categoryId: string) => {
  const colors = getCategoryColor(categoryId);
  return {
    backgroundColor: colors.bg,
    borderColor: colors.border,
  };
};

export const CATEGORY_CONFIG = {
  [TAXONOMY.SHOT.id]: {
    label: 'Shot Type',
    ...getCategoryColors(TAXONOMY.SHOT.id),
    icon: Ruler,
    order: 1,
    description: 'Framing and vantage of the camera',
  },
  [TAXONOMY.SUBJECT.id]: {
    label: 'Subject & Character',
    ...getCategoryColors(TAXONOMY.SUBJECT.id),
    icon: Target,
    order: 2,
    description: 'The focal point (person, object, animal) and their attributes',
  },
  [TAXONOMY.ACTION.id]: {
    label: 'Action & Motion',
    ...getCategoryColors(TAXONOMY.ACTION.id),
    icon: FilmSlate,
    order: 3,
    description: 'What the subject is doing (movement, state, gesture)',
  },
  [TAXONOMY.ENVIRONMENT.id]: {
    label: 'Environment',
    ...getCategoryColors(TAXONOMY.ENVIRONMENT.id),
    icon: Tree,
    order: 4,
    description: 'Location, weather, and spatial context',
  },
  [TAXONOMY.LIGHTING.id]: {
    label: 'Lighting',
    ...getCategoryColors(TAXONOMY.LIGHTING.id),
    icon: Lightbulb,
    order: 5,
    description: 'Light source, quality, and time of day',
  },
  [TAXONOMY.CAMERA.id]: {
    label: 'Camera',
    ...getCategoryColors(TAXONOMY.CAMERA.id),
    icon: VideoCamera,
    order: 6,
    description: 'Framing, movement, lens, and angles',
  },
  [TAXONOMY.STYLE.id]: {
    label: 'Style & Aesthetic',
    ...getCategoryColors(TAXONOMY.STYLE.id),
    icon: Palette,
    order: 7,
    description: 'Visual treatment, film stock, and aesthetic',
  },
  [TAXONOMY.TECHNICAL.id]: {
    label: 'Technical Specs',
    ...getCategoryColors(TAXONOMY.TECHNICAL.id),
    icon: Gear,
    order: 8,
    description: 'Frame rate, aspect ratio, and resolution',
  },
  [TAXONOMY.AUDIO.id]: {
    label: 'Audio',
    ...getCategoryColors(TAXONOMY.AUDIO.id),
    icon: SpeakerHigh,
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

