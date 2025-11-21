import { TAXONOMY, getParentCategory, isAttribute } from '#shared/taxonomy.js';

/**
 * Category Constraints Configuration
 * 
 * Provides validation rules, AI prompt instructions, and fallback suggestions
 * for video enhancement category constraints.
 * 
 * SCOPE: Enhancement service category validation
 * USED BY: 
 *   - CategoryAlignmentService (fallback suggestions)
 *   - PromptBuilderService (AI prompt constraints)
 *   - SuggestionValidationService (pattern validation)
 *   - CategoryDefinitionAggregator (metadata aggregation)
 * 
 * STRUCTURE:
 *   - CATEGORY_CONSTRAINTS: Configuration with patterns, instructions, fallbacks
 *   - detectSubcategory(): Detects technical subcategories
 *   - validateAgainstVideoTemplate(): Validates suggestion patterns
 * 
 * Now uses TAXONOMY constants as single source of truth
 * Aligned with VideoPromptTemplates.js requirements
 */

export const CATEGORY_CONSTRAINTS = {
  // ============================================================================
  // TECHNICAL SPECS
  // ============================================================================
  
  [TAXONOMY.TECHNICAL.id]: {
    frameRate: {
      pattern: /\d+fps|frames per second/i,
      instruction: "Generate ONLY frame rate values following video template: 24fps (Filmic) or 30fps (Standard Video) are primary. Can include 60fps, 120fps for special effects.",
      forbidden: "Do NOT suggest audio, lighting, colors, or any non-framerate options",
      fallbacks: [
        { text: "30fps", category: "technical", explanation: "Standard video frame rate" },
        { text: "24fps", category: "technical", explanation: "Cinematic frame rate" },
        { text: "60fps", category: "technical", explanation: "Smooth motion for action" },
        { text: "120fps", category: "technical", explanation: "Slow motion capture" },
        { text: "48fps", category: "technical", explanation: "HFR cinema standard" }
      ]
    },
    aspectRatio: {
      pattern: /\d+:\d+|aspect ratio/i,
      instruction: "Generate ONLY aspect ratios from video template: 16:9 (Landscape), 9:16 (Vertical), 2.39:1 (Cinematic)",
      forbidden: "Do NOT suggest frame rates, audio, or non-ratio options",
      fallbacks: [
        { text: "16:9", category: "technical", explanation: "Standard widescreen format" },
        { text: "9:16", category: "technical", explanation: "Vertical mobile format" },
        { text: "2.39:1", category: "technical", explanation: "Cinematic widescreen" },
        { text: "4:3", category: "technical", explanation: "Classic TV format" },
        { text: "1:1", category: "technical", explanation: "Square social media format" }
      ]
    },
    filmFormat: {
      pattern: /\d+mm|film|digital/i,
      instruction: "Generate film formats using cinematic language: 35mm film, 16mm, 70mm, digital cinema",
      forbidden: "Do NOT suggest non-format specifications",
      fallbacks: [
        { text: "35mm film", category: "technical", explanation: "Classic cinema aesthetic" },
        { text: "16mm", category: "technical", explanation: "Documentary indie feel" },
        { text: "70mm", category: "technical", explanation: "Epic large format" },
        { text: "digital cinema", category: "technical", explanation: "Modern 4K/8K capture" },
        { text: "Super 35", category: "technical", explanation: "Professional standard" }
      ]
    }
  },
  
  // ============================================================================
  // CAMERA ATTRIBUTES
  // ============================================================================
  
  [TAXONOMY.CAMERA.attributes.FRAMING]: {
    pattern: /shot|close-up|wide|medium|angle/i,
    instruction: "Generate shot types: wide shot, medium shot, close-up, extreme close-up using professional language",
    fallbacks: [
      { text: "wide shot", category: "framing", explanation: "Establishes environment" },
      { text: "medium shot", category: "framing", explanation: "Balanced framing" },
      { text: "close-up", category: "framing", explanation: "Intimate detail" },
      { text: "extreme close-up", category: "framing", explanation: "Intense focus" },
      { text: "over-the-shoulder", category: "framing", explanation: "Conversational angle" }
    ]
  },
  
  [TAXONOMY.CAMERA.attributes.MOVEMENT]: {
    pattern: /dolly|track|pan|tilt|crane|zoom|static/i,
    instruction: "Generate camera movements: static, slow dolly, handheld tracking, crane, pan using professional terms",
    fallbacks: [
      { text: "slow dolly forward", category: "cameraMove", explanation: "Smooth approach" },
      { text: "static shot", category: "cameraMove", explanation: "No camera movement" },
      { text: "handheld tracking", category: "cameraMove", explanation: "Dynamic following" },
      { text: "crane up", category: "cameraMove", explanation: "Rising reveal" },
      { text: "pan left to right", category: "cameraMove", explanation: "Horizontal sweep" }
    ]
  },
  
  // ============================================================================
  // LIGHTING
  // ============================================================================
  
  [TAXONOMY.LIGHTING.id]: {
    pattern: /light|shadow|illuminat|glow|bright|dark/i,
    instruction: "Generate lighting with source, direction, quality: 'soft window light from the left creating shadows'",
    fallbacks: [
      { text: "soft natural light", category: "lighting", explanation: "Diffused daylight" },
      { text: "dramatic rim lighting", category: "lighting", explanation: "Backlit edges" },
      { text: "warm golden hour", category: "lighting", explanation: "Sunset glow" },
      { text: "cool blue hour", category: "lighting", explanation: "Twilight tones" },
      { text: "high-key lighting", category: "lighting", explanation: "Bright even light" }
    ]
  },
  
  // ============================================================================
  // STYLE & AESTHETIC
  // ============================================================================
  
  [TAXONOMY.STYLE.id]: {
    pattern: /style|aesthetic|period|genre/i,
    instruction: "Generate style/genre alternatives, avoid generic 'cinematic'",
    forbidden: "Do NOT suggest lighting or technical specs",
    fallbacks: [
      { text: "film noir aesthetic", category: "descriptive", explanation: "Dark moody style" },
      { text: "documentary realism", category: "descriptive", explanation: "Authentic approach" },
      { text: "period drama style", category: "descriptive", explanation: "Historical aesthetic" },
      { text: "modern thriller", category: "descriptive", explanation: "Contemporary suspense" },
      { text: "vintage 70s look", category: TAXONOMY.STYLE.id, explanation: "Retro aesthetic" }
    ]
  },
  
  // ============================================================================
  // SUBJECT ATTRIBUTES
  // ============================================================================
  
  [TAXONOMY.SUBJECT.attributes.WARDROBE]: {
    pattern: /wearing|dressed|outfit|clothing|costume|attire|garment/i,
    instruction: "Generate wardrobe details: material, era, condition, fit. Example: 'wearing weathered leather jacket with brass buttons'",
    forbidden: "Do NOT suggest actions, emotions, or physical traits",
    fallbacks: [
      { text: "wearing sun-faded denim jacket", category: TAXONOMY.SUBJECT.attributes.WARDROBE, explanation: "Casual worn clothing" },
      { text: "dressed in vintage 1940s attire", category: TAXONOMY.SUBJECT.attributes.WARDROBE, explanation: "Period-specific costume" },
      { text: "in formal evening wear", category: TAXONOMY.SUBJECT.attributes.WARDROBE, explanation: "Upscale clothing" },
      { text: "clad in weathered work clothes", category: TAXONOMY.SUBJECT.attributes.WARDROBE, explanation: "Occupation-revealing" },
      { text: "donning wide-brimmed fedora", category: TAXONOMY.SUBJECT.attributes.WARDROBE, explanation: "Distinctive headwear" }
    ]
  },
  
  [TAXONOMY.SUBJECT.attributes.ACTION]: {
    pattern: /standing|sitting|leaning|walking|running|gesture|pose/i,
    instruction: "Generate subject actions or poses: what they're doing with their body. Example: 'leaning against weathered brick wall'",
    forbidden: "Do NOT suggest props or emotional states",
    fallbacks: [
      { text: "leaning against brick wall", category: TAXONOMY.SUBJECT.attributes.ACTION, explanation: "Casual relaxed stance" },
      { text: "standing in dramatic pose", category: TAXONOMY.SUBJECT.attributes.ACTION, explanation: "Staged heroic position" },
      { text: "sitting peacefully", category: TAXONOMY.SUBJECT.attributes.ACTION, explanation: "Resting calm pose" },
      { text: "crouching in shadows", category: TAXONOMY.SUBJECT.attributes.ACTION, explanation: "Low hidden position" },
      { text: "walking purposefully", category: TAXONOMY.SUBJECT.attributes.ACTION, explanation: "Determined movement" }
    ]
  },
  
  [TAXONOMY.SUBJECT.attributes.APPEARANCE]: {
    pattern: /face|body|build|hair|eyes|skin|features|appearance/i,
    instruction: "Generate physical appearance details: facial features, body type, distinctive marks. Example: 'with weathered hands and sun-worn face'",
    forbidden: "Do NOT suggest clothing or emotional states",
    fallbacks: [
      { text: "with weathered hands", category: TAXONOMY.SUBJECT.attributes.APPEARANCE, explanation: "Shows age and experience" },
      { text: "athletic build with broad shoulders", category: TAXONOMY.SUBJECT.attributes.APPEARANCE, explanation: "Body type indicator" },
      { text: "sharp angular features", category: TAXONOMY.SUBJECT.attributes.APPEARANCE, explanation: "Distinctive facial characteristics" },
      { text: "graying temples", category: TAXONOMY.SUBJECT.attributes.APPEARANCE, explanation: "Age marker" },
      { text: "calloused fingers", category: TAXONOMY.SUBJECT.attributes.APPEARANCE, explanation: "Physical detail revealing history" }
    ]
  }
};

