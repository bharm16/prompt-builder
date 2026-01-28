import { detectAndGetCapabilities } from '@utils/provider/ProviderDetector';
import {
  OPENAI_SPAN_LABELING_JSON_SCHEMA,
  GROQ_SPAN_LABELING_JSON_SCHEMA,
} from '@llm/span-labeling/schemas/SpanLabelingSchema';
import { GEMINI_JSON_SCHEMA } from '@llm/span-labeling/schemas/GeminiSchema';
import { buildCapabilityOptions, type JSONSchema, type SchemaOptions } from './types';

/**
 * Span Labeling Schema Factory
 */
export function getSpanLabelingSchema(options: SchemaOptions = {}): JSONSchema {
  const { provider, capabilities } = detectAndGetCapabilities(
    buildCapabilityOptions(options, 'span_labeling')
  );

  if (provider === 'gemini') {
    return GEMINI_JSON_SCHEMA as unknown as JSONSchema;
  }

  if (capabilities.strictJsonSchema) {
    return OPENAI_SPAN_LABELING_JSON_SCHEMA;
  }

  return GROQ_SPAN_LABELING_JSON_SCHEMA;
}
