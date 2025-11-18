/**
 * Client-side descriptor category detection
 * Lightweight version for UI indicators
 */

const DESCRIPTOR_PATTERNS = {
  physical: /\b(face|eyes|hands|body|hair|build|skin|features|complexion|stature|physique|jaw|cheekbones|wrinkles|scars|marks|beard|mustache|eyebrows|nose|lips|ears|fingers|arms|legs|shoulders|neck|posture)\b/i,
  wardrobe: /\b(wearing|dressed|outfit|clothing|garment|coat|jacket|shirt|pants|trousers|dress|suit|hat|cap|shoes|boots|costume|uniform|attire|clad|donning|robe|vest|tie|scarf|gloves)\b/i,
  props: /\b(holding|carrying|clutching|gripping|wielding|cradling|grasping|with a|with an|brandishing|bearing)\b/i,
  emotional: /\b(expression|mood|demeanor|countenance|gaze|eyes (showing|reflecting|conveying)|face showing|looking|appearing|seeming|exuding|radiating)\b/i,
  action: /\b(standing|sitting|leaning|kneeling|crouching|walking|moving|gesturing|performing|dancing|playing|working|resting|lounging|perched|poised)\b/i,
  lighting: /\b(bathed|lit|illuminated|shadowed|highlighted|backlit|spotlit|glowing|dappled|framed by|silhouetted|rimlit)\b/i,
  contextual: /\b(surrounded by|amidst|among|framed by|against backdrop of|in front of|beside|near|underneath)\b/i,
};

const CATEGORY_COLORS = {
  physical: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  wardrobe: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A8A' },
  props: { bg: '#E9D5FF', border: '#A855F7', text: '#581C87' },
  emotional: { bg: '#FECACA', border: '#EF4444', text: '#991B1B' },
  action: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
  lighting: { bg: '#FED7AA', border: '#F97316', text: '#9A3412' },
  contextual: { bg: '#E0E7FF', border: '#6366F1', text: '#312E81' },
};

const CATEGORY_LABELS = {
  physical: 'Physical',
  wardrobe: 'Wardrobe',
  props: 'Props',
  emotional: 'Emotional',
  action: 'Action',
  lighting: 'Lighting',
  contextual: 'Context',
};

/**
 * Detect descriptor category from text
 * @param {string} text - Descriptor text to analyze
 * @returns {Object} { category: string|null, confidence: number, colors: Object|null, label: string|null }
 */
export function detectDescriptorCategoryClient(text) {
  if (!text || typeof text !== 'string') {
    return { category: null, confidence: 0, colors: null, label: null };
  }

  const textLower = text.toLowerCase().trim();
  const matches = [];

  for (const [category, pattern] of Object.entries(DESCRIPTOR_PATTERNS)) {
    if (pattern.test(text)) {
      const patternMatches = text.match(pattern) || [];
      const matchCount = patternMatches.length;
      
      // Base confidence
      let confidence = 0.6;
      
      // Increase for multiple matches
      confidence += Math.min(0.2, matchCount * 0.1);
      
      // Increase for short, focused descriptors
      const wordCount = textLower.split(/\s+/).length;
      if (wordCount <= 5) {
        confidence += 0.1;
      }
      
      matches.push({ category, confidence });
    }
  }

  if (matches.length === 0) {
    return { category: null, confidence: 0, colors: null, label: null };
  }

  // Return highest confidence match
  matches.sort((a, b) => b.confidence - a.confidence);
  const best = matches[0];
  
  return {
    category: best.category,
    confidence: best.confidence,
    colors: CATEGORY_COLORS[best.category],
    label: CATEGORY_LABELS[best.category],
  };
}

/**
 * Get color scheme for a category
 * @param {string} category - Category name
 * @returns {Object|null} Color scheme or null
 */
export function getCategoryColors(category) {
  return CATEGORY_COLORS[category] || null;
}

/**
 * Get display label for a category
 * @param {string} category - Category name
 * @returns {string} Display label
 */
export function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

/**
 * Get all available categories with metadata
 * @returns {Array} Array of category info
 */
export function getAllCategoriesInfo() {
  return Object.keys(DESCRIPTOR_PATTERNS).map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    colors: CATEGORY_COLORS[cat],
  }));
}

