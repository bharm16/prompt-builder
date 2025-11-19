import { TAXONOMY } from '../../../../shared/taxonomy.js';

/**
 * Category Styling Configuration
 * 
 * UI styling rules for different highlight categories
 * Now uses hierarchical taxonomy for consistent color grouping
 * 
 * Color Strategy:
 * - All attributes of a parent category share the same base color
 * - Subject attributes (wardrobe, action, appearance) = Orange
 * - Environment/Lighting = Green
 * - Camera attributes = Blue
 * - Style/Technical = Purple
 */

// Master color groups mapped to taxonomy hierarchy
const COLOR_GROUPS = {
  // Subject & Character (Entity) - Orange family
  SUBJECT: {
    bg: '#fff7ed',        // Orange-50
    border: '#f97316'     // Orange-500
  },
  
  // Environment (Setting) - Green family
  ENVIRONMENT: {
    bg: '#f0fdf4',        // Green-50
    border: '#22c55e'     // Green-500
  },
  
  // Lighting (Setting) - Yellow/Green family
  LIGHTING: {
    bg: '#fefce8',        // Yellow-50
    border: '#eab308'     // Yellow-500
  },
  
  // Camera (Technical) - Blue family
  CAMERA: {
    bg: '#eff6ff',        // Blue-50
    border: '#3b82f6'     // Blue-500
  },
  
  // Style & Aesthetic (Technical) - Purple family
  STYLE: {
    bg: '#faf5ff',        // Fuchsia-50
    border: '#d946ef'     // Fuchsia-500
  },
  
  // Technical Specs (Technical) - Violet family
  TECHNICAL: {
    bg: '#f5f3ff',        // Violet-50
    border: '#8b5cf6'     // Violet-500
  },
  
  // Audio (Technical) - Indigo family
  AUDIO: {
    bg: '#eef2ff',        // Indigo-50
    border: '#6366f1'     // Indigo-500
  },
  
  // Narrative/Action (Entity attribute) - Red family
  ACTION: {
    bg: '#fef2f2',        // Red-50
    border: '#ef4444'     // Red-500
  },
};

/**
 * Get category color for UI display
 * Uses taxonomy hierarchy to ensure consistent colors
 * 
 * @param {string} category - Category ID from TAXONOMY
 * @returns {Object} Color configuration with bg and border properties
 */
export function getCategoryColor(category) {
  // Legacy brainstorm categories (keep for backward compatibility)
  const legacyColors = {
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

  // Check if it's a direct parent category match
  if (category === TAXONOMY.SUBJECT.id) return COLOR_GROUPS.SUBJECT;
  if (category === TAXONOMY.ENVIRONMENT.id) return COLOR_GROUPS.ENVIRONMENT;
  if (category === TAXONOMY.LIGHTING.id) return COLOR_GROUPS.LIGHTING;
  if (category === TAXONOMY.CAMERA.id) return COLOR_GROUPS.CAMERA;
  if (category === TAXONOMY.STYLE.id) return COLOR_GROUPS.STYLE;
  if (category === TAXONOMY.TECHNICAL.id) return COLOR_GROUPS.TECHNICAL;
  if (category === TAXONOMY.AUDIO.id) return COLOR_GROUPS.AUDIO;

  // Check if it's an attribute of a parent (hierarchical color assignment)
  // All subject attributes get subject color
  if (Object.values(TAXONOMY.SUBJECT.attributes).includes(category)) {
    // Special case: action gets its own red color for visual distinction
    if (category === TAXONOMY.SUBJECT.attributes.ACTION) {
      return COLOR_GROUPS.ACTION;
    }
    return COLOR_GROUPS.SUBJECT;
  }

  // All environment attributes get environment color
  if (Object.values(TAXONOMY.ENVIRONMENT.attributes).includes(category)) {
    return COLOR_GROUPS.ENVIRONMENT;
  }

  // All lighting attributes get lighting color
  if (Object.values(TAXONOMY.LIGHTING.attributes).includes(category)) {
    return COLOR_GROUPS.LIGHTING;
  }

  // All camera attributes get camera color
  if (Object.values(TAXONOMY.CAMERA.attributes).includes(category)) {
    return COLOR_GROUPS.CAMERA;
  }

  // All style attributes get style color
  if (Object.values(TAXONOMY.STYLE.attributes).includes(category)) {
    return COLOR_GROUPS.STYLE;
  }

  // All technical attributes get technical color
  if (Object.values(TAXONOMY.TECHNICAL.attributes).includes(category)) {
    return COLOR_GROUPS.TECHNICAL;
  }

  // All audio attributes get audio color
  if (Object.values(TAXONOMY.AUDIO.attributes).includes(category)) {
    return COLOR_GROUPS.AUDIO;
  }

  // Default fallback for unknown categories
  return { bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.5)' };
}

// Export as a static method on PromptContext for backward compatibility
export const CATEGORY_COLORS = getCategoryColor;

