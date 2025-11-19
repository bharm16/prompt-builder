import { TAXONOMY, VALID_CATEGORIES, getParentCategory } from '../../../../../shared/taxonomy.js';

// ============================================================================
// REGEX PATTERNS (Preserved from legacy implementation)
// ============================================================================

const GENERIC_ADJECTIVES = new Set([
  'beautiful',
  'cinematic',
  'stunning',
  'gorgeous',
  'amazing',
  'awesome',
  'cool',
  'dramatic',
  'epic',
  'incredible',
  'vivid',
  'moody',
]);

const CAMERA_MOTION_TERMS = /\b(dolly|truck|push|pull|pan|tilt|crane|jib|boom|track|tracking|follow|following|zoom|racking)\b/i;
const CAMERA_DEVICE_TERMS = /\b(camera|shot|angle|lens|handheld|steadicam|gimbal|fpv|wide|close[-\s]?up|macro)\b/i;
const LENS_SPEC = /\b(?:\d{1,3}(?:\.\d+)?\s?mm|f\/\d+(?:\.\d+)?|t\d+(?:\.\d+)?|anamorphic)\b/i;

const LIGHT_SOURCE_TERMS = /\b(key|fill|rim|back|practical|spot|flood|softbox|lantern|gel|bounce|ambient|neon|moonlight|sunlight|candlelight|torch)\b/i;
const LIGHT_MODIFIER_TERMS = /\b(warm|cool|soft|hard|golden|diffused?|dappled|glowing|dramatic|harsh|muted|pulsing|flickering|noir|pastel|neon|chiaroscuro)\b/i;

const TECH_UNIT = /\b(?:mm|fps|k|°?k|kelvin|f\/\d+(?:\.\d+)?|t\d+(?:\.\d+)?|iso|sec|secs|seconds|s|ms|megapixels?|mp|bitrate|khz|mhz)\b/i;
const TECH_NUMBER_UNIT = /\b\d+(?:\.\d+)?\s?(?:mm|fps|k|°?k|kelvin|iso|sec|secs|seconds|s|ms|hz|khz|mhz|bit|bits|bitrate)\b/i;

const STYLE_NOUN = /\b(palette|aesthetic|lighting|look|grade|treatment|tone|style|composition|atmosphere)\b/i;
const STYLE_ADJ = /\b(noir|pastel|monochrome|analog|grainy|dreamy|painterly|surreal|documentary|handheld|minimalist|minimal|expressionist|baroque|graphic|cel-shaded)\b/i;

const ENVIRONMENT_NOUN = /\b(street|alley|alleyway|alleyways|warehouse|factory|rooftop|forest|desert|interior|exterior|cavern|bridge|corridor|hallway|market|shore|coast|temple|cathedral|diner|station|plaza|square|ship|hangar)\b/i;

// Simple word detection patterns for validation (replaces compromise.js NLP)
const ADJECTIVE_PATTERN = /\b(warm|cool|soft|hard|golden|dark|bright|vivid|moody|dramatic|epic|stunning|beautiful|cinematic|gorgeous|amazing|incredible|noir|pastel|monochrome|analog|grainy|dreamy|painterly|surreal|documentary|minimalist|minimal|expressionist|baroque|graphic)\b/i;
const VERB_PATTERN = /\b(dolly|truck|push|pull|pan|tilt|crane|zoom|track|follow|move|shift|glide|sweep|drift)\b/i;
const NOUN_PATTERN = /\b(shot|movement|camera|lighting|light|style|aesthetic|look|atmosphere|tone|mood|composition|framing|angle)\b/i;

// ============================================================================
// LEGACY COMPATIBILITY LAYER
// ============================================================================

/**
 * Maps old flat IDs to new Taxonomy IDs on the fly.
 * Provides backward compatibility during migration.
 */
