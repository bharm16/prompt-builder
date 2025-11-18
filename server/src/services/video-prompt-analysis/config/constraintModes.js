/**
 * Constraint mode configurations for video prompt replacements
 * Each mode defines bounds, requirements, and guidance for suggestion generation
 */

/**
 * Generate constraint configuration with proper bounds
 */
function createConstraint(config, highlightWordCount, slotDescriptor) {
  const ensureBounds = (min, max) => {
    const lower = Math.max(1, Math.round(min));
    const upper = Math.max(lower, Math.round(max));
    return { min: lower, max: upper };
  };

  const bounds = ensureBounds(config.minWords, config.maxWords);
  
  return {
    ...config,
    minWords: bounds.min,
    maxWords: bounds.max,
    maxSentences: config.maxSentences ?? 1,
    slotDescriptor,
  };
}

/**
 * Constraint mode generators
 */
export const CONSTRAINT_MODES = {
  /**
   * Micro mode: 2-6 word noun phrase
   */
  micro: (highlightWordCount, slotDescriptor) => createConstraint({
    mode: 'micro',
    minWords: Math.max(2, Math.min(3, highlightWordCount + 1)),
    maxWords: Math.min(6, Math.max(4, highlightWordCount + 2)),
    maxSentences: 1,
    disallowTerminalPunctuation: true,
    formRequirement: '2-6 word cinematic noun phrase describing the same subject',
    focusGuidance: [
      'Use precise visual modifiers (wardrobe, era, material)',
      'Avoid verbs; keep the replacement as a noun phrase',
    ],
    extraRequirements: ['Keep it a noun phrase (no verbs)'],
  }, highlightWordCount, slotDescriptor),

  /**
   * Lighting mode: 6-14 word lighting clause
   */
  lighting: (highlightWordCount, slotDescriptor) => createConstraint({
    mode: 'lighting',
    minWords: Math.max(6, Math.min(8, highlightWordCount + 1)),
    maxWords: Math.min(14, Math.max(9, highlightWordCount + 4)),
    maxSentences: 1,
    formRequirement: 'Single lighting clause covering source, direction, and color temperature',
    focusGuidance: [
      'Name the light source and direction',
      'Include color temperature or mood language',
    ],
    extraRequirements: ['Mention light source + direction', 'Reference color temperature or mood'],
  }, highlightWordCount, slotDescriptor),

  /**
   * Camera mode: 6-12 word camera clause
   */
  camera: (highlightWordCount, slotDescriptor) => createConstraint({
    mode: 'camera',
    minWords: Math.max(6, Math.min(8, highlightWordCount + 1)),
    maxWords: Math.min(12, Math.max(9, highlightWordCount + 3)),
    maxSentences: 1,
    formRequirement: 'Single movement clause combining camera move, lens, and framing',
    focusGuidance: [
      'Pair a camera move with a lens choice and framing detail',
      'Stay in the same tense and perspective as the template',
    ],
    extraRequirements: ['Include a lens or focal length', 'Reference camera movement'],
  }, highlightWordCount, slotDescriptor),

  /**
   * Location mode: 6-14 word location beat
   */
  location: (highlightWordCount, slotDescriptor) => createConstraint({
    mode: 'location',
    minWords: Math.max(6, Math.min(8, highlightWordCount + 1)),
    maxWords: Math.min(14, Math.max(9, highlightWordCount + 4)),
    maxSentences: 1,
    formRequirement: 'Concise location beat with time-of-day or atmosphere',
    focusGuidance: [
      'Anchor the setting with sensory specifics',
      'Mention time of day or atmospheric detail',
    ],
    extraRequirements: ['Include a sensory or atmospheric hook'],
  }, highlightWordCount, slotDescriptor),

  /**
   * Style mode: 5-12 word stylistic phrase
   */
  style: (highlightWordCount, slotDescriptor) => createConstraint({
    mode: 'style',
    minWords: Math.max(5, Math.min(7, highlightWordCount + 1)),
    maxWords: Math.min(12, Math.max(8, highlightWordCount + 3)),
    maxSentences: 1,
    formRequirement: 'Compact stylistic phrase referencing medium, era, or tone',
    focusGuidance: [
      'Reference a medium, era, or artistic influence',
      'Keep it tightly scoped to the highlighted span',
    ],
    extraRequirements: [],
  }, highlightWordCount, slotDescriptor),

  /**
   * Phrase mode: 5-12 word cinematic clause
   */
  phrase: (highlightWordCount, slotDescriptor) => createConstraint({
    mode: 'phrase',
    minWords: Math.max(5, Math.min(7, highlightWordCount + 1)),
    maxWords: Math.min(12, Math.max(8, highlightWordCount + 3)),
    maxSentences: 1,
    formRequirement: 'Single cinematic clause focused on one production choice',
    focusGuidance: [
      'Emphasize one production detail (camera, lighting, subject, or location)',
      'Avoid expanding beyond the surrounding sentence',
    ],
    extraRequirements: [],
  }, highlightWordCount, slotDescriptor),

  /**
   * Sentence mode: 10-25 word cinematic sentence
   */
  sentence: (highlightWordCount, slotDescriptor) => createConstraint({
    mode: 'sentence',
    minWords: Math.max(10, Math.min(12, highlightWordCount + 2)),
    maxWords: Math.min(25, Math.max(14, highlightWordCount + 6)),
    maxSentences: 1,
    formRequirement: 'Single cinematic sentence that flows with the template',
    focusGuidance: [
      'Lead with the most important cinematic detail',
      'Keep it punchy—no compound sentences',
    ],
    extraRequirements: [],
  }, highlightWordCount, slotDescriptor),
};

/**
 * Constraint thresholds
 */
export const CONSTRAINT_THRESHOLDS = {
  VERY_SHORT_WORDS: 3,
  SENTENCE_WORDS: 12,
  PHRASE_MAX_WORDS: 8,
  MIN_CATEGORY_CONFIDENCE: 0.45,
};