/**
 * Detect subcategory based on text content
 * Now leverages taxonomy hierarchy
 * 
 * @param {string} highlightedText - Text to analyze
 * @param {string} category - Category ID from TAXONOMY
 * @returns {string|null} Subcategory name or null
 */
export function detectSubcategory(highlightedText, category) {
  if (!highlightedText || !category) return null;

  const normalized = highlightedText.toLowerCase();

  // Technical subcategories
  if (category === TAXONOMY.TECHNICAL.id) {
    if (/\d+fps|frame rate/i.test(highlightedText)) return 'frameRate';
    if (/\d+:\d+|aspect ratio/i.test(highlightedText)) return 'aspectRatio';
    if (/\d+mm|film|digital/i.test(highlightedText)) return 'filmFormat';
  }

  // If it's already an attribute, return it as the subcategory
  if (isAttribute(category)) {
    return category;
  }

  return null;
}

/**
 * Validate suggestion against video template requirements
 * Now uses taxonomy constants
 * 
 * @param {Object} suggestion - Suggestion object with text
 * @param {string} category - Category ID from TAXONOMY
 * @param {string} subcategory - Subcategory if applicable
 * @returns {boolean} True if valid
 */
export function validateAgainstVideoTemplate(suggestion, category, subcategory) {
  if (category === TAXONOMY.TECHNICAL.id && subcategory === 'frameRate') {
    return /\d+fps|frame rate/i.test(suggestion.text);
  }
  if (category === TAXONOMY.TECHNICAL.id && subcategory === 'aspectRatio') {
    return /\d+:\d+|aspect ratio/i.test(suggestion.text);
  }
  return true;
}

