/**
 * Provider-Specific Schema Factory
 * 
 * Creates optimized JSON schemas based on LLM provider capabilities.
 * 
 * OpenAI Optimizations:
 * - strict: true enables grammar-constrained decoding (100% structural compliance)
 * - additionalProperties: false required for strict mode
 * - Rich descriptions guide semantic output during generation
 * 
 * Groq/Llama Optimizations:
 * - Simpler schemas (8B model can't handle complex nested structures well)
 * - Validation-based (not grammar-constrained)
 * - Minimal descriptions to save tokens
 */

import {
  detectAndGetCapabilities,
  type ProviderType,
} from '@utils/provider/ProviderDetector.js';
import {
  OPENAI_SPAN_LABELING_JSON_SCHEMA,
  GROQ_SPAN_LABELING_JSON_SCHEMA,
} from '@llm/span-labeling/schemas/SpanLabelingSchema.js';

export interface JSONSchema {
  type: string;
  name?: string;
  strict?: boolean;
  additionalProperties?: boolean;
  items?: JSONSchema;
  required?: string[];
  properties?: Record<string, JSONSchema>;
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  [key: string]: unknown;
}

export interface SchemaOptions {
  operation?: string;
  model?: string;
  provider?: ProviderType;
  isPlaceholder?: boolean;
}

/**
 * Enhancement Suggestion Schema Factory
 */
export function getEnhancementSchema(options: SchemaOptions = {}): JSONSchema {
  const { provider, capabilities } = detectAndGetCapabilities({
    operation: options.operation || 'enhance_suggestions',
    model: options.model,
    client: options.provider,
  });

  if (capabilities.strictJsonSchema) {
    return getOpenAIEnhancementSchema(options.isPlaceholder ?? false);
  }
  
  return getGroqEnhancementSchema(options.isPlaceholder ?? false);
}

/**
 * OpenAI Enhancement Schema
 * 
 * Features:
 * - strict: true for grammar-constrained decoding
 * - additionalProperties: false required for strict mode
 * - Rich descriptions guide semantic output
 * - Category enum enforces valid taxonomy IDs
 */
function getOpenAIEnhancementSchema(isPlaceholder: boolean): JSONSchema {
  const required = ['text', 'explanation'];
  if (isPlaceholder) {
    required.push('category');
  }

  return {
    name: 'enhancement_suggestions',
    strict: true,
    type: 'array',
    items: {
      type: 'object',
      required,
      additionalProperties: false,
      properties: {
        text: {
          type: 'string',
          description: 'Replacement phrase (2-20 words). Must fit grammatically in surrounding context. No leading/trailing punctuation unless part of the phrase.',
        },
        category: {
          type: 'string',
          description: 'Taxonomy category for the suggestion. Valid values: subject, action, camera, lighting, style, technical, shot, environment, audio, mood.',
          enum: ['subject', 'action', 'camera', 'lighting', 'style', 'technical', 'shot', 'environment', 'audio', 'mood'],
        },
        explanation: {
          type: 'string',
          description: 'Brief explanation of visual effect or why this replacement works (under 15 words).',
        },
        slot: {
          type: 'string',
          description: 'Optional: Specific slot within category (e.g., subject.appearance, camera.movement).',
        },
        visual_focus: {
          type: 'string',
          description: 'Optional: What the camera should focus on with this suggestion.',
        },
      },
    },
  };
}

/**
 * Groq/Llama Enhancement Schema
 * 
 * Features:
 * - Object wrapper for json_object mode compatibility
 *   (Groq's json_object mode requires top-level object, not array)
 * - Simpler structure for 8B model
 * - No strict mode (validation-based)
 * - Minimal descriptions to save tokens
 * - More flexible category (string, not enum)
 */
function getGroqEnhancementSchema(isPlaceholder: boolean): JSONSchema {
  const required = ['text', 'explanation'];
  if (isPlaceholder) {
    required.push('category');
  }

  return {
    type: 'object',
    required: ['suggestions'],
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          required,
          properties: {
            text: { type: 'string' },
            category: { type: 'string' },
            explanation: { type: 'string' },
            slot: { type: 'string' },
            visual_focus: { type: 'string' },
          },
        },
      },
    },
  };
}

/**
 * Custom Suggestion Schema Factory
 */
