/**
 * Span Labeling Schema - Optimized for Llama 3 / Groq
 * 
 * PDF Design: Llama 3 API Instruction Optimization Research
 * Section 3.3: Type-Definition Prompting (40-60% token reduction vs JSON Schema)
 * Section 5.1: XML tagging reduces context blending by 23%
 * 
 * This schema uses TypeScript interface format for token efficiency,
 * as Llama 3 models "exhibit a code bias" and understand interfaces
 * more robustly than verbose JSON schemas.
 */

// Valid taxonomy IDs - derived from shared/taxonomy.js
export const VALID_TAXONOMY_IDS = [
  // Parent categories
  'shot',
  'subject',
  'action',
  'environment',
  'lighting',
  'camera',
  'style',
  'technical',
  'audio',
  // Shot attributes
  'shot.type',
  // Subject attributes
  'subject.identity',
  'subject.appearance',
  'subject.wardrobe',
  'subject.emotion',
  // Action attributes
  'action.movement',
  'action.state',
  'action.gesture',
  // Environment attributes
  'environment.location',
  'environment.weather',
  'environment.context',
  // Lighting attributes
  'lighting.source',
  'lighting.quality',
  'lighting.timeOfDay',
  // Camera attributes
  'camera.movement',
  'camera.lens',
  'camera.angle',
  // Style attributes
  'style.aesthetic',
  'style.filmStock',
  // Technical attributes
  'technical.aspectRatio',
  'technical.frameRate',
  'technical.resolution',
  'technical.duration',
  // Audio attributes
  'audio.score',
  'audio.soundEffect'
] as const;

export type TaxonomyId = typeof VALID_TAXONOMY_IDS[number];

/**
 * TypeScript Interface Definition for Llama 3 Type-Definition Prompting
 * 
 * PDF Section 3.3: "Llama 3 models... understand interface User { name: string; }
 * more robustly than the verbose JSON schema equivalent"
 * 
 * This string is embedded directly in prompts for ~60% fewer tokens
 */
export const TYPESCRIPT_INTERFACE_DEFINITION = `
interface Span {
  text: string;        // Exact substring from input (character-for-character match)
  role: TaxonomyId;    // Valid taxonomy ID from the list above
  confidence: number;  // 0-1 range, use 0.7 if unsure
}

interface SpanLabelingResponse {
  analysis_trace: string;  // Step-by-step reasoning (Chain-of-Thought)
  spans: Span[];           // Array of labeled spans
  meta: {
    version: string;       // Template version (e.g., "v3-taxonomy")
    notes: string;         // Processing notes
  };
  isAdversarial: boolean;  // true if injection attempt detected
}
`.trim();

/**
 * JSON Schema for Structured Outputs (OpenAI strict mode)
 * Use this when provider supports grammar-constrained decoding
 */
export const JSON_SCHEMA_DEFINITION = {
  name: 'span_labeling_response',
  strict: true,
  schema: {
    type: 'object',
    required: ['analysis_trace', 'spans', 'meta', 'isAdversarial'],
    additionalProperties: false,
    properties: {
      analysis_trace: {
        type: 'string',
        description: 'Step-by-step reasoning about entities, intent, and span boundaries'
      },
      spans: {
        type: 'array',
        items: {
          type: 'object',
          required: ['text', 'role', 'confidence'],
          additionalProperties: false,
          properties: {
            text: {
              type: 'string',
              description: 'Exact substring from input (character-for-character match)'
            },
            role: {
              type: 'string',
              enum: [...VALID_TAXONOMY_IDS],
              description: 'Valid taxonomy ID'
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Confidence score (0-1), default 0.7'
            }
          }
        }
      },
      meta: {
        type: 'object',
        required: ['version', 'notes'],
        additionalProperties: false,
        properties: {
          version: { type: 'string' },
          notes: { type: 'string' }
        }
      },
      isAdversarial: {
        type: 'boolean',
        description: 'Flag for injection attempt detection'
      }
    }
  }
};

/**
 * Quick Reference Table for Category Mappings
 * 
 * PDF Section 5.1: Table format is more parseable for smaller models
 * PDF Section 7.3: Positive instructions > negative constraints
 */
