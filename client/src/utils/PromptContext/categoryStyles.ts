import { TAXONOMY, parseCategoryId, getAttributesForParent, resolveCategory } from '@shared/taxonomy';

/**
 * Category Styling Configuration
 * 
 * UI styling rules for different highlight categories
 * Uses hierarchical taxonomy with unique colors per category
 * 
 * Color Strategy:
 * - Each parent category gets a unique color family
 * - Subcategories (attributes) get different shades of the same color
 * - Shades progress from lighter to darker based on attribute order
 */

interface ColorScheme {
  bg: string;
  border: string;
}

/**
 * Geist Color Scales
 * Based on vercel.com/geist/colors
 * Each scale has 10 shades (1-10) where:
 * - Colors 1-3: Component backgrounds (lightest to darker)
 * - Colors 4-6: Borders (light to dark)
 * - Colors 7-8: High contrast backgrounds
 * - Colors 9-10: Text and icons (secondary to primary)
 */
const GEIST_COLORS = {
  // Gray scale (monochromatic base)
  gray: {
    1: '#fafafa',  // Background 1
    2: '#eaeaea',  // Background 2 / Color 1
    3: '#e5e5e5',  // Color 2 (hover)
    4: '#d4d4d4',  // Color 3 (active) / Border 4
    5: '#a3a3a3',  // Border 5
    6: '#737373',  // Border 6
    7: '#525252',  // High contrast 7
    8: '#404040',  // High contrast 8
    9: '#737373',  // Text 9 (secondary)
    10: '#171717', // Text 10 (primary)
  },
  // Amber scale (warm, golden)
  amber: {
    1: '#fffbeb',  // Background
    2: '#fef3c7',  // Color 1
    3: '#fde68a',  // Color 2
    4: '#fcd34d',  // Color 3 / Border 4
    5: '#f59e0b',  // Border 5
    6: '#d97706',  // Border 6
    7: '#b45309',  // High contrast 7
    8: '#92400e',  // High contrast 8
    9: '#78350f',  // Text 9
    10: '#451a03', // Text 10
  },
  // Red scale (action, urgency)
  red: {
    1: '#fef2f2',  // Background
    2: '#fee2e2',  // Color 1
    3: '#fecaca',  // Color 2
    4: '#fca5a5',  // Color 3 / Border 4
    5: '#ef4444',  // Border 5
    6: '#dc2626',  // Border 6
    7: '#b91c1c',  // High contrast 7
    8: '#991b1b',  // High contrast 8
    9: '#7f1d1d',  // Text 9
    10: '#450a0a', // Text 10
  },
  // Green scale (nature, environment)
  green: {
    1: '#f0fdf4',  // Background
    2: '#dcfce7',  // Color 1
    3: '#bbf7d0',  // Color 2
    4: '#86efac',  // Color 3 / Border 4
    5: '#22c55e',  // Border 5
    6: '#16a34a',  // Border 6
    7: '#15803d',  // High contrast 7
    8: '#166534',  // High contrast 8
    9: '#14532d',  // Text 9
    10: '#052e16', // Text 10
  },
  // Blue scale (expansive, perspective)
  blue: {
    1: '#eff6ff',  // Background
    2: '#dbeafe',  // Color 1
    3: '#bfdbfe',  // Color 2
    4: '#93c5fd',  // Color 3 / Border 4
    5: '#3b82f6',  // Border 5
    6: '#2563eb',  // Border 6
    7: '#1d4ed8',  // High contrast 7
    8: '#1e40af',  // High contrast 8
    9: '#1e3a8a',  // Text 9
    10: '#172554', // Text 10
  },
  // Purple scale (creative, artistry)
  purple: {
    1: '#faf5ff',  // Background
    2: '#f3e8ff',  // Color 1
    3: '#e9d5ff',  // Color 2
    4: '#d8b4fe',  // Color 3 / Border 4
    5: '#a855f7',  // Border 5
    6: '#9333ea',  // Border 6
    7: '#7e22ce',  // High contrast 7
    8: '#6b21a8',  // High contrast 8
    9: '#581c87',  // Text 9
    10: '#3b0764', // Text 10
  },
  // Teal scale (technical, neutral)
  teal: {
    1: '#f0fdfa',  // Background
    2: '#ccfbf1',  // Color 1
    3: '#99f6e4',  // Color 2
    4: '#5eead4',  // Color 3 / Border 4
    5: '#14b8a6',  // Border 5
    6: '#0d9488',  // Border 6
    7: '#0f766e',  // High contrast 7
    8: '#115e59',  // High contrast 8
    9: '#134e4a',  // Text 9
    10: '#042f2e', // Text 10
  },
} as const;

/**
 * Base color palettes for each parent category
 * Uses Geist color scales from vercel.com/geist/colors
 * Backgrounds use Color 1-2 (light component backgrounds)
 * Borders use Color 5-6 (border colors)
 */
