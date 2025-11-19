/**
 * Category Styling Configuration
 * 
 * UI styling rules for different highlight categories
 * Note: This could arguably move to /styles or /config in the future
 */

/**
 * Get category color for UI display
 * 
 * @param {string} category - Category name
 * @returns {Object} Color configuration with bg and border properties
 */
export function getCategoryColor(category) {
  const colors = {
    // Brainstorm categories (Creative Brainstorm workflow)
    location: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.5)' }, // Green (brainstorm)
    time: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.5)' }, // Amber (brainstorm)
    mood: { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.5)' }, // Pink (brainstorm)
    event: { bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.5)' }, // Sky (brainstorm)
    
    // Span labeling categories (Updated taxonomy with hierarchical colors)
    // Subject Group (Orange hues)
    subject: { bg: '#fff7ed', border: '#f97316' }, // Orange-500
    appearance: { bg: '#fff7ed', border: '#fb923c' }, // Orange-400
    wardrobe: { bg: '#fff7ed', border: '#fdba74' }, // Orange-300
    
    // Narrative (Red)
    movement: { bg: '#fef2f2', border: '#ef4444' }, // Red-500
    
    // Environment (Green hues)
    environment: { bg: '#f0fdf4', border: '#22c55e' }, // Green-500
    lighting: { bg: '#f0fdf4', border: '#4ade80' }, // Green-400
    
    // Cinematic (Blue hues)
    camera: { bg: '#eff6ff', border: '#3b82f6' }, // Blue-500
    framing: { bg: '#eff6ff', border: '#60a5fa' }, // Blue-400
    
    // Technical/Style (Purple hues)
    specs: { bg: '#f5f3ff', border: '#8b5cf6' }, // Violet-500
    style: { bg: '#faf5ff', border: '#d946ef' }, // Fuchsia-500
    
    // Meta (Gray)
    quality: { bg: '#f9fafb', border: '#6b7280' }, // Gray-500
  };

  return colors[category] || { bg: 'rgba(156, 163, 175, 0.15)', border: 'rgba(156, 163, 175, 0.5)' };
}

// Export as a static method on PromptContext for backward compatibility
export const CATEGORY_COLORS = getCategoryColor;