export function getCustomSuggestionSchema(options: SchemaOptions = {}): JSONSchema {
  const { capabilities } = detectAndGetCapabilities({
    operation: options.operation || 'enhance_suggestions',
    model: options.model,
    client: options.provider,
  });

  if (capabilities.strictJsonSchema) {
    return {
      name: 'custom_suggestions',
      strict: true,
      type: 'array',
      items: {
        type: 'object',
        required: ['text'],
        additionalProperties: false,
        properties: {
          text: {
            type: 'string',
            description: 'Replacement phrase that fulfills the custom request.',
          },
          category: {
            type: 'string',
            description: 'Category of the suggestion.',
          },
          explanation: {
            type: 'string',
            description: 'Why this suggestion fulfills the request.',
          },
        },
      },
    };
  }

  // Groq/Llama - object wrapper for json_object mode
  return {
    type: 'object',
    required: ['suggestions'],
    properties: {
      suggestions: {
        type: 'array',
        items: {
          required: ['text'],
          properties: {
            text: { type: 'string' },
            category: { type: 'string' },
            explanation: { type: 'string' },
          },
        },
      },
    },
  };
}

/**
 * Span Labeling Schema Factory
 */
export function getSpanLabelingSchema(options: SchemaOptions = {}): JSONSchema {
  const { capabilities } = detectAndGetCapabilities({
    operation: options.operation || 'span_labeling',
    model: options.model,
    client: options.provider,
  });

  if (capabilities.strictJsonSchema) {
    return OPENAI_SPAN_LABELING_JSON_SCHEMA;
  }
  
  return GROQ_SPAN_LABELING_JSON_SCHEMA;
}

/**
 * Video Optimization Schema Factory
 */
export function getVideoOptimizationSchema(options: SchemaOptions = {}): JSONSchema {
  const { capabilities } = detectAndGetCapabilities({
    operation: options.operation || 'optimize_standard',
    model: options.model,
    client: options.provider,
  });

  if (capabilities.strictJsonSchema) {
    return getOpenAIVideoOptimizationSchema();
  }
  
  return getGroqVideoOptimizationSchema();
}

/**
 * OpenAI Video Optimization Schema
 * 
 * Strict mode with descriptions that guide output
 */
function getOpenAIVideoOptimizationSchema(): JSONSchema {
  const SHOT_FRAMINGS = [
    'Extreme Close-Up',
    'Close-Up',
    'Medium Close-Up',
    'Medium Shot',
    'Medium Long Shot',
    'Cowboy Shot',
    'Full Shot',
    'Wide Shot',
    'Extreme Wide Shot',
    'Establishing Shot',
    'Master Shot',
    'Two-Shot',
    'Insert Shot',
    'Cutaway',
  ] as const;

  const CAMERA_ANGLES = [
    'Eye-Level Shot',
    'Low-Angle Shot',
    'High-Angle Shot',
    "Bird's-Eye View",
    "Worm's-Eye View",
    'Dutch Angle',
    'POV Shot',
    'Over-the-Shoulder',
  ] as const;

  return {
    name: 'video_prompt_optimization',
    strict: true,
    type: 'object',
    required: [
      '_creative_strategy',
      'shot_framing',
      'camera_angle',
      'camera_move',
      'subject',
      'subject_details',
      'action',
      'setting',
      'time',
      'lighting',
      'style',
      'technical_specs',
    ],
    additionalProperties: false,
    properties: {
      _creative_strategy: {
        type: 'string',
        description: 'Explain WHY you chose this specific Angle, DOF (aperture), and FPS to serve the creative intent.',
      },
      shot_framing: {
        type: 'string',
        description: 'Framing shot type (NOT camera angle). Start the prose with this (e.g., "A Wide Shot...").',
        enum: [...SHOT_FRAMINGS],
      },
      camera_angle: {
        type: 'string',
        description: 'Camera angle/viewpoint (separate from framing). Mention this after framing (e.g., "from a low angle").',
        enum: [...CAMERA_ANGLES],
      },
      camera_move: {
        type: ['string', 'null'],
        description: 'Camera movement (e.g., "handheld tracking", "slow dolly in", "static tripod").',
      },
      subject: {
        type: ['string', 'null'],
        description: 'Main subject if present; otherwise null.',
      },
      subject_details: {
        type: ['array', 'null'],
        description: '2-3 specific, visible subject identifiers for consistency (clothing/breed/color/accessories). Each item must be 1-6 words (short noun phrase), no verbs.',
        minItems: 2,
        maxItems: 3,
        items: { type: 'string' },
      },
      action: {
        type: ['string', 'null'],
        description: 'ONE continuous, physically plausible action as a single present-participle (-ing) verb phrase (4-12 words; no second verb).',
      },
      setting: {
        type: ['string', 'null'],
        description: 'Specific location/environment grounding the action (camera-visible).',
      },
      time: {
        type: ['string', 'null'],
        description: 'Time-of-day or era if relevant (e.g., "golden hour", "midnight").',
      },
      lighting: {
        type: ['string', 'null'],
        description: 'Lighting described with source, direction, quality, and color temperature if possible.',
      },
      style: {
        type: ['string', 'null'],
        description: 'Specific aesthetic reference (film stock/genre/director). Avoid generic "cinematic".',
      },
      technical_specs: {
        type: 'object',
        required: ['lighting', 'camera', 'style', 'aspect_ratio', 'frame_rate', 'duration', 'audio'],
        additionalProperties: false,
        properties: {
          lighting: {
            type: 'string',
            description: 'Precise lighting setup with source, direction, quality, and color temperature.',
          },
          camera: {
            type: 'string',
            description: 'Camera behavior + angle + lens + aperture. Match aperture to shot type: Wide=f/11, Close-up=f/1.8.',
          },
          style: {
            type: 'string',
            description: 'Film stock/genre/medium reference (e.g., "Shot on 35mm, film noir aesthetic").',
          },
          aspect_ratio: {
            type: 'string',
            enum: ['16:9', '9:16', '4:3', '2.35:1', '2.39:1', '1:1'],
          },
          frame_rate: {
            type: 'string',
            description: '24fps for cinematic, 30fps for broadcast, 60fps for action.',
            enum: ['24fps', '30fps', '60fps'],
          },
          duration: {
            type: 'string',
            description: 'Video duration, typically 4-8s.',
          },
          audio: {
            type: 'string',
            description: 'Audio note if relevant.',
          },
        },
      },
      variations: {
        type: 'array',
        description: 'Two variations: one with different angle, one with different lighting.',
        items: {
          type: 'object',
          required: ['label', 'prompt'],
          additionalProperties: false,
          properties: {
            label: { type: 'string' },
            prompt: { type: 'string' },
          },
        },
      },
      shot_plan: {
        type: ['object', 'null'],
        description: 'Original shot plan if provided.',
      },
    },
  };
}