const BASE_COLORS: Record<string, {
  shades: Array<{ bg: string; border: string }>;
}> = {
  // SUBJECT - Amber scale (warm, protagonist, draws focus)
  subject: {
    shades: [
      { bg: GEIST_COLORS.amber[2], border: GEIST_COLORS.amber[5] }, // Color 1 bg, Border 5
    ],
  },
  
  // ACTION - Red scale (movement, verbs, energy)
  action: {
    shades: [
      { bg: GEIST_COLORS.red[2], border: GEIST_COLORS.red[5] }, // Color 1 bg, Border 5
    ],
  },
  
  // ENVIRONMENT - Green scale (nature, location, grounding)
  environment: {
    shades: [
      { bg: GEIST_COLORS.green[2], border: GEIST_COLORS.green[5] }, // Color 1 bg, Border 5
    ],
  },
  
  // LIGHTING - Amber scale (light itself, golden)
  lighting: {
    shades: [
      { bg: GEIST_COLORS.amber[2], border: GEIST_COLORS.amber[6] }, // Color 1 bg, Border 6 (darker)
    ],
  },
  
  // SHOT - Blue scale (frame/POV, expansive perspective)
  shot: {
    shades: [
      { bg: GEIST_COLORS.blue[2], border: GEIST_COLORS.blue[5] }, // Color 1 bg, Border 5
    ],
  },
  
  // CAMERA - Gray scale (equipment/mechanics, neutral technical)
  camera: {
    shades: [
      { bg: GEIST_COLORS.gray[2], border: GEIST_COLORS.gray[5] }, // Color 1 bg, Border 5
    ],
  },
  
  // STYLE - Purple scale (creative/aesthetic, artistry)
  style: {
    shades: [
      { bg: GEIST_COLORS.purple[2], border: GEIST_COLORS.purple[5] }, // Color 1 bg, Border 5
    ],
  },
  
  // TECHNICAL - Gray scale (specs/metadata, lowest visual priority)
  technical: {
    shades: [
      { bg: GEIST_COLORS.gray[1], border: GEIST_COLORS.gray[4] }, // Background 1 bg, Border 4 (subtle)
    ],
  },
  
  // AUDIO - Teal scale (sound waves, depth, frequency)
  audio: {
    shades: [
      { bg: GEIST_COLORS.teal[2], border: GEIST_COLORS.teal[5] }, // Color 1 bg, Border 5
    ],
  },
};

/**
 * Get category color for UI display
 * Uses taxonomy hierarchy with unique colors per category
 * Subcategories get different shades of their parent category's color
 */
export function getCategoryColor(category: string): ColorScheme {
  // Legacy brainstorm categories (keep for backward compatibility) - Updated to Geist colors
  const legacyColors: Record<string, ColorScheme> = {
    location: { bg: GEIST_COLORS.green[2], border: GEIST_COLORS.green[5] }, // Green scale
    time: { bg: GEIST_COLORS.amber[2], border: GEIST_COLORS.amber[5] }, // Amber scale
    mood: { bg: GEIST_COLORS.purple[2], border: GEIST_COLORS.purple[5] }, // Purple scale
    event: { bg: GEIST_COLORS.blue[2], border: GEIST_COLORS.blue[5] }, // Blue scale
    quality: { bg: GEIST_COLORS.gray[1], border: GEIST_COLORS.gray[4] }, // Gray scale (subtle)
    color: { bg: GEIST_COLORS.amber[2], border: GEIST_COLORS.amber[5] }, // Amber scale
  };

  // Check legacy categories first
  if (legacyColors[category]) {
    return legacyColors[category];
  }

  // Resolve legacy IDs to taxonomy IDs (e.g., 'wardrobe' -> 'subject.wardrobe')
  const resolvedCategory = resolveCategory(category);

  // Parse the category ID to determine if it's a parent or attribute
  const parsed = parseCategoryId(resolvedCategory);
  if (!parsed) {
    // Fallback for invalid categories
    try {
      if ((import.meta as { env?: { DEV?: boolean } })?.env?.DEV) {
        console.warn(`[CategoryStyles] Invalid category: "${category}"`);
      }
    } catch {
      // Ignore errors in non-browser environments
    }
    return { bg: GEIST_COLORS.gray[1], border: GEIST_COLORS.gray[4] }; // Gray scale fallback
  }

  const parentId = parsed.parent;
  const attributeName = parsed.attribute;

  // Get the base color palette for this parent category
  const colorPalette = BASE_COLORS[parentId];
  if (!colorPalette || !colorPalette.shades || !Array.isArray(colorPalette.shades) || colorPalette.shades.length === 0) {
    // Unknown parent category or invalid palette
    try {
      if ((import.meta as { env?: { DEV?: boolean } })?.env?.DEV) {
        console.warn(`[CategoryStyles] Unknown parent category or invalid palette: "${parentId}"`);
      }
    } catch {
      // Ignore errors in non-browser environments
    }
    return { bg: GEIST_COLORS.gray[1], border: GEIST_COLORS.gray[4] }; // Gray scale fallback
  }

  // If it's a parent category (no attribute), use the first shade
  if (parsed.isParent || !attributeName) {
    return colorPalette.shades[0] || { bg: '#fee2e2', border: '#ef4444' };
  }

  // It's an attribute - find its index in the parent's attributes array
  const attributes = getAttributesForParent(parentId);
  const attributeIndex = attributes.indexOf(resolvedCategory);
  
  if (attributeIndex === -1) {
    // Attribute not found in taxonomy, use first shade as fallback
    try {
      if ((import.meta as { env?: { DEV?: boolean } })?.env?.DEV) {
        console.warn(`[CategoryStyles] Attribute "${category}" not found in parent "${parentId}"`);
      }
    } catch {
      // Ignore errors in non-browser environments
    }
    return colorPalette.shades[0] || { bg: '#fee2e2', border: '#ef4444' };
  }

  // Use the shade index based on attribute position
  // If there are more attributes than shades, cycle through shades
  const shadeIndex = Math.min(Math.max(0, attributeIndex), colorPalette.shades.length - 1);
  return colorPalette.shades[shadeIndex] || colorPalette.shades[0] || { bg: '#fee2e2', border: '#ef4444' };
}

// Export as a static method on PromptContext for backward compatibility
export const CATEGORY_COLORS = getCategoryColor;

