/**
 * Provider-Specific Schema Factory
 *
 * Creates optimized JSON schemas based on LLM provider capabilities.
 */

import { getEnhancementSchema } from './schemas/enhancement';
import { getCustomSuggestionSchema } from './schemas/customSuggestion';
import { getSpanLabelingSchema } from './schemas/spanLabeling';
import { getVideoOptimizationSchema } from './schemas/videoOptimization';
import { getShotInterpreterSchema } from './schemas/shotInterpreter';
import type { JSONSchema, SchemaOptions } from './schemas/types';

export type { JSONSchema, SchemaOptions };

export {
  getEnhancementSchema,
  getCustomSuggestionSchema,
  getSpanLabelingSchema,
  getVideoOptimizationSchema,
  getShotInterpreterSchema,
};

export default {
  getEnhancementSchema,
  getCustomSuggestionSchema,
  getSpanLabelingSchema,
  getVideoOptimizationSchema,
  getShotInterpreterSchema,
};
