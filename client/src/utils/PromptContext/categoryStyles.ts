import { TAXONOMY, parseCategoryId, getAttributesForParent, resolveCategory } from '@shared/taxonomy';

/**
 * Category Styling Configuration
 * 
 * UI styling rules for different highlight categories
 * Uses hierarchical taxonomy with unique colors per category
 * 
 * Color Strategy:
 * - Each parent category gets a unique, visually distinct color
 * - Higher saturation backgrounds (level 3) for better differentiation
 * - Stronger borders (level 6) for clear separation
 * - No color sharing between categories
 */

interface ColorScheme {
  bg: string;
  border: string;
}

/**
 * High-Contrast Color Palette
 * 
 * Each category gets a unique, easily distinguishable color.
 * Using more saturated shades (level 3 bg, level 6 border) than before.
 * Colors chosen for maximum visual separation when viewed together.
 */
const CATEGORY_PALETTE = {
  // SHOT - Cyan (camera framing, "what you see")
  shot: {
    bg: '#cffafe',      // cyan-100
    border: '#0891b2',  // cyan-600
  },
  
  // SUBJECT - Orange (warm, protagonist, focal point)
  subject: {
    bg: '#fed7aa',      // orange-200
    border: '#ea580c',  // orange-600
  },
  
  // ACTION - Rose (energy, movement, activity)
  action: {
    bg: '#fecdd3',      // rose-200
    border: '#e11d48',  // rose-600
  },
  
  // ENVIRONMENT - Emerald (nature, location, setting)
  environment: {
    bg: '#a7f3d0',      // emerald-200
    border: '#059669',  // emerald-600
  },
  
  // LIGHTING - Yellow (light, brightness, golden hour)
  lighting: {
    bg: '#fef08a',      // yellow-200
    border: '#ca8a04',  // yellow-600
  },
  
  // CAMERA - Sky Blue (technical but distinct from Shot's cyan)
  camera: {
    bg: '#bae6fd',      // sky-200
    border: '#0284c7',  // sky-600
  },
  
  // STYLE - Violet (creative, aesthetic, artistry)
  style: {
    bg: '#ddd6fe',      // violet-200
    border: '#7c3aed',  // violet-600
  },
  
  // TECHNICAL - Slate (metadata, specs, neutral)
  technical: {
    bg: '#e2e8f0',      // slate-200
    border: '#475569',  // slate-600
  },
  
  // AUDIO - Fuchsia (sound waves, distinct from purple/violet)
  audio: {
    bg: '#f5d0fe',      // fuchsia-200
    border: '#c026d3',  // fuchsia-600
  },
} as const;

/**
 * Legacy brainstorm category colors (backward compatibility)
 */
const LEGACY_COLORS: Record<string, ColorScheme> = {
  location: CATEGORY_PALETTE.environment,
  time: CATEGORY_PALETTE.lighting,
  mood: CATEGORY_PALETTE.style,
  event: CATEGORY_PALETTE.action,
  quality: CATEGORY_PALETTE.technical,
  color: CATEGORY_PALETTE.style,
};

/**
 * Default fallback color for unknown categories
 */
const FALLBACK_COLOR: ColorScheme = {
  bg: '#f1f5f9',      // slate-100
  border: '#94a3b8',  // slate-400
};

/**
 * Get category color for UI display
 * Uses taxonomy hierarchy with unique colors per category
 */
export function getCategoryColor(category: string): ColorScheme {
  // Check legacy categories first
  if (LEGACY_COLORS[category]) {
    return LEGACY_COLORS[category];
  }

  // Resolve legacy IDs to taxonomy IDs (e.g., 'wardrobe' -> 'subject.wardrobe')
  const resolvedCategory = resolveCategory(category);

  // Parse the category ID to determine if it's a parent or attribute
  const parsed = parseCategoryId(resolvedCategory);
  if (!parsed) {
    // Fallback for invalid categories
    if (import.meta.env?.DEV) {
      console.warn(`[CategoryStyles] Invalid category: "${category}"`);
    }
    return FALLBACK_COLOR;
  }

  const parentId = parsed.parent;

  // Get the color for this parent category
  const color = CATEGORY_PALETTE[parentId as keyof typeof CATEGORY_PALETTE];
  if (!color) {
    if (import.meta.env?.DEV) {
      console.warn(`[CategoryStyles] Unknown parent category: "${parentId}"`);
    }
    return FALLBACK_COLOR;
  }

  return color;
}

// Export as a static method on PromptContext for backward compatibility
export const CATEGORY_COLORS = getCategoryColor;
