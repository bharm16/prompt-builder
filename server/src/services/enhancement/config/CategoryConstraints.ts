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

/**
 * Validate suggestion against video template requirements.
 * Uses the full taxonomy ID from span labeling as the single source of truth
 * for categorization — no regex re-detection of the highlighted text.
 */
export function validateAgainstVideoTemplate(
  suggestion: Suggestion,
  category: string
): boolean {
  if (category === TAXONOMY.TECHNICAL.attributes.FPS) {
    return /\d+fps|frame rate/i.test(suggestion.text);
  }
  if (category === TAXONOMY.TECHNICAL.attributes.ASPECT_RATIO) {
    return /\d+:\d+|aspect ratio/i.test(suggestion.text);
  }
  return true;
}
