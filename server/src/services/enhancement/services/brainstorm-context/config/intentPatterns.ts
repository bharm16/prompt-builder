import { TAXONOMY } from '@shared/taxonomy';

/**
 * Intent Patterns Configuration
 *
 * Centralized configuration for creative intent detection, conflict analysis,
 * and element suggestion logic. Separates pattern data from business logic.
 */

// ============================================================================
// SUGGESTION MAPPINGS
// ============================================================================

/**
 * Suggestion mappings from creative intent to taxonomy categories
 * Maps semantic suggestions to structured taxonomy IDs
 */
export const SUGGESTION_MAPPINGS = {
  TIME_PERIOD: {
    category: TAXONOMY.STYLE.attributes.AESTHETIC,
    displayLabel: 'Time Period',
    reason: 'Nostalgic narratives need temporal anchoring',
  },
  VISUAL_TREATMENT: {
    category: TAXONOMY.STYLE.attributes.AESTHETIC,
    displayLabel: 'Visual Treatment',
    reason: 'Consider period-appropriate visual aesthetics',
  },
  LIGHTING: {
    category: TAXONOMY.LIGHTING.id,
    displayLabel: 'Lighting',
    reason: 'Lighting establishes mood and atmosphere',
  },
  MATERIALS: {
    category: TAXONOMY.ENVIRONMENT.attributes.CONTEXT,
    displayLabel: 'Materials & Textures',
    reason: 'Material choices reinforce aesthetic direction',
  },
  CAMERA: {
    category: TAXONOMY.CAMERA.id,
    displayLabel: 'Camera Work',
    reason: 'Camera choices affect viewer perspective and emotional impact',
  },
  ENVIRONMENT: {
    category: TAXONOMY.ENVIRONMENT.id,
    displayLabel: 'Environment',
    reason: 'Setting establishes context and supports narrative',
  },
} as const;

// ============================================================================
// CREATIVE INTENT PATTERNS
// ============================================================================

export interface IntentPattern {
  pattern: RegExp;
  intent: string;
  theme: string;
}

export const PRIMARY_INTENT_PATTERNS: IntentPattern[] = [
  {
    pattern: /\b(memory|nostalgia|past|vintage|retro)\b/,
    intent: 'nostalgic narrative',
    theme: 'temporal reflection',
  },
  {
    pattern: /\b(future|sci-fi|tech|neon|cyber)\b/,
    intent: 'futuristic vision',
    theme: 'technological advancement',
  },
  {
    pattern: /\b(dream|surreal|abstract|ethereal)\b/,
    intent: 'dreamlike exploration',
    theme: 'subconscious imagery',
  },
  {
    pattern: /\b(tense|thriller|dark|suspense)\b/,
    intent: 'tension and suspense',
    theme: 'psychological pressure',
  },
  {
    pattern: /\b(calm|peaceful|serene|gentle)\b/,
    intent: 'tranquil contemplation',
    theme: 'meditative atmosphere',
  },
  {
    pattern: /\b(action|dynamic|fast|energy)\b/,
    intent: 'kinetic energy',
    theme: 'movement and momentum',
  },
];

export interface NarrativePattern {
  pattern: RegExp;
  direction: string;
}

export const NARRATIVE_DIRECTION_PATTERNS: NarrativePattern[] = [
  {
    pattern: /\b(journey|travel|path|destination)\b/,
    direction: 'journey/quest',
  },
  {
    pattern: /\b(transform|change|evolve|become)\b/,
    direction: 'transformation',
  },
  {
    pattern: /\b(discover|reveal|uncover|find)\b/,
    direction: 'discovery',
  },
  {
    pattern: /\b(conflict|fight|struggle|battle)\b/,
    direction: 'conflict/resolution',
  },
];

export interface EmotionalTonePattern {
  pattern: RegExp;
  tone: string;
}

