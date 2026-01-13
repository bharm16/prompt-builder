import { detectAndGetCapabilities } from '@utils/provider/ProviderDetector';
import { buildCapabilityOptions, type JSONSchema, type SchemaOptions } from './types';

/**
 * Shot Interpreter Schema Factory
 */
export function getShotInterpreterSchema(options: SchemaOptions = {}): JSONSchema {
  const { capabilities } = detectAndGetCapabilities(
    buildCapabilityOptions(options, 'optimize_shot_interpreter')
  );

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