/**
 * Groq/Llama Video Optimization Schema
 * 
 * Simplified structure
 */
function getGroqVideoOptimizationSchema(): JSONSchema {
  return {
    type: 'object',
    required: [
      '_creative_strategy',
      'shot_framing',
      'camera_angle',
      'camera_move',
      'subject',
      'subject_details',
      'action',
      'setting',
      'time',
      'lighting',
      'style',
      'technical_specs',
    ],
    properties: {
      _creative_strategy: { type: 'string' },
      shot_framing: { type: 'string' },
      camera_angle: { type: 'string' },
      camera_move: { type: ['string', 'null'] },
      subject: { type: ['string', 'null'] },
      subject_details: { type: ['array', 'null'], items: { type: 'string' } },
      action: { type: ['string', 'null'] },
      setting: { type: ['string', 'null'] },
      time: { type: ['string', 'null'] },
      lighting: { type: ['string', 'null'] },
      style: { type: ['string', 'null'] },
      technical_specs: {
        type: 'object',
        properties: {
          lighting: { type: 'string' },
          camera: { type: 'string' },
          style: { type: 'string' },
          aspect_ratio: { type: 'string' },
          frame_rate: { type: 'string' },
          duration: { type: 'string' },
          audio: { type: 'string' },
        },
      },
      variations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            prompt: { type: 'string' },
          },
        },
      },
      shot_plan: { type: 'object' },
    },
  };
}

/**
 * Shot Interpreter Schema Factory
 */
export function getShotInterpreterSchema(options: SchemaOptions = {}): JSONSchema {
  const { capabilities } = detectAndGetCapabilities({
    operation: options.operation || 'optimize_shot_interpreter',
    model: options.model,
    client: options.provider,
  });

  const baseSchema: JSONSchema = {
    type: 'object',
    required: ['shot_type', 'core_intent'],
    properties: {
      shot_type: {
        type: 'string',
        enum: ['action_shot', 'motion_only', 'environment_establishing', 'artifact_storyboard', 'abstract_mood'],
      },
      core_intent: { type: 'string' },
      subject: { type: ['string', 'null'] },
      action: { type: ['string', 'null'] },
      visual_focus: { type: ['string', 'null'] },
      setting: { type: ['string', 'null'] },
      time: { type: ['string', 'null'] },
      mood: { type: ['string', 'null'] },
      style: { type: ['string', 'null'] },
      camera_move: { type: ['string', 'null'] },
      camera_angle: { type: ['string', 'null'] },
      lighting: { type: ['string', 'null'] },
      audio: { type: ['string', 'null'] },
      duration_hint: { type: ['string', 'null'] },
      risks: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
  };

  if (capabilities.strictJsonSchema) {
    return {
      name: 'shot_plan',
      strict: true,
      additionalProperties: false,
      ...baseSchema,
    };
  }

  return baseSchema;
}

export default {
  getEnhancementSchema,
  getCustomSuggestionSchema,
  getSpanLabelingSchema,
  getVideoOptimizationSchema,
  getShotInterpreterSchema,
};
