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
 * Aligned with VideoPromptTemplates.js requirements
 */

export const CATEGORY_CONSTRAINTS = {
  technical: {
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
  framing: {
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
  cameraMove: {
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
  lighting: {
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
  descriptive: {
    pattern: /style|aesthetic|period|genre/i,
    instruction: "Generate style/genre alternatives, avoid generic 'cinematic'",
    forbidden: "Do NOT suggest lighting or technical specs",
    fallbacks: [
      { text: "film noir aesthetic", category: "descriptive", explanation: "Dark moody style" },
      { text: "documentary realism", category: "descriptive", explanation: "Authentic approach" },
      { text: "period drama style", category: "descriptive", explanation: "Historical aesthetic" },
      { text: "modern thriller", category: "descriptive", explanation: "Contemporary suspense" },
      { text: "vintage 70s look", category: "descriptive", explanation: "Retro aesthetic" }
    ]
  }
};

export function detectSubcategory(highlightedText, category) {
  if (!highlightedText || !category) return null;

  const normalized = highlightedText.toLowerCase();

  if (category === 'technical') {
    if (/\d+fps|frame rate/i.test(highlightedText)) return 'frameRate';
    if (/\d+:\d+|aspect ratio/i.test(highlightedText)) return 'aspectRatio';
    if (/\d+mm|film|digital/i.test(highlightedText)) return 'filmFormat';
  }

  return null;
}

export function validateAgainstVideoTemplate(suggestion, category, subcategory) {
  if (category === 'technical' && subcategory === 'frameRate') {
    return /\d+fps|frame rate/i.test(suggestion.text);
  }
  if (category === 'technical' && subcategory === 'aspectRatio') {
    return /\d+:\d+|aspect ratio/i.test(suggestion.text);
  }
  return true;
}