export const EMOTIONAL_TONE_PATTERNS: EmotionalTonePattern[] = [
  {
    pattern: /\b(hopeful|inspiring|uplifting)\b/,
    tone: 'hopeful',
  },
  {
    pattern: /\b(melancholic|sad|somber|bittersweet)\b/,
    tone: 'melancholic',
  },
  {
    pattern: /\b(joyful|happy|celebratory)\b/,
    tone: 'joyful',
  },
  {
    pattern: /\b(mysterious|enigmatic|cryptic)\b/,
    tone: 'mysterious',
  },
];

// ============================================================================
// CONFLICT DETECTION PATTERNS
// ============================================================================

export interface ConflictPattern {
  firstPattern: RegExp;
  secondPattern: RegExp;
  type: string;
  description: string;
  suggestion: string;
}

export const CONFLICT_PATTERNS: ConflictPattern[] = [
  {
    firstPattern: /\b(vintage|retro|historical)\b/,
    secondPattern: /\b(futuristic|sci-fi|neon)\b/,
    type: 'temporal_clash',
    description: 'Mixing vintage/historical with futuristic elements',
    suggestion: 'Decide on a primary time period or intentionally blend as retrofuturism',
  },
  {
    firstPattern: /\b(calm|peaceful|serene)\b/,
    secondPattern: /\b(chaotic|frantic|intense)\b/,
    type: 'mood_clash',
    description: 'Conflicting calm and chaotic moods',
    suggestion: 'Choose a primary mood or show contrast intentionally (e.g., calm before storm)',
  },
  {
    firstPattern: /\b(bright|sunny|golden hour)\b/,
    secondPattern: /\b(dark|moody|noir)\b/,
    type: 'lighting_clash',
    description: 'Mixing bright/sunny with dark/moody lighting',
    suggestion: 'Reconcile with "dramatic chiaroscuro" or choose one primary lighting tone',
  },
  {
    firstPattern: /\b(realistic|documentary|naturalistic)\b/,
    secondPattern: /\b(stylized|abstract|surreal)\b/,
    type: 'style_clash',
    description: 'Mixing realistic with highly stylized approaches',
    suggestion: 'Choose a primary visual approach or specify "stylized realism" as a hybrid',
  },
];

// ============================================================================
// COMPLEMENTARY ELEMENT RULES
// ============================================================================

export interface ComplementRule {
  pattern: RegExp;
  complements: Array<{ element: string; reason: string }>;
  intentSpecific?: {
    [intent: string]: Array<{ element: string; reason: string }>;
  };
}

export const COMPLEMENTARY_RULES: ComplementRule[] = [
  {
    pattern: /golden hour/i,
    complements: [
      { element: 'warm color grading', reason: 'Enhances golden hour warmth' },
      { element: 'rim lighting on subject', reason: 'Backlit subjects glow during golden hour' },
      { element: 'lens flare', reason: 'Natural from low-angle sun' },
    ],
  },
  {
    pattern: /underwater/i,
    complements: [
      { element: 'caustic light patterns', reason: 'Essential for underwater realism' },
      { element: 'slow, fluid movement', reason: 'Physics of water resistance' },
      { element: 'blue-green color cast', reason: 'Light absorption underwater' },
    ],
  },
  {
    pattern: /\b(moody|dark|noir)\b/i,
    complements: [
      { element: 'high contrast ratio (4:1+)', reason: 'Defines moody lighting technically' },
      { element: 'selective pools of light', reason: 'Creates dramatic shadows' },
      { element: 'smoke or haze', reason: 'Reveals light beams, adds atmosphere' },
    ],
  },
  {
    pattern: /handheld/i,
    complements: [
      { element: 'documentary-style framing', reason: 'Matches handheld aesthetic' },
      { element: 'natural lighting', reason: 'Enhances realism of handheld' },
    ],
    intentSpecific: {
      'tension and suspense': [
        { element: 'close-up framing', reason: 'Handheld + close-ups heighten claustrophobia' },
      ],
    },
  },
  {
    pattern: /\b(cinematic|film|35mm)\b/i,
    complements: [
      { element: '2.39:1 aspect ratio', reason: 'Classic cinema widescreen' },
      { element: 'shallow depth of field', reason: 'Film aesthetic, subject isolation' },
      { element: 'motivated lighting', reason: 'Professional film lighting approach' },
    ],
  },
];

