/**
 * Span Labeling Schema - Provider-Optimized
 * 
 * Research-Based Design:
 * - OpenAI: Uses strict json_schema mode (grammar-constrained decoding)
 * - Groq: Uses json_schema mode (validation-based) + TypeScript interface in prompt
 * 
 * Key Insight: When using strict schema mode, we can REMOVE structure definitions
 * from the prompt (~35% token reduction) because the schema enforces them.
 */

import { TAXONOMY } from '#shared/taxonomy.ts';

type TaxonomyValues = typeof TAXONOMY[keyof typeof TAXONOMY];
type ParentCategoryId = TaxonomyValues['id'];
type AttributeId = {
  [K in keyof typeof TAXONOMY]: typeof TAXONOMY[K]['attributes'] extends Record<string, infer V> ? V : never
}[keyof typeof TAXONOMY];

export type TaxonomyId = ParentCategoryId | AttributeId;

const TAXONOMY_CATEGORIES = Object.values(TAXONOMY);

function buildTaxonomyIdList(): TaxonomyId[] {
  const parentIds = TAXONOMY_CATEGORIES.map((category) => category.id);
  const parentOrder = new Map<string, number>(parentIds.map((id, index) => [id, index]));

  const attributeOrder = new Map<string, number>();
  const attributes: AttributeId[] = [];

  for (const category of TAXONOMY_CATEGORIES) {
    if (!category.attributes) continue;
    for (const attributeId of Object.values(category.attributes)) {
      if (attributeOrder.has(attributeId)) continue;
      attributeOrder.set(attributeId, attributes.length);
      attributes.push(attributeId as AttributeId);
    }
  }

  const sortedAttributes = [...attributes].sort((a, b) => {
    const parentA = a.split('.')[0] ?? '';
    const parentB = b.split('.')[0] ?? '';
    const orderA = parentOrder.get(parentA) ?? Number.MAX_SAFE_INTEGER;
    const orderB = parentOrder.get(parentB) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (attributeOrder.get(a) ?? 0) - (attributeOrder.get(b) ?? 0);
  });

  return [...parentIds, ...sortedAttributes];
}

// Valid taxonomy IDs - derived from shared/taxonomy.ts
export const VALID_TAXONOMY_IDS = buildTaxonomyIdList();

/**
 * TypeScript Interface Definition (for prompts that don't use strict schema)
 * 
 * Used when:
 * - Provider doesn't support json_schema mode
 * - Fallback for validation errors
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
 * JSON Schema for Structured Outputs
 * 
 * OpenAI: Uses strict mode (grammar-constrained decoding, 100% compliance)
 * Groq: Uses validation mode (errors if model output doesn't match)
 * 
 * The enum constraint on 'role' is CRITICAL - it guarantees valid taxonomy IDs
 * without needing to list them in the prompt text.
 */
export const JSON_SCHEMA_DEFINITION = {
  name: 'span_labeling_response',
  strict: true, // OpenAI: enables grammar-constrained decoding
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
              // CRITICAL: This enum constraint eliminates the need to list
              // valid taxonomy IDs in the prompt (~100 token savings)
              enum: [...VALID_TAXONOMY_IDS],
              description: 'Valid taxonomy ID'
            },
            confidence: {
              type: 'number',
              // CRITICAL: These constraints eliminate the need to describe
              // the valid range in the prompt (~20 token savings)
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
 * Groq-specific schema (without strict mode, Groq ignores it)
 */
export const JSON_SCHEMA_GROQ = {
  name: 'span_labeling_response',
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
              description: 'Confidence score (0-1)'
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
        type: 'boolean'
      }
    }
  }
};

// Flattened JSON Schema definitions for provider-agnostic usage (SchemaFactory, tests, etc.)
export const OPENAI_SPAN_LABELING_JSON_SCHEMA = {
  name: JSON_SCHEMA_DEFINITION.name,
  strict: JSON_SCHEMA_DEFINITION.strict,
  ...JSON_SCHEMA_DEFINITION.schema
};

export const GROQ_SPAN_LABELING_JSON_SCHEMA = {
  name: JSON_SCHEMA_GROQ.name,
  ...JSON_SCHEMA_GROQ.schema
};

/**
 * Quick Reference Table for Category Mappings
 * This MUST stay in prompt (semantic guidance, not structural)
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
 * Disambiguation Rules - MUST stay in prompt (reasoning logic, not structural)
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
 * Provider capabilities for structured outputs
 */