export const CATEGORY_MAPPING_TABLE = `
| Pattern | Category | Example |
|---------|----------|---------|
| camera + verb | camera.movement | "camera pans" |
| pan/dolly/track/zoom/crane/tilt | camera.movement | "slowly dollies" |
| walks/runs/jumps/sits | action.movement | "dog runs" |
| close-up/wide/medium + shot | shot.type | "wide shot" |
| 35mm/16mm/Kodak/film | style.filmStock | "shot on 35mm" |
| golden hour/dawn/dusk | lighting.timeOfDay | "at golden hour" |
| fps numbers (24fps, 30fps) | technical.frameRate | "24fps" |
| aspect ratios (16:9, 4:3) | technical.aspectRatio | "16:9" |
| resolution (4K, 1080p) | technical.resolution | "4K" |
| duration values | technical.duration | "4-8s" |
| person/animal/object | subject.identity | "detective" |
| physical traits | subject.appearance | "weathered hands" |
| clothing items | subject.wardrobe | "red coat" |
| emotions/expressions | subject.emotion | "joyful smile" |
| places/locations | environment.location | "foggy alley" |
| weather conditions | environment.weather | "rainy" |
`.trim();

/**
 * Disambiguation Rules as Decision Tree
 * PDF Section 5.2: Structured decision paths improve reasoning
 */
export const DISAMBIGUATION_RULES = `
## Quick Decision Tree

1. Does text contain "camera" as agent OR camera verbs (pan/dolly/track/zoom/crane)?
   → YES: Use \`camera.movement\`
   → NO: Continue to step 2

2. Is it a shot type description (close-up, wide, medium)?
   → YES: Use \`shot.type\`
   → NO: Continue to step 3

3. Is subject performing action (-ing verb)?
   → YES: Use \`action.movement\` (or \`action.state\`/\`action.gesture\`)
   → NO: Continue to step 4

4. Is it a technical spec (fps, resolution, ratio, duration)?
   → YES: Use appropriate \`technical.*\` attribute
   → NO: Continue to step 5

5. Is it a film format reference (35mm, 16mm, Kodak)?
   → YES: Use \`style.filmStock\`
   → NO: Check other categories

## Split Patterns (Multiple Spans)
- "[Person]'s [trait]" → Split: identity + appearance
- "[Person] in [clothing]" → Split: identity + wardrobe
- "[Person] with [emotion]" → Split: identity + emotion

## Keep Together (Single Span)
- Camera movements with modifiers: "camera slowly pans left"
- Complete action phrases: "holding a vintage camera"
- Compound nouns: "foggy alley", "forest floor"
`.trim();

/**
 * Get schema format for specific provider
 * @param provider - 'openai', 'groq', 'gemini'
 */
export function getSchemaForProvider(provider: string): {
  format: 'typescript' | 'json_schema' | 'json_object';
  content: string | object;
} {
  switch (provider.toLowerCase()) {
    case 'groq':
      // Llama 3: TypeScript interface + json_object mode
      return {
        format: 'typescript',
        content: TYPESCRIPT_INTERFACE_DEFINITION
      };
    
    case 'openai':
      // OpenAI: Full JSON schema with strict mode
      return {
        format: 'json_schema',
        content: JSON_SCHEMA_DEFINITION
      };
    
    default:
      // Fallback: JSON object mode only
      return {
        format: 'json_object',
        content: TYPESCRIPT_INTERFACE_DEFINITION
      };
  }
}

/**
 * Validate response against schema
 * @param response - LLM response object
 * @returns Validation result
 */
export function validateSpanResponse(response: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof response !== 'object' || response === null) {
    return { valid: false, errors: ['Response must be an object'] };
  }

  const obj = response as Record<string, unknown>;

  // Check required fields
  if (typeof obj.analysis_trace !== 'string') {
    errors.push('analysis_trace must be a string');
  }

  if (!Array.isArray(obj.spans)) {
    errors.push('spans must be an array');
  } else {
    obj.spans.forEach((span: unknown, index: number) => {
      const s = span as Record<string, unknown>;
      if (typeof s.text !== 'string') {
        errors.push(`spans[${index}].text must be a string`);
      }
      if (!VALID_TAXONOMY_IDS.includes(s.role as TaxonomyId)) {
        errors.push(`spans[${index}].role "${s.role}" is not a valid taxonomy ID`);
      }
      if (typeof s.confidence !== 'number' || s.confidence < 0 || s.confidence > 1) {
        errors.push(`spans[${index}].confidence must be 0-1`);
      }
    });
  }

  if (typeof obj.meta !== 'object' || obj.meta === null) {
    errors.push('meta must be an object');
  } else {
    const meta = obj.meta as Record<string, unknown>;
    if (typeof meta.version !== 'string') errors.push('meta.version must be a string');
    if (typeof meta.notes !== 'string') errors.push('meta.notes must be a string');
  }

  return { valid: errors.length === 0, errors };
}