export const LEGACY_MAPPINGS = {
  'cameramove': TAXONOMY.CAMERA.attributes.MOVEMENT,
  'aesthetic': TAXONOMY.STYLE.attributes.AESTHETIC,
  'timeOfDay': TAXONOMY.LIGHTING.attributes.TIME,
  'time': TAXONOMY.LIGHTING.attributes.TIME,
  'mood': TAXONOMY.STYLE.id,
  'framing': TAXONOMY.CAMERA.attributes.FRAMING,
  'filmFormat': TAXONOMY.STYLE.attributes.FILM_STOCK,
  'cameraMove': TAXONOMY.CAMERA.attributes.MOVEMENT,
  'location': TAXONOMY.ENVIRONMENT.attributes.LOCATION,
  'subject': TAXONOMY.SUBJECT.id,
  'action': TAXONOMY.SUBJECT.attributes.ACTION,
  'camera': TAXONOMY.CAMERA.id,
  'lighting': TAXONOMY.LIGHTING.id,
  'technical': TAXONOMY.TECHNICAL.id,
  'style': TAXONOMY.STYLE.id,
  'environment': TAXONOMY.ENVIRONMENT.id,
};

/**
 * Attributes that inherit their parent's regex validator
 */
const INHERIT_PARENT_VALIDATION = new Set([
  TAXONOMY.TECHNICAL.attributes.FPS,
  TAXONOMY.TECHNICAL.attributes.RESOLUTION,
  TAXONOMY.TECHNICAL.attributes.ASPECT_RATIO,
  TAXONOMY.CAMERA.attributes.LENS,
  TAXONOMY.CAMERA.attributes.ANGLE,
  TAXONOMY.STYLE.attributes.FILM_STOCK,
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const ensureText = (span) => (span?.text || span?.quote || '').trim();

// Simple pattern matcher (replaces compromise.js testNLPPattern)
const hasVerbAndNoun = (text) => {
  return VERB_PATTERN.test(text) && NOUN_PATTERN.test(text);
};

const hasAdjAndNoun = (text) => {
  return ADJECTIVE_PATTERN.test(text) && NOUN_PATTERN.test(text);
};

const extractAdjectives = (text) => {
  const matches = text.match(ADJECTIVE_PATTERN);
  return matches ? matches.map(m => m.toLowerCase()) : [];
};

// ============================================================================
// CATEGORY-SPECIFIC VALIDATORS
// ============================================================================

const cameraValidator = (span) => {
  const text = ensureText(span);
  if (!text) return { pass: false, reason: 'empty_text' };

  if (CAMERA_MOTION_TERMS.test(text)) {
    return { pass: true };
  }

  if (LENS_SPEC.test(text) && CAMERA_DEVICE_TERMS.test(text)) {
    return { pass: true };
  }

  if (hasVerbAndNoun(text)) {
    return { pass: true };
  }

  return { pass: false, reason: 'camera_missing_motion_or_lens_action' };
};

const lightingValidator = (span) => {
  const text = ensureText(span);
  if (!text) return { pass: false, reason: 'empty_text' };

  const hasSource = LIGHT_SOURCE_TERMS.test(text);
  const hasModifier = LIGHT_MODIFIER_TERMS.test(text);

  if (hasSource && hasModifier) return { pass: true };

  if (hasModifier && /\b(glow|wash|beam|flare)\b/i.test(text)) {
    return { pass: true };
  }

  if (hasSource) {
    if (hasAdjAndNoun(text) || hasVerbAndNoun(text)) {
      return { pass: true };
    }
    if (/\blight(?:ing)?\b/i.test(text)) {
      return { pass: true };
    }
  }

  if (hasModifier && /\blight(?:ing)?\b/i.test(text)) {
    return { pass: true };
  }

  return { pass: false, reason: 'lighting_missing_source_or_modifier' };
};

const technicalValidator = (span) => {
  const text = ensureText(span);
  if (!text) return { pass: false, reason: 'empty_text' };

  if (span.metadata?.unitMatch) return { pass: true };

  if (TECH_NUMBER_UNIT.test(text)) return { pass: true };
  if (TECH_UNIT.test(text) && /\d/.test(text)) return { pass: true };

  return { pass: false, reason: 'technical_missing_unit_or_value' };
};

const styleValidator = (span) => {
  const text = ensureText(span);
  if (!text) return { pass: false, reason: 'empty_text' };

  if (STYLE_ADJ.test(text) && STYLE_NOUN.test(text)) {
    return { pass: true };
  }

  if (hasAdjAndNoun(text)) {
    const adjectives = extractAdjectives(text);
    const hasSpecificAdj = adjectives.some(adj => !GENERIC_ADJECTIVES.has(adj));
    if (hasSpecificAdj) {
      return { pass: true };
    }
  }

  return { pass: false, reason: 'style_missing_adj_noun' };
};

const environmentValidator = (span) => {
  const text = ensureText(span);
  if (!text) return { pass: false, reason: 'empty_text' };
  return ENVIRONMENT_NOUN.test(text)
    ? { pass: true }
    : { pass: false, reason: 'environment_missing_place_noun' };
};

// ============================================================================
// VALIDATOR MAPPING (Using Taxonomy IDs)
// ============================================================================

const validators = {
  // Parent categories
  [TAXONOMY.CAMERA.id]: cameraValidator,
  [TAXONOMY.LIGHTING.id]: lightingValidator,
  [TAXONOMY.TECHNICAL.id]: technicalValidator,
  [TAXONOMY.STYLE.id]: styleValidator,
  [TAXONOMY.ENVIRONMENT.id]: environmentValidator,
  [TAXONOMY.SUBJECT.id]: () => ({ pass: true }),

  // Camera attributes
  [TAXONOMY.CAMERA.attributes.MOVEMENT]: cameraValidator,
  [TAXONOMY.CAMERA.attributes.FRAMING]: cameraValidator,

  // Lighting attributes
  [TAXONOMY.LIGHTING.attributes.TIME]: () => ({ pass: true }),

  // Subject attributes (pass-through)
  [TAXONOMY.SUBJECT.attributes.ACTION]: () => ({ pass: true }),
};

// ============================================================================
// CATEGORY CAPS (Using Taxonomy IDs)
// ============================================================================

export const CATEGORY_CAPS = {
  [TAXONOMY.CAMERA.id]: 2,
  [TAXONOMY.CAMERA.attributes.MOVEMENT]: 2,
  [TAXONOMY.LIGHTING.id]: 2,
  [TAXONOMY.TECHNICAL.id]: 3,
  [TAXONOMY.STYLE.id]: 2,
  [TAXONOMY.STYLE.attributes.AESTHETIC]: 2,
  [TAXONOMY.ENVIRONMENT.id]: 2,
  [TAXONOMY.SUBJECT.id]: 3,
  [TAXONOMY.SUBJECT.attributes.ACTION]: 3,
};

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate a span using the unified taxonomy system
 * Handles both new taxonomy IDs and legacy IDs with mapping
 * 
 * @param {Object} span - Span object with category and text
 * @returns {Object} Validation result with pass/fail, category, and reason
 */
export const validateSpan = (span) => {
  if (!span) return { span, pass: false, reason: 'missing_span' };

  let category = span.category;

  // 1. Handle Legacy Mappings
  if (LEGACY_MAPPINGS[category]) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Validator] Legacy category "${category}" mapped to "${LEGACY_MAPPINGS[category]}"`);
    }
    category = LEGACY_MAPPINGS[category];
  }

  // 2. Strict Taxonomy Check
  if (!VALID_CATEGORIES.has(category)) {
    return { span, pass: false, category, reason: 'invalid_taxonomy_id' };
  }

  // 3. Validator Lookup
  let validator = validators[category];

  // 4. Inheritance Logic for attributes without specific validators
  if (!validator && INHERIT_PARENT_VALIDATION.has(category)) {
    const parent = getParentCategory(category);
    if (parent) {
      validator = validators[parent];
    }
  }

  // 5. Pass-through for non-validated categories (Subject attributes, etc)
  if (!validator) {
    return { span, pass: true, category, reason: 'generic_pass' };
  }

  // 6. Run the validator
  const result = validator(span);
  return {
    span,
    pass: result.pass,
    category,
    reason: result.reason ?? null,
  };
};

