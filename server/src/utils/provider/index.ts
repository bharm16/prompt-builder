/**
 * Provider utilities for LLM-specific optimizations
 */
export {
  detectProvider,
  getProviderCapabilities,
  detectAndGetCapabilities,
  shouldUseStrictSchema,
  shouldUseDeveloperMessage,
  type ProviderType,
  type ProviderCapabilities,
} from './ProviderDetector';

export {
  getEnhancementSchema,
  getCustomSuggestionSchema,
  getSpanLabelingSchema,
  getVideoOptimizationSchema,
  getShotInterpreterSchema,
  type JSONSchema,
  type SchemaOptions,
} from './SchemaFactory';

export {
  buildProviderOptimizedPrompt,
  getSecurityPrefix,
  getFormatInstruction,
  wrapUserData,
  type PromptBuildContext,
  type BuiltPrompt,
} from './PromptBuilder';
