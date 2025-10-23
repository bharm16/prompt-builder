import nlp from 'compromise';

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

const ensureText = (span) => (span?.text || span?.quote || '').trim();

const testNLPPattern = (span, pattern) => {
  const doc = nlp(span.text || span.quote || '');
  return doc.has(pattern);
};

const cameraValidator = (span) => {
  const text = ensureText(span);
  if (!text) return { pass: false, reason: 'empty_text' };

  if (CAMERA_MOTION_TERMS.test(text)) {
    return { pass: true };
  }

  if (LENS_SPEC.test(text) && CAMERA_DEVICE_TERMS.test(text)) {
    return { pass: true };
  }

  if (testNLPPattern(span, '#Verb #Noun')) {
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
    if (testNLPPattern(span, '#Adj #Noun') || testNLPPattern(span, '#Verb #Noun')) {
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

  if (testNLPPattern(span, '#Adj #Noun')) {
    const doc = nlp(text);
    const adjectives = doc.match('#Adjective').out('array').map(word => word.toLowerCase());
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

const validators = {
  camera: cameraValidator,
  cameramove: cameraValidator,
  lighting: lightingValidator,
  technical: technicalValidator,
  style: styleValidator,
  aesthetic: styleValidator,
  environment: environmentValidator,
  location: environmentValidator,
  subject: () => ({ pass: true }),
  action: () => ({ pass: true }),
  timeOfDay: () => ({ pass: true }),
  time: () => ({ pass: true }),
  mood: () => ({ pass: true }),
};

export const CATEGORY_CAPS = {
  camera: 2,
  cameramove: 2,
  lighting: 2,
  technical: 3,
  style: 2,
  aesthetic: 2,
  environment: 2,
  subject: 3,
  action: 3,
};

export const validateSpan = (span) => {
  if (!span) return { span, pass: false, reason: 'missing_span' };

  const category = span.category;
  const validator = validators[category];
  if (validator) {
    const result = validator(span);
    return {
      span,
      pass: result.pass,
      category,
      reason: result.reason ?? null,
    };
  }

  // Attempt re-typing
  for (const [candidateCategory, candidateValidator] of Object.entries(validators)) {
    if (candidateCategory === category) continue;
    const result = candidateValidator(span);
    if (result.pass) {
      return {
        span,
        pass: true,
        category: candidateCategory,
        reason: 'retyped_category',
      };
    }
  }

  return {
    span,
    pass: false,
    category,
    reason: 'no_matching_validator',
  };
};

