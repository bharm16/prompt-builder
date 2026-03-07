import { TAXONOMY, isAttribute } from '#shared/taxonomy.js';

interface CategoryConstraint {
  pattern?: RegExp;
  instruction?: string;
  forbidden?: string;
}

interface TechnicalSubcategory extends CategoryConstraint {
  pattern: RegExp;
  instruction: string;
  forbidden: string;
}

interface CategoryConstraintsConfig {
  [key: string]: CategoryConstraint | {
    [subcategory: string]: TechnicalSubcategory;
  };
}

/**
 * Category Constraints Configuration
 *
 * Provides validation rules and AI prompt instructions
 * for video enhancement category constraints.
 *
 * SCOPE: Enhancement service category validation
 * USED BY:
 *   - PromptBuilderService (AI prompt constraints)
 *   - SuggestionValidationService (pattern validation)
 *
 * STRUCTURE:
 *   - CATEGORY_CONSTRAINTS: Configuration with patterns, instructions
 *   - validateAgainstVideoTemplate(): Validates suggestion patterns using taxonomy IDs
 *
 * Uses TAXONOMY constants as single source of truth
 * Aligned with VideoPromptTemplates.js requirements
 */

export const CATEGORY_CONSTRAINTS: CategoryConstraintsConfig = {
  // ============================================================================
  // TECHNICAL SPECS
  // ============================================================================

  [TAXONOMY.TECHNICAL.id]: {
    frameRate: {
      pattern: /\d+fps|frames per second/i,
      instruction: "Generate ONLY frame rate values following video template: 24fps (Filmic) or 30fps (Standard Video) are primary. Can include 60fps, 120fps for special effects.",
      forbidden: "Do NOT suggest audio, lighting, colors, or any non-framerate options",
    },
    aspectRatio: {
      pattern: /\d+:\d+|aspect ratio/i,
      instruction: "Generate ONLY aspect ratios from video template: 16:9 (Landscape), 9:16 (Vertical), 2.39:1 (Cinematic)",
      forbidden: "Do NOT suggest frame rates, audio, or non-ratio options",
    },
    filmFormat: {
      pattern: /\d+mm|film|digital/i,
      instruction: "Generate film formats using cinematic language: 35mm film, 16mm, 70mm, digital cinema",
      forbidden: "Do NOT suggest non-format specifications",
    }
  },

  // ============================================================================
  // CAMERA ATTRIBUTES
  // ============================================================================

  [TAXONOMY.CAMERA.attributes?.FRAMING || '']: {
    pattern: /shot|close-up|wide|medium|angle/i,
    instruction: "Generate shot types: wide shot, medium shot, close-up, extreme close-up using professional language",
  },

  [TAXONOMY.CAMERA.attributes?.MOVEMENT || '']: {
    pattern: /dolly|track|pan|tilt|crane|zoom|static/i,
    instruction: "Generate camera movements: static, slow dolly, handheld tracking, crane, pan using professional terms",
  },

  // ============================================================================
  // LIGHTING
  // ============================================================================

  [TAXONOMY.LIGHTING.id]: {
    pattern: /light|shadow|illuminat|glow|bright|dark/i,
    instruction: "Generate lighting with source, direction, quality: 'soft window light from the left creating shadows'",
  },

  // ============================================================================
  // STYLE & AESTHETIC
  // ============================================================================

  [TAXONOMY.STYLE.id]: {
    pattern: /style|aesthetic|period|genre/i,
    instruction: "Generate style/genre alternatives, avoid generic 'cinematic'",
    forbidden: "Do NOT suggest lighting or technical specs",
  },

  // ============================================================================
  // SUBJECT ATTRIBUTES
  // ============================================================================

  [TAXONOMY.SUBJECT.attributes?.WARDROBE || '']: {
    pattern: /wearing|dressed|outfit|clothing|costume|attire|garment/i,
    instruction: "Generate wardrobe details: material, era, condition, fit. Example: 'wearing weathered leather jacket with brass buttons'",
    forbidden: "Do NOT suggest actions, emotions, or physical traits",
  },

  [TAXONOMY.SUBJECT.attributes?.ACTION || '']: {
    pattern: /standing|sitting|leaning|walking|running|gesture|pose/i,
    instruction: "Generate subject actions or poses: what they're doing with their body. Example: 'leaning against weathered brick wall'",
    forbidden: "Do NOT suggest props or emotional states",
  },

  [TAXONOMY.SUBJECT.attributes?.APPEARANCE || '']: {
    pattern: /face|body|build|hair|eyes|skin|features|appearance/i,
    instruction: "Generate physical appearance details: facial features, body type, distinctive marks. Example: 'with weathered hands and sun-worn face'",
    forbidden: "Do NOT suggest clothing or emotional states",
  }
};

interface Suggestion {
  text: string;
  [key: string]: unknown;
}