export const PROVIDER_SCHEMA_SUPPORT = {
  openai: {
    mode: 'json_schema',
    strict: true,
    constrainedDecoding: true, // Grammar-level enforcement
    enumSupport: true,
    // Can remove TypeScript interface from prompt (schema enforces structure)
    promptOptimization: 'schema-only'
  },
  groq: {
    mode: 'json_schema',
    strict: false, // Groq ignores strict flag for most models
    constrainedDecoding: false, // Validation-based, not grammar-constrained
    enumSupport: true,
    // Should keep TypeScript interface in prompt (validation only, not enforced)
    promptOptimization: 'schema-plus-interface'
  },
  gemini: {
    mode: 'json_object',
    strict: false,
    constrainedDecoding: false,
    enumSupport: false,
    promptOptimization: 'interface-only'
  }
} as const;

export type ProviderName = keyof typeof PROVIDER_SCHEMA_SUPPORT;

/**
 * Get optimized configuration for a specific provider
 * 
 * @param provider - 'openai', 'groq', 'gemini'
 * @returns Configuration object with schema and prompt settings
 */
export function getProviderConfig(provider: string): {
  responseFormat: { type: string; json_schema?: object };
  includeInterfaceInPrompt: boolean;
  includeTaxonomyIdsInPrompt: boolean;
  templateFile: string;
} {
  const normalizedProvider = provider.toLowerCase() as ProviderName;
  const support = PROVIDER_SCHEMA_SUPPORT[normalizedProvider] || PROVIDER_SCHEMA_SUPPORT.gemini;

  switch (support.promptOptimization) {
    case 'schema-only':
      // OpenAI: Schema enforces structure, minimal prompt
      return {
        responseFormat: {
          type: 'json_schema',
          json_schema: JSON_SCHEMA_DEFINITION
        },
        includeInterfaceInPrompt: false, // Schema enforces structure
        includeTaxonomyIdsInPrompt: false, // Enum enforces valid IDs
        templateFile: 'span-labeling-prompt-schema-optimized.md'
      };

    case 'schema-plus-interface':
      // Groq: Schema validates but doesn't constrain, include interface
      return {
        responseFormat: {
          type: 'json_schema',
          json_schema: JSON_SCHEMA_GROQ
        },
        includeInterfaceInPrompt: true, // Helps model understand structure
        includeTaxonomyIdsInPrompt: false, // Schema validates IDs
        templateFile: 'span-labeling-prompt-condensed.md'
      };

    case 'interface-only':
    default:
      // Fallback: No schema support, full interface in prompt
      return {
        responseFormat: { type: 'json_object' },
        includeInterfaceInPrompt: true,
        includeTaxonomyIdsInPrompt: true,
        templateFile: 'span-labeling-prompt-condensed.md'
      };
  }
}

/**
 * Get schema format for specific provider (legacy API, use getProviderConfig instead)
 */
export function getSchemaForProvider(provider: string): {
  format: 'typescript' | 'json_schema' | 'json_object';
  content: string | object;
} {
  switch (provider.toLowerCase()) {
    case 'groq':
      return {
        format: 'json_schema',
        content: JSON_SCHEMA_GROQ
      };
    
    case 'openai':
      return {
        format: 'json_schema',
        content: JSON_SCHEMA_DEFINITION
      };
    
    default:
      return {
        format: 'json_object',
        content: TYPESCRIPT_INTERFACE_DEFINITION
      };
  }
}

/**
 * Validate response against schema
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

/**
 * Calculate token savings from schema optimization
 */
export function estimateTokenSavings(provider: string): {
  withSchema: number;
  withoutSchema: number;
  savings: number;
  savingsPercent: number;
} {
  // Approximate token counts based on template analysis
  const fullPromptTokens = 1200; // With interface + taxonomy IDs
  const schemaOnlyTokens = 780; // Without interface + taxonomy IDs
  const schemaWithInterfaceTokens = 950; // With interface, without taxonomy IDs

  const config = getProviderConfig(provider);
  
  let optimizedTokens: number;
  if (!config.includeInterfaceInPrompt && !config.includeTaxonomyIdsInPrompt) {
    optimizedTokens = schemaOnlyTokens;
  } else if (!config.includeTaxonomyIdsInPrompt) {
    optimizedTokens = schemaWithInterfaceTokens;
  } else {
    optimizedTokens = fullPromptTokens;
  }

  return {
    withSchema: optimizedTokens,
    withoutSchema: fullPromptTokens,
    savings: fullPromptTokens - optimizedTokens,
    savingsPercent: Math.round((1 - optimizedTokens / fullPromptTokens) * 100)
  };
}
