/**
 * Semantic categories for subject descriptors in Video Concept Builder
 * Provides intelligent categorization without restricting user input
 */

export const DESCRIPTOR_CATEGORIES = {
  physical: {
    pattern: /\b(face|eyes|hands|body|hair|build|skin|features|complexion|stature|physique|jaw|cheekbones|wrinkles|scars|marks|beard|mustache|eyebrows|nose|lips|ears|fingers|arms|legs|shoulders|neck|posture)\b/i,
    examples: [
      'with weathered hands and sun-worn face',
      'sharp angular features with prominent jaw',
      'athletic build with broad shoulders',
      'graying temples and lined forehead',
    ],
    instruction: 'Describe observable physical characteristics - facial features, body type, skin, distinctive marks',
    forbidden: 'Do NOT suggest emotions, clothing, or props',
    fallbacks: [
      { text: 'with weathered hands', explanation: 'Shows age and experience through physical detail' },
      { text: 'athletic build with broad shoulders', explanation: 'Body type and physique indicator' },
      { text: 'sharp angular features', explanation: 'Distinctive facial characteristics' },
      { text: 'graying temples', explanation: 'Age marker through hair detail' },
      { text: 'calloused fingers', explanation: 'Physical detail revealing history' },
    ],
  },

  wardrobe: {
    pattern: /\b(wearing|dressed|outfit|clothing|garment|coat|jacket|shirt|pants|trousers|dress|suit|hat|cap|shoes|boots|costume|uniform|attire|clad|donning|robe|vest|tie|scarf|gloves)\b/i,
    examples: [
      'wearing a sun-faded denim jacket',
      'dressed in vintage 1940s attire',
      'in tattered wool coat with brass buttons',
      'clad in weathered leather boots',
    ],
    instruction: 'Describe clothing, costume, or wardrobe details with era, condition, materials, and specific garments',
    forbidden: 'Do NOT suggest actions, emotions, or physical traits',
    fallbacks: [
      { text: 'wearing sun-faded denim jacket', explanation: 'Casual worn clothing with texture' },
      { text: 'dressed in vintage 1940s attire', explanation: 'Period-specific costume' },
      { text: 'in formal evening wear', explanation: 'Upscale clothing choice' },
      { text: 'clad in weathered work clothes', explanation: 'Occupation-revealing wardrobe' },
      { text: 'donning wide-brimmed fedora', explanation: 'Distinctive headwear' },
    ],
  },

  props: {
    pattern: /\b(holding|carrying|clutching|gripping|wielding|cradling|grasping|with a|with an|brandishing|bearing)\b/i,
    examples: [
      'holding a worn leather journal',
      'clutching a silver harmonica',
      'carrying weathered wooden walking stick',
      'with antique brass compass',
    ],
    instruction: 'Describe objects the subject is holding, carrying, or interacting with - include condition and material',
    forbidden: 'Do NOT suggest clothing or body parts',
    fallbacks: [
      { text: 'holding worn leather journal', explanation: 'Personal item prop revealing character' },
      { text: 'clutching silver harmonica', explanation: 'Musical instrument with shine' },
      { text: 'carrying wooden cane', explanation: 'Practical aged prop' },
      { text: 'with vintage camera', explanation: 'Professional tool prop' },
      { text: 'gripping steel wrench', explanation: 'Work-related object' },
    ],
  },

  emotional: {
    pattern: /\b(expression|mood|demeanor|countenance|gaze|eyes (showing|reflecting|conveying)|face showing|looking|appearing|seeming|exuding|radiating)\b/i,
    examples: [
      'with weary expression and distant gaze',
      'face showing quiet determination',
      'eyes reflecting deep sadness',
      'exuding confident energy',
    ],
    instruction: 'Describe emotional state through visible cues - expression, gaze, body language, but keep it visual',
    forbidden: 'Do NOT suggest internal thoughts or non-visible emotions',
    fallbacks: [
      { text: 'with weary expression', explanation: 'Tired emotional state shown in face' },
      { text: 'showing quiet determination', explanation: 'Resolved mood through expression' },
      { text: 'eyes reflecting sadness', explanation: 'Melancholic feeling in gaze' },
      { text: 'exuding confident energy', explanation: 'Self-assured demeanor' },
      { text: 'distant contemplative gaze', explanation: 'Thoughtful emotional state' },
    ],
  },

  action: {
    pattern: /\b(standing|sitting|leaning|kneeling|crouching|walking|moving|gesturing|performing|dancing|playing|working|resting|lounging|perched|poised)\b/i,
    examples: [
      'leaning against weathered brick wall',
      'standing in dramatic heroic pose',
      'sitting cross-legged on worn floor',
      'crouching in ready position',
    ],
    instruction: 'Describe subject\'s pose, position, or ongoing action/stance - what they\'re doing with their body',
    forbidden: 'Do NOT suggest props or emotional states',
    fallbacks: [
      { text: 'leaning against brick wall', explanation: 'Casual relaxed stance' },
      { text: 'standing in dramatic pose', explanation: 'Staged heroic position' },
      { text: 'sitting peacefully', explanation: 'Resting calm pose' },
      { text: 'crouching in shadows', explanation: 'Low hidden position' },
      { text: 'perched on ledge', explanation: 'Elevated balanced pose' },
    ],
  },

  lighting: {
    pattern: /\b(bathed|lit|illuminated|shadowed|highlighted|backlit|spotlit|glowing|dappled|framed by|silhouetted|rimlit)\b/i,
    examples: [
      'bathed in warm golden hour light',
      'lit from below with dramatic shadows',
      'backlit by setting sun creating silhouette',
      'face half-shadowed in chiaroscuro',
    ],
    instruction: 'Describe how light interacts with the subject - direction, quality, color, shadows',
    forbidden: 'Do NOT suggest general scene lighting, focus on subject illumination',
    fallbacks: [
      { text: 'bathed in golden hour light', explanation: 'Warm atmospheric lighting on subject' },
      { text: 'lit dramatically from side', explanation: 'Directional lighting creating contrast' },
      { text: 'backlit with rim light', explanation: 'Edge lighting outlining subject' },
      { text: 'face half-shadowed', explanation: 'Split lighting technique' },
      { text: 'spotlit from above', explanation: 'Overhead directional light' },
    ],
  },

  contextual: {
    pattern: /\b(surrounded by|amidst|among|framed by|against backdrop of|in front of|beside|near|underneath)\b/i,
    examples: [
      'surrounded by curious onlookers',
      'framed by ornate doorway',
      'against backdrop of city skyline',
      'amidst swirling autumn leaves',
    ],
    instruction: 'Describe spatial relationship to environment - what\'s around the subject',
    forbidden: 'Do NOT describe the subject itself, focus on spatial context',
    fallbacks: [
      { text: 'surrounded by curious crowd', explanation: 'Social spatial context' },
      { text: 'framed by doorway', explanation: 'Architectural spatial relationship' },
      { text: 'against urban backdrop', explanation: 'Environmental context' },
      { text: 'amidst falling snow', explanation: 'Weather spatial element' },
      { text: 'beneath aged oak tree', explanation: 'Natural spatial context' },
    ],
  },
};

