import { TAXONOMY } from "#shared/taxonomy.ts";

interface DescriptorCategory {
  pattern: RegExp;
  examples: string[];
  instruction: string;
  forbidden: string;
}

interface DetectionResult {
  category: string | null;
  taxonomyId: string | null;
  confidence: number;
}

/**
 * Semantic categories for subject descriptors in Video Concept Builder
 * Provides intelligent categorization without restricting user input
 * Now mapped to TAXONOMY.SUBJECT.attributes for consistency
 */

export const DESCRIPTOR_CATEGORIES: Record<string, DescriptorCategory> = {
  // Maps to TAXONOMY.SUBJECT.attributes.APPEARANCE
  physical: {
    pattern:
      /\b(face|eyes|hands|body|hair|build|skin|features|complexion|stature|physique|jaw|cheekbones|wrinkles|scars|marks|beard|mustache|eyebrows|nose|lips|ears|fingers|arms|legs|shoulders|neck|posture)\b/i,
    examples: [
      "with weathered hands and sun-worn face",
      "sharp angular features with prominent jaw",
      "athletic build with broad shoulders",
      "graying temples and lined forehead",
    ],
    instruction:
      "Describe observable physical characteristics - facial features, body type, skin, distinctive marks",
    forbidden: "Do NOT suggest emotions, clothing, or props",
  },

  // Maps to TAXONOMY.SUBJECT.attributes.WARDROBE
  wardrobe: {
    pattern:
      /\b(wearing|dressed|outfit|clothing|garment|coat|jacket|shirt|pants|trousers|dress|suit|hat|cap|shoes|boots|costume|uniform|attire|clad|donning|robe|vest|tie|scarf|gloves)\b/i,
    examples: [
      "wearing a sun-faded denim jacket",
      "dressed in vintage 1940s attire",
      "in tattered wool coat with brass buttons",
      "clad in weathered leather boots",
    ],
    instruction:
      "Describe clothing, costume, or wardrobe details with era, condition, materials, and specific garments",
    forbidden: "Do NOT suggest actions, emotions, or physical traits",
  },

  // Props - Related to subject interaction (could map to ACTION or remain standalone)
  props: {
    pattern:
      /\b(holding|carrying|clutching|gripping|wielding|cradling|grasping|with a|with an|brandishing|bearing)\b/i,
    examples: [
      "holding a worn leather journal",
      "clutching a silver harmonica",
      "carrying weathered wooden walking stick",
      "with antique brass compass",
    ],
    instruction:
      "Describe objects the subject is holding, carrying, or interacting with - include condition and material",
    forbidden: "Do NOT suggest clothing or body parts",
  },

  // Maps to TAXONOMY.SUBJECT.attributes.EMOTION
  emotional: {
    pattern:
      /\b(expression|mood|demeanor|countenance|gaze|eyes (showing|reflecting|conveying)|face showing|looking|appearing|seeming|exuding|radiating)\b/i,
    examples: [
      "with weary expression and distant gaze",
      "face showing quiet determination",
      "eyes reflecting deep sadness",
      "exuding confident energy",
    ],
    instruction:
      "Describe emotional state through visible cues - expression, gaze, body language, but keep it visual",
    forbidden: "Do NOT suggest internal thoughts or non-visible emotions",
  },

  // Maps to TAXONOMY.SUBJECT.attributes.ACTION
  action: {
    pattern:
      /\b(standing|sitting|leaning|kneeling|crouching|walking|moving|gesturing|performing|dancing|playing|working|resting|lounging|perched|poised)\b/i,
    examples: [
      "leaning against weathered brick wall",
      "standing in dramatic heroic pose",
      "sitting cross-legged on worn floor",
      "crouching in ready position",
    ],
    instruction:
      "Describe subject's pose, position, or ongoing action/stance - what they're doing with their body",
    forbidden: "Do NOT suggest props or emotional states",
  },

  // Maps to TAXONOMY.LIGHTING (subject-specific lighting)
  lighting: {
    pattern:
      /\b(bathed|lit|illuminated|shadowed|highlighted|backlit|spotlit|glowing|dappled|framed by|silhouetted|rimlit)\b/i,
    examples: [
      "bathed in warm golden hour light",
      "lit from below with dramatic shadows",
      "backlit by setting sun creating silhouette",
      "face half-shadowed in chiaroscuro",
    ],
    instruction:
      "Describe how light interacts with the subject - direction, quality, color, shadows",
    forbidden:
      "Do NOT suggest general scene lighting, focus on subject illumination",
  },

  // Maps to TAXONOMY.ENVIRONMENT (spatial context)
  contextual: {
    pattern:
      /\b(surrounded by|amidst|among|framed by|against backdrop of|in front of|beside|near|underneath)\b/i,
    examples: [
      "surrounded by curious onlookers",
      "framed by ornate doorway",
      "against backdrop of city skyline",
      "amidst swirling autumn leaves",
    ],
    instruction:
      "Describe spatial relationship to environment - what's around the subject",
    forbidden: "Do NOT describe the subject itself, focus on spatial context",
  },
};

