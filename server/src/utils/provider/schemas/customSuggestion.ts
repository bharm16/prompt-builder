import { detectAndGetCapabilities } from '@utils/provider/ProviderDetector';
import { buildCapabilityOptions, type JSONSchema, type SchemaOptions } from './types';

/**
 * Custom Suggestion Schema Factory
 */
export function getCustomSuggestionSchema(options: SchemaOptions = {}): JSONSchema {
  const { capabilities } = detectAndGetCapabilities(
    buildCapabilityOptions(options, 'custom_suggestions')
  );

  if (capabilities.strictJsonSchema) {
    return {
      name: 'custom_suggestions',
      strict: true,
      type: 'object',
      required: ['suggestions'],
      additionalProperties: false,
      properties: {
        suggestions: {
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
          type: 'object',
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
