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
  // SHOT - Teal family
  shot: {
    shades: [
      { bg: '#f0fdfa', border: '#14b8a6' }, // Teal-50/500
      { bg: '#ccfbf1', border: '#0d9488' }, // Teal-100/600
    ],
  },
  
  // SUBJECT - Orange family
  subject: {
    shades: [
      { bg: '#fff7ed', border: '#f97316' }, // Orange-50/500
      { bg: '#ffedd5', border: '#ea580c' }, // Orange-100/600
      { bg: '#fed7aa', border: '#c2410c' }, // Orange-200/700
      { bg: '#fdba74', border: '#9a3412' }, // Orange-300/800
      { bg: '#fb923c', border: '#7c2d12' }, // Orange-400/900
    ],
  },
  
  // ACTION - Red family
  action: {
    shades: [
      { bg: '#fef2f2', border: '#ef4444' }, // Red-50/500
      { bg: '#fee2e2', border: '#dc2626' }, // Red-100/600
      { bg: '#fecaca', border: '#b91c1c' }, // Red-200/700
    ],
  },
  
  // ENVIRONMENT - Green family
  environment: {
    shades: [
      { bg: '#f0fdf4', border: '#22c55e' }, // Green-50/500
      { bg: '#dcfce7', border: '#16a34a' }, // Green-100/600
      { bg: '#bbf7d0', border: '#15803d' }, // Green-200/700
    ],
  },
  
  // LIGHTING - Yellow/Amber family
  lighting: {
    shades: [
      { bg: '#fefce8', border: '#eab308' }, // Yellow-50/500
      { bg: '#fef9c3', border: '#ca8a04' }, // Yellow-100/600
      { bg: '#fef08a', border: '#a16207' }, // Yellow-200/700
    ],
  },
  
  // CAMERA - Blue family
  camera: {
    shades: [
      { bg: '#eff6ff', border: '#3b82f6' }, // Blue-50/500
      { bg: '#dbeafe', border: '#2563eb' }, // Blue-100/600
      { bg: '#bfdbfe', border: '#1d4ed8' }, // Blue-200/700
      { bg: '#93c5fd', border: '#1e40af' }, // Blue-300/800
    ],
  },
  
  // STYLE - Purple/Fuchsia family
  style: {
    shades: [
      { bg: '#faf5ff', border: '#d946ef' }, // Fuchsia-50/500
      { bg: '#f3e8ff', border: '#c026d3' }, // Fuchsia-100/600
    ],
  },
  
  // TECHNICAL - Violet family
  technical: {
    shades: [
      { bg: '#f5f3ff', border: '#8b5cf6' }, // Violet-50/500
      { bg: '#ede9fe', border: '#7c3aed' }, // Violet-100/600
      { bg: '#ddd6fe', border: '#6d28d9' }, // Violet-200/700
      { bg: '#c4b5fd', border: '#5b21b6' }, // Violet-300/800
    ],
  },
  
  // AUDIO - Indigo family
  audio: {
    shades: [
      { bg: '#eef2ff', border: '#6366f1' }, // Indigo-50/500
      { bg: '#e0e7ff', border: '#4f46e5' }, // Indigo-100/600
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
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      console.warn(`[CategoryStyles] Invalid category: "${category}"`);
    }
    return { bg: '#fee2e2', border: '#ef4444' };
  }

  const parentId = parsed.parent;
  const attributeName = parsed.attribute;

  // Get the base color palette for this parent category
  const colorPalette = BASE_COLORS[parentId];
  if (!colorPalette) {
    // Unknown parent category
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      console.warn(`[CategoryStyles] Unknown parent category: "${parentId}"`);
    }
    return { bg: '#fee2e2', border: '#ef4444' };
  }

  // If it's a parent category (no attribute), use the first shade
  if (parsed.isParent || !attributeName) {
    return colorPalette.shades[0];
  }

  // It's an attribute - find its index in the parent's attributes array
  const attributes = getAttributesForParent(parentId);
  const attributeIndex = attributes.indexOf(resolvedCategory);
  
  if (attributeIndex === -1) {
    // Attribute not found in taxonomy, use first shade as fallback
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      console.warn(`[CategoryStyles] Attribute "${category}" not found in parent "${parentId}"`);
    }
    return colorPalette.shades[0];
  }

  // Use the shade index based on attribute position
  // If there are more attributes than shades, cycle through shades
  const shadeIndex = Math.min(attributeIndex, colorPalette.shades.length - 1);
  return colorPalette.shades[shadeIndex];
}

// Export as a static method on PromptContext for backward compatibility
export const CATEGORY_COLORS = getCategoryColor;