/**
 * Map descriptor category to TAXONOMY constant
 * @param {string} descriptorCategory - Local descriptor category name
 * @returns {string|null} Corresponding TAXONOMY ID
 */
export function mapDescriptorCategoryToTaxonomy(
  descriptorCategory: string,
): string | null {
  const mapping: Record<string, string> = {
    physical: TAXONOMY.SUBJECT.attributes.APPEARANCE,
    wardrobe: TAXONOMY.SUBJECT.attributes.WARDROBE,
    emotional: TAXONOMY.SUBJECT.attributes.EMOTION,
    action: TAXONOMY.SUBJECT.attributes.ACTION,
    lighting: TAXONOMY.LIGHTING.id,
    contextual: TAXONOMY.ENVIRONMENT.id,
    props: "props", // Keep standalone for now
  };

  return mapping[descriptorCategory] || null;
}

/**
 * Detect the semantic category of a descriptor text
 * Now returns both local category and taxonomy ID
 * @param {string} descriptorText - The descriptor text to analyze
 * @returns {Object} { category: string|null, taxonomyId: string|null, confidence: number }
 */
export function detectDescriptorCategory(
  descriptorText: string,
): DetectionResult {
  if (!descriptorText || typeof descriptorText !== "string") {
    return { category: null, taxonomyId: null, confidence: 0 };
  }

  const text = descriptorText.toLowerCase().trim();
  const matches = [];

  for (const [category, config] of Object.entries(DESCRIPTOR_CATEGORIES)) {
    const match = config.pattern.test(text);
    if (match) {
      // Calculate confidence based on pattern strength and word overlap
      const patternMatches = text.match(config.pattern) || [];
      const matchCount = patternMatches.length;

      // Base confidence on match presence
      let confidence = 0.6;

      // Increase confidence for multiple matches
      confidence += Math.min(0.2, matchCount * 0.1);

      // Increase confidence if descriptor is short (more likely to be focused)
      const wordCount = text.split(/\s+/).length;
      if (wordCount <= 5) {
        confidence += 0.1;
      }

      matches.push({ category, confidence });
    }
  }

  // Return highest confidence match, or null if none
  if (matches.length === 0) {
    return { category: null, taxonomyId: null, confidence: 0 };
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  const topMatch = matches[0]!;

  return {
    category: topMatch.category,
    taxonomyId: mapDescriptorCategoryToTaxonomy(topMatch.category),
    confidence: topMatch.confidence,
  };
}

/**
 * Get instruction text for a category
 * @param {string} category - Category name
 * @returns {string|null} Instruction text or null
 */
export function getCategoryInstruction(category: string): string | null {
  return DESCRIPTOR_CATEGORIES[category]?.instruction || null;
}

/**
 * Get forbidden patterns for a category
 * @param {string} category - Category name
 * @returns {string|null} Forbidden text or null
 */
export function getCategoryForbidden(category: string): string | null {
  return DESCRIPTOR_CATEGORIES[category]?.forbidden || null;
}

/**
 * Get all available category names
 * @returns {Array<string>} Array of category names
 */
export function getAllCategories(): string[] {
  return Object.keys(DESCRIPTOR_CATEGORIES);
}