// ============================================================================
// MISSING ELEMENT DETECTION KEYWORDS
// ============================================================================

export interface MissingElementKeywords {
  intent: string;
  checks: Array<{
    keywords: string[];
    suggestion: {
      category: string;
      displayLabel: string;
      reason: string;
    };
  }>;
}

export const MISSING_ELEMENT_RULES: MissingElementKeywords[] = [
  {
    intent: 'nostalgic narrative',
    checks: [
      {
        keywords: ['time', 'era', 'period', 'year'],
        suggestion: {
          category: SUGGESTION_MAPPINGS.TIME_PERIOD.category,
          displayLabel: SUGGESTION_MAPPINGS.TIME_PERIOD.displayLabel,
          reason: SUGGESTION_MAPPINGS.TIME_PERIOD.reason,
        },
      },
      {
        keywords: ['sepia', 'faded', 'vintage', 'aged'],
        suggestion: {
          category: SUGGESTION_MAPPINGS.VISUAL_TREATMENT.category,
          displayLabel: SUGGESTION_MAPPINGS.VISUAL_TREATMENT.displayLabel,
          reason: SUGGESTION_MAPPINGS.VISUAL_TREATMENT.reason,
        },
      },
    ],
  },
  {
    intent: 'futuristic vision',
    checks: [
      {
        keywords: ['neon', 'holographic', 'led', 'digital'],
        suggestion: {
          category: SUGGESTION_MAPPINGS.LIGHTING.category,
          displayLabel: SUGGESTION_MAPPINGS.LIGHTING.displayLabel,
          reason: 'Futuristic settings often feature artificial/neon lighting',
        },
      },
      {
        keywords: ['glass', 'metal', 'chrome', 'sleek'],
        suggestion: {
          category: SUGGESTION_MAPPINGS.MATERIALS.category,
          displayLabel: SUGGESTION_MAPPINGS.MATERIALS.displayLabel,
          reason: 'Futuristic aesthetics benefit from modern materials',
        },
      },
    ],
  },
  {
    intent: 'tension and suspense',
    checks: [
      {
        keywords: ['shadow', 'dim', 'low key', 'dark'],
        suggestion: {
          category: SUGGESTION_MAPPINGS.LIGHTING.category,
          displayLabel: SUGGESTION_MAPPINGS.LIGHTING.displayLabel,
          reason: 'Suspense typically requires low-key lighting for atmosphere',
        },
      },
      {
        keywords: ['close-up', 'dutch', 'handheld'],
        suggestion: {
          category: SUGGESTION_MAPPINGS.CAMERA.category,
          displayLabel: SUGGESTION_MAPPINGS.CAMERA.displayLabel,
          reason: 'Tension benefits from claustrophobic framing or unstable camera',
        },
      },
    ],
  },
];

export const NARRATIVE_MISSING_ELEMENT_RULES: Array<{
  narrativeDirection: string;
  checks: Array<{
    keywords: string[];
    suggestion: {
      category: string;
      displayLabel: string;
      reason: string;
    };
  }>;
}> = [
  {
    narrativeDirection: 'journey/quest',
    checks: [
      {
        keywords: ['landscape', 'path', 'road', 'horizon'],
        suggestion: {
          category: SUGGESTION_MAPPINGS.ENVIRONMENT.category,
          displayLabel: SUGGESTION_MAPPINGS.ENVIRONMENT.displayLabel,
          reason: 'Journey narratives often emphasize the landscape/path',
        },
      },
    ],
  },
];