const CAMERA_ANGLE_PATTERN =
  /\b(eye[-\s]?level|low[-\s]?angle|high[-\s]?angle|overhead|bird'?s[-\s]?eye|worm'?s[-\s]?eye|dutch tilt|profile|point[-\s]?of[-\s]?view|pov)\b/i;
const CAMERA_MOVEMENT_PATTERN =
  /\b(dolly|track(ing)?|pan|tilt|crane|zoom|handheld|static|push[-\s]?in|pull[-\s]?out|arc)\b/i;
const CAMERA_FOCUS_PATTERN =
  /\b(focus|depth of field|dof|bokeh|defocus|blur|shallow|rack focus|selective focus)\b/i;
const CAMERA_LENS_PATTERN =
  /\b(\d+mm|lens|prime|telephoto|wide[-\s]?angle|anamorphic|macro|aperture|f\/\d(?:\.\d+)?|iris)\b/i;
const SHOT_PATTERN =
  /\b(shot|close[-\s]?up|medium shot|wide shot|extreme close[-\s]?up|over[-\s]?the[-\s]?shoulder|high[-\s]?angle|low[-\s]?angle|bird'?s[-\s]?eye|worm'?s[-\s]?eye|dutch tilt)\b/i;
const LIGHTING_QUALITY_PATTERN =
  /\b(light|lighting|shadow|glow|lumin(?:ous|ance)|radian(?:t|ce)|illuminat|warmth|brightness|dim(?:ness)?|diffus(?:e|ed|ion)|ambient|backlit|rim[-\s]?lit|high[-\s]?key|low[-\s]?key|sunlit|moonlit)\b/i;
const LIGHTING_TIME_PATTERN =
  /\b(dawn|sunrise|morning|midday|noon|afternoon|golden hour|sunset|dusk|twilight|blue hour|night|moonlit|daylight|daytime|evening)\b/i;
const EXTERNAL_LOCATION_PATTERN =
  /\b(park|street|forest|beach|shoreline|lake|meadow|city|cityscape|alley|playground|vineyard|field|trail|road|suburban|mountain|desert|plaza|garden|shore|coast|cliff|waterfront|courtyard|market)\b/i;
const ENVIRONMENT_CONTEXT_PATTERN =
  /\b(window|windshield|glass|dashboard|cabin|cockpit|seat|upholstery|interior|rearview|mirror|condensation|reflection|dust|raindrops|fogged|haze|air|smoke|shadow|sunbeam|glare|trim|console)\b/i;
const STYLE_PATTERN =
  /\b(style|aesthetic|look|tone|palette|grade|grading|grain|noir|retro|vintage|kodachrome|8mm|16mm|35mm|cinematic|painterly|watercolor|impressionist|sepia|chiaroscuro|hyperreal|surreal|cyberpunk|cartoon|animation|pastel|monochrome|technicolor|dream(?:like)?|nostalg(?:ia|ic)|realism)\b/i;
const STYLE_FILM_PATTERN =
  /\b(film|stock|super 8|8mm|16mm|35mm|kodak|fuji|agfa|ilford|tri-x|portra|ektachrome|velvia|digital)\b/i;
const ACTION_PATTERN = /\b\w+(ing|s)\b/i;

function normalizeCategory(category: string): string {
  return category.toLowerCase().replace(/[_-]/g, '');
}

/**
 * Validate suggestion against video template requirements.
 * Uses the full taxonomy ID from span labeling as the single source of truth
 * for categorization — no regex re-detection of the highlighted text.
 */
export function validateAgainstVideoTemplate(
  suggestion: Suggestion,
  category: string
): boolean {
  const normalizedCategory = normalizeCategory(category);
  if (category === TAXONOMY.TECHNICAL.attributes.FPS) {
    return /\d+fps|frame rate/i.test(suggestion.text);
  }
  if (category === TAXONOMY.TECHNICAL.attributes.ASPECT_RATIO) {
    return /\d+:\d+|aspect ratio/i.test(suggestion.text);
  }
  if (normalizedCategory === 'camera.angle') {
    return CAMERA_ANGLE_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'camera.movement') {
    return CAMERA_MOVEMENT_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'camera.focus') {
    return CAMERA_FOCUS_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'camera.lens') {
    return CAMERA_LENS_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'shot.type' || normalizedCategory === 'shot.framing') {
    return SHOT_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'lighting.quality') {
    return LIGHTING_QUALITY_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'lighting.timeofday') {
    return LIGHTING_TIME_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'environment.location') {
    return EXTERNAL_LOCATION_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'environment.context') {
    return ENVIRONMENT_CONTEXT_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'style.aesthetic') {
    return STYLE_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory === 'style.filmstock') {
    return STYLE_FILM_PATTERN.test(suggestion.text);
  }
  if (normalizedCategory.startsWith('action.')) {
    return ACTION_PATTERN.test(suggestion.text);
  }
  return true;
}