/**
 * Detect the semantic category of a descriptor text
 * @param {string} descriptorText - The descriptor text to analyze
 * @returns {Object} { category: string|null, confidence: number }
 */
export function detectDescriptorCategory(descriptorText) {
  if (!descriptorText || typeof descriptorText !== 'string') {
    return { category: null, confidence: 0 };
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
    return { category: null, confidence: 0 };
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  return matches[0];
}

/**
 * Get fallback suggestions for a category
 * @param {string} category - Category name
 * @returns {Array} Array of fallback suggestions
 */
export function getCategoryFallbacks(category) {
  return DESCRIPTOR_CATEGORIES[category]?.fallbacks || [];
}

/**
 * Get instruction text for a category
 * @param {string} category - Category name
 * @returns {string|null} Instruction text or null
 */
export function getCategoryInstruction(category) {
  return DESCRIPTOR_CATEGORIES[category]?.instruction || null;
}

/**
 * Get forbidden patterns for a category
 * @param {string} category - Category name
 * @returns {string|null} Forbidden text or null
 */
export function getCategoryForbidden(category) {
  return DESCRIPTOR_CATEGORIES[category]?.forbidden || null;
}

/**
 * Get all available category names
 * @returns {Array<string>} Array of category names
 */
export function getAllCategories() {
  return Object.keys(DESCRIPTOR_CATEGORIES);
}

/**
 * Check if text contains multiple conflicting categories
 * @param {string} text - Text to analyze
 * @returns {Array<Object>} Array of detected categories with confidence
 */
export function detectMultipleCategories(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const categories = [];
  for (const [category, config] of Object.entries(DESCRIPTOR_CATEGORIES)) {
    if (config.pattern.test(text)) {
      const detection = detectDescriptorCategory(text);
      if (detection.category === category) {
        categories.push(detection);
      }
    }
  }

  return categories.sort((a, b) => b.confidence - a.confidence);
}

