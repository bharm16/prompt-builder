/**
 * Client-side descriptor category detection
 * Lightweight version for UI indicators
 */

type DescriptorCategory = 'physical' | 'wardrobe' | 'props' | 'emotional' | 'action' | 'lighting' | 'contextual';

interface CategoryColors {
  bg: string;
  border: string;
  text: string;
}

interface CategoryInfo {
  category: DescriptorCategory | null;
  confidence: number;
  colors: CategoryColors | null;
  label: string | null;
}

const DESCRIPTOR_PATTERNS: Record<DescriptorCategory, RegExp> = {
  physical: /\b(face|eyes|hands|body|hair|build|skin|features|complexion|stature|physique|jaw|cheekbones|wrinkles|scars|marks|beard|mustache|eyebrows|nose|lips|ears|fingers|arms|legs|shoulders|neck|posture)\b/i,
  wardrobe: /\b(wearing|dressed|outfit|clothing|garment|coat|jacket|shirt|pants|trousers|dress|suit|hat|cap|shoes|boots|costume|uniform|attire|clad|donning|robe|vest|tie|scarf|gloves)\b/i,
  props: /\b(holding|carrying|clutching|gripping|wielding|cradling|grasping|with a|with an|brandishing|bearing)\b/i,
  emotional: /\b(expression|mood|demeanor|countenance|gaze|eyes (showing|reflecting|conveying)|face showing|looking|appearing|seeming|exuding|radiating)\b/i,
  action: /\b(standing|sitting|leaning|kneeling|crouching|walking|moving|gesturing|performing|dancing|playing|working|resting|lounging|perched|poised)\b/i,
  lighting: /\b(bathed|lit|illuminated|shadowed|highlighted|backlit|spotlit|glowing|dappled|framed by|silhouetted|rimlit)\b/i,
  contextual: /\b(surrounded by|amidst|among|framed by|against backdrop of|in front of|beside|near|underneath)\b/i,
};

const CATEGORY_COLORS: Record<DescriptorCategory, CategoryColors> = {
  physical: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  wardrobe: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A8A' },
  props: { bg: '#E9D5FF', border: '#A855F7', text: '#581C87' },
  emotional: { bg: '#FECACA', border: '#EF4444', text: '#991B1B' },
  action: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
  lighting: { bg: '#FED7AA', border: '#F97316', text: '#9A3412' },
  contextual: { bg: '#E0E7FF', border: '#6366F1', text: '#312E81' },
};

const CATEGORY_LABELS: Record<DescriptorCategory, string> = {
  physical: 'Physical',
  wardrobe: 'Wardrobe',
  props: 'Props',
  emotional: 'Emotional',
  action: 'Action',
  lighting: 'Lighting',
  contextual: 'Context',
};

interface MatchResult {
  category: DescriptorCategory;
  confidence: number;
}

/**
 * Detect descriptor category from text
 */
export function detectDescriptorCategoryClient(text: string | null | undefined): CategoryInfo {
  if (!text || typeof text !== 'string') {
    return { category: null, confidence: 0, colors: null, label: null };
  }

  const textLower = text.toLowerCase().trim();
  const matches: MatchResult[] = [];

  for (const [category, pattern] of Object.entries(DESCRIPTOR_PATTERNS) as [DescriptorCategory, RegExp][]) {
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
 */
export function getCategoryColors(category: string | null | undefined): CategoryColors | null {
  if (!category || typeof category !== 'string') {
    return null;
  }
  return CATEGORY_COLORS[category as DescriptorCategory] || null;
}

/**
 * Get display label for a category
 */
export function getCategoryLabel(category: string | null | undefined): string {
  if (!category || typeof category !== 'string') {
    return category || '';
  }
  return CATEGORY_LABELS[category as DescriptorCategory] || category;
}

interface CategoryMetadata {
  category: DescriptorCategory;
  label: string;
  colors: CategoryColors;
}

/**
 * Get all available categories with metadata
 */
export function getAllCategoriesInfo(): CategoryMetadata[] {
  return (Object.keys(DESCRIPTOR_PATTERNS) as DescriptorCategory[]).map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    colors: CATEGORY_COLORS[cat],
  }));
}

