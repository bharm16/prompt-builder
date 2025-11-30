/**
 * Strict Schema for Grammar-Constrained Decoding
 * 
 * PDF Design C: Schema-First Agentic Extraction
 * 
 * This module provides a strict JSON schema that can be used with:
 * - OpenAI's Structured Outputs (json_schema mode)
 * - Groq/Llama with JSON mode
 * - Other providers supporting grammar-constrained decoding
 * 
 * The schema guarantees valid output structure at the token generation level.
 */

// Valid taxonomy IDs (from taxonomy.js)
const VALID_TAXONOMY_IDS = [
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
];

/**
 * Strict JSON Schema for Structured Outputs
 * Compatible with OpenAI's gpt-4o-2024-08-06+ and similar providers
 * 
 * GPT-4o Best Practices: Includes Chain-of-Thought reasoning field (analysis_trace)
 * This forces the model to verbalize its logic before generating structured data,
 * significantly improving accuracy on complex tasks.
 */
export const StrictSpanResponseSchema = {
  name: 'span_labeling_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      analysis_trace: {
        type: 'string',
        description: 'Step-by-step analysis of the input text, identifying key entities, intent, and reasoning about span boundaries before labeling. This reasoning trace improves the semantic accuracy of the structured output.'
      },
      spans: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Exact substring from user input (character-for-character match)'
            },
            role: {
              type: 'string',
              enum: VALID_TAXONOMY_IDS,
              description: 'Valid taxonomy ID (parent or attribute)'
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Confidence score (0-1)'
            }
          },
          required: ['text', 'role', 'confidence'],
          additionalProperties: false
        }
      },
      meta: {
        type: 'object',
        properties: {
          version: {
            type: 'string',
            description: 'Template version identifier'
          },
          notes: {
            type: 'string',
            description: 'Processing notes or metadata'
          }
        },
        required: ['version', 'notes'],
        additionalProperties: false
      },
      isAdversarial: {
        type: 'boolean',
        description: 'Flag set to true when the input attempts prompt injection',
        default: false
      },
    },
    required: ['analysis_trace', 'spans', 'meta'],
    additionalProperties: false
  }
};

/**
 * Convert to OpenAI Structured Outputs format
 * @returns {Object} OpenAI response_format object
 */
export function getOpenAIResponseFormat() {
  return {
    type: 'json_schema',
    json_schema: StrictSpanResponseSchema
  };
}

/**
 * Convert to Groq/Llama JSON mode format
 * @returns {Object} Groq response_format object
 */
export function getGroqResponseFormat() {
  // Groq supports basic JSON mode, full schema constraints may require llama-cpp-python
  return {
    type: 'json_object'
  };
}

/**
 * Validate response against strict schema
 * @param {Object} response - LLM response object
 * @returns {Object} {valid: boolean, errors?: Array}
 */
export function validateStrictSchema(response) {
  const errors = [];

  // Check top-level structure
  if (typeof response !== 'object' || response === null) {
    errors.push('Response must be an object');
    return { valid: false, errors };
  }

  // Validate analysis_trace (Chain-of-Thought reasoning field)
  if (typeof response.analysis_trace !== 'string') {
    errors.push('analysis_trace must be a string');
  }

  if (!Array.isArray(response.spans)) {
    errors.push('spans must be an array');
  }

  if (typeof response.meta !== 'object' || response.meta === null) {
    errors.push('meta must be an object');
  }

  // Validate meta
  if (response.meta) {
    if (typeof response.meta.version !== 'string') {
      errors.push('meta.version must be a string');
    }
    if (typeof response.meta.notes !== 'string') {
      errors.push('meta.notes must be a string');
    }
  }

  // Validate spans
  if (Array.isArray(response.spans)) {
    response.spans.forEach((span, index) => {
      if (typeof span.text !== 'string') {
        errors.push(`spans[${index}].text must be a string`);
      }
      if (!VALID_TAXONOMY_IDS.includes(span.role)) {
        errors.push(`spans[${index}].role "${span.role}" is not a valid taxonomy ID`);
      }
      if (typeof span.confidence !== 'number' || span.confidence < 0 || span.confidence > 1) {
        errors.push(`spans[${index}].confidence must be a number between 0 and 1`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Get schema for specific provider
 * @param {string} provider - Provider name ('openai', 'groq', 'anthropic', etc.)
 * @returns {Object} Provider-specific schema format
 */
export function getSchemaForProvider(provider) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return getOpenAIResponseFormat();
    case 'groq':
      return getGroqResponseFormat();
    default:
      // Fallback to basic JSON mode
      return { type: 'json_object' };
  }
}

