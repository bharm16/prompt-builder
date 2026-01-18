import { TAXONOMY, parseCategoryId, getAttributesForParent, resolveCategory } from '@shared/taxonomy';
import { logger } from '@/services/LoggingService';
import { categoryColors, DEFAULT_CATEGORY_COLOR } from '@/features/prompt-optimizer/config/categoryColors';

const log = logger.child('CategoryStyles');

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
  ring: string;
}

/**
 * High-Contrast Color Palette
 * 
 * Each category gets a unique, easily distinguishable color.
 * Using more saturated shades (level 3 bg, level 6 border) than before.
 * Colors chosen for maximum visual separation when viewed together.
 */
const CATEGORY_PALETTE = categoryColors as Record<string, ColorScheme>;

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
const FALLBACK_COLOR: ColorScheme = DEFAULT_CATEGORY_COLOR;

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
      log.warn('Invalid category; using fallback color', { operation: 'getCategoryColor', category });
    }
    return FALLBACK_COLOR;
  }

  const parentId = parsed.parent;

  // Get the color for this parent category
  const color = CATEGORY_PALETTE[parentId as keyof typeof CATEGORY_PALETTE];
  if (!color) {
    if (import.meta.env?.DEV) {
      log.warn('Unknown parent category; using fallback color', { operation: 'getCategoryColor', parentId, category });
    }
    return FALLBACK_COLOR;
  }

  return color;
}

// Export as a static method on PromptContext for backward compatibility
export const CATEGORY_COLORS = getCategoryColor;
