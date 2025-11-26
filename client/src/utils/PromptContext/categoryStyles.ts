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
 * Base color palettes for each parent category
 * Each category has a unique color family with shade variations
 */
const BASE_COLORS: Record<string, {
  shades: Array<{ bg: string; border: string }>;
}> = {
  // SUBJECT - Warm Coral (protagonist, draws focus)
  subject: {
    shades: [
      { bg: '#FFF7ED', border: '#EA580C' }, // Warm Coral - main character energy
    ],
  },
  
  // ACTION - Red-Orange (movement, verbs, energy)
  action: {
    shades: [
      { bg: '#FEF2F2', border: '#DC2626' }, // Red-Orange - action, urgency
    ],
  },
  
  // ENVIRONMENT - Forest Green (nature, location, grounding)
  environment: {
    shades: [
      { bg: '#F0FDF4', border: '#16A34A' }, // Forest Green - place/nature
    ],
  },
  
  // LIGHTING - Golden Amber (light itself)
  lighting: {
    shades: [
      { bg: '#FFFBEB', border: '#D97706' }, // Golden Amber - light quality
    ],
  },
  
  // SHOT - Sky Blue (frame/POV, expansive perspective)
  shot: {
    shades: [
      { bg: '#F0F9FF', border: '#0284C7' }, // Sky Blue - composition, framing
    ],
  },
  
  // CAMERA - Slate Gray (equipment/mechanics, neutral technical)
  camera: {
    shades: [
      { bg: '#F8FAFC', border: '#64748B' }, // Slate Gray - technical, neutral
    ],
  },
  
  // STYLE - Violet (creative/aesthetic, artistry)
  style: {
    shades: [
      { bg: '#FAF5FF', border: '#9333EA' }, // Violet - artistry, mood, flair
    ],
  },
  
  // TECHNICAL - Cool Gray (specs/metadata, lowest visual priority)
  technical: {
    shades: [
      { bg: '#F9FAFB', border: '#6B7280' }, // Cool Gray - supporting info
    ],
  },
  
  // AUDIO - Deep Indigo (sound waves, depth, frequency)
  audio: {
    shades: [
      { bg: '#EEF2FF', border: '#4F46E5' }, // Deep Indigo - frequency, depth
    ],
  },
};

/**
 * Get category color for UI display
 * Uses taxonomy hierarchy with unique colors per category
 * Subcategories get different shades of their parent category's color
 */
export function getCategoryColor(category: string): ColorScheme {
  // Legacy brainstorm categories (keep for backward compatibility)
  const legacyColors: Record<string, ColorScheme> = {
    location: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.5)' },
    time: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.5)' },
    mood: { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.5)' },
    event: { bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.5)' },
    quality: { bg: '#f9fafb', border: '#6b7280' },
    color: { bg: '#fef3c7', border: '#f59e0b' },
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
    return { bg: '#fee2e2', border: '#ef4444' };
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
    return { bg: '#fee2e2', border: '#ef4444' };
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

