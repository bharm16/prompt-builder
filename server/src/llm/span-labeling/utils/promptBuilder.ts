/**
 * Span Labeling Prompt Builder
 * 
 * Provider-Specific Implementations:
 * 
 * OpenAI/GPT-4o:
 * - Grammar-constrained decoding (strict: true)
 * - Schema descriptions ARE processed during generation
 * - Minimal prompt + rich schema descriptions
 * - ~400 tokens prompt + ~600 tokens schema
 * 
 * Groq/Llama 3:
 * - Validation-only schema (not grammar-constrained)
 * - Llama 3 does NOT process descriptions during generation
 * - Full rules in system prompt (GAtt attention mechanism)
 * - Schema for enum/type validation only
 * - ~1000 tokens prompt + ~200 tokens schema
 * - NEW: Stop sequences and min_p for better structured output
 * - NEW: Conditional format instructions when json_schema mode active
 *   Pass useJsonSchema=true to save ~50-100 tokens per request
 */

import { IMMUTABLE_SOVEREIGN_PREAMBLE } from '@utils/SecurityPrompts';
import { logger } from '@infrastructure/Logger';

// OpenAI-specific imports
import {
  OPENAI_ENRICHED_SCHEMA,
  OPENAI_MINIMAL_PROMPT,
  OPENAI_FEW_SHOT_EXAMPLES,
  VALID_TAXONOMY_IDS
} from '../schemas/OpenAISchema.js';

// Groq/Llama 3-specific imports
import {
  GROQ_VALIDATION_SCHEMA,
  GROQ_FULL_SYSTEM_PROMPT,
  GROQ_FEW_SHOT_EXAMPLES,
  GROQ_SANDWICH_REMINDER,
  getGroqSystemPrompt,
  getGroqSandwichReminder
} from '../schemas/GroqSchema.js';

/**
 * Provider type
 */
export type Provider = 'openai' | 'groq' | 'gemini';

/**
 * Build system prompt optimized for specific provider
 * 
 * @param text - Input text (currently unused but kept for API compatibility)
 * @param useRouter - Whether to use router (currently unused)
 * @param provider - LLM provider ('openai' or 'groq')
 * @param useJsonSchema - Whether json_schema response format is active (Groq optimization)
 */
export function buildSystemPrompt(
  text: string = '',
  useRouter: boolean = false,
  provider: string = 'groq',
  useJsonSchema: boolean = false
): string {
  const normalizedProvider = provider.toLowerCase();
  
  let basePrompt: string;
  
  if (normalizedProvider === 'openai') {
    // OpenAI: Minimal prompt, rules in schema descriptions
    basePrompt = OPENAI_MINIMAL_PROMPT;
    logger.debug('Using OpenAI minimal prompt (rules in schema descriptions)');
  } else {
    // Groq/Llama 3: Full prompt, rules in system message
    // When json_schema is active, remove redundant format instructions
    basePrompt = getGroqSystemPrompt(useJsonSchema);
    logger.debug('Using Groq prompt', { 
      useJsonSchema, 
      optimized: useJsonSchema ? 'format-instructions-removed' : 'full-prompt'
    });
  }
  
  // Add security preamble
  return `${IMMUTABLE_SOVEREIGN_PREAMBLE}\n\n${basePrompt}`.trim();
}

/**
 * Get schema for specific provider
 */
export function getSchema(provider: string): object {
  const normalizedProvider = provider.toLowerCase();
  
  if (normalizedProvider === 'openai') {
    // OpenAI: Rich descriptions, strict mode
    return OPENAI_ENRICHED_SCHEMA;
  }
  
  // Groq: Basic validation schema
  return GROQ_VALIDATION_SCHEMA;
}

/**
 * Get response format for API call
 */
export function getResponseFormat(provider: string): { 
  type: string; 
  json_schema?: object 
} {
  const schema = getSchema(provider);
  
  return {
    type: 'json_schema',
    json_schema: schema
  };
}

/**
 * Get few-shot examples for provider
 */
export function getFewShotExamples(provider: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  const normalizedProvider = provider.toLowerCase();
  
  if (normalizedProvider === 'openai') {
    // OpenAI: Fewer examples needed (rules in schema)
    return OPENAI_FEW_SHOT_EXAMPLES;
  }
  
  // Groq: More examples needed
  return GROQ_FEW_SHOT_EXAMPLES;
}

/**
 * Build complete message array for span labeling
 * 
 * @param text - Input text to label
 * @param includeFewShot - Whether to include few-shot examples
 * @param provider - LLM provider ('openai' or 'groq')
 * @param useJsonSchema - Whether json_schema response format is active (Groq optimization)
 */
export function buildSpanLabelingMessages(
  text: string,
  includeFewShot: boolean = true,
  provider: string = 'groq',
  useJsonSchema: boolean = false
): Array<{ role: string; content: string }> {
  const normalizedProvider = provider.toLowerCase();
  const messages: Array<{ role: string; content: string }> = [];
  
  // 1. System prompt (provider-specific)
  messages.push({
    role: 'system',
    content: buildSystemPrompt(text, false, provider, useJsonSchema)
  });
  
  // 2. Few-shot examples
  if (includeFewShot) {
    const examples = getFewShotExamples(provider);
    messages.push(...examples);
  }
  
  // 3. User input wrapped in XML tags
  messages.push({
    role: 'user',
    content: `<user_input>
${text}
</user_input>

Process the text above and return the span labels as JSON.`
  });
  
  // 4. Sandwich reminder (Groq/Llama 3 only - Section 3.2)
  // When json_schema is active, use minimal reminder since format is validated server-side
  if (normalizedProvider === 'groq') {
    const sandwichReminder = getGroqSandwichReminder(useJsonSchema);
    messages.push({
      role: 'user',
      content: sandwichReminder
    });
  }
  
  return messages;
}

/**
 * Get provider-specific configuration summary
 */
export function getProviderConfig(provider: string): {
  provider: string;
  strategy: string;
  promptTokens: number;
  schemaTokens: number;
  totalTokens: number;
  features: string[];
} {
  const normalizedProvider = provider.toLowerCase();
  
  if (normalizedProvider === 'openai') {
    return {
      provider: 'openai',
      strategy: 'description-enriched',
      promptTokens: 400,
      schemaTokens: 600,
      totalTokens: 1000,
      features: [
        'grammar-constrained-decoding',
        'schema-descriptions-processed',
        'strict-mode',
        'minimal-prompt'
      ]
    };
  }
  
  return {
    provider: 'groq',
    strategy: 'prompt-centric',
    promptTokens: 1000,
    schemaTokens: 200,
    totalTokens: 1200,
    features: [
      'validation-only-schema',
      'gatt-attention-mechanism',
      'sandwich-prompting',
      'prefill-assistant',
      'xml-wrapping',
      'full-rules-in-prompt',
      'stop-sequences',
      'min-p-sampling',
      'conditional-format-instructions'
    ]
  };
}

/**
 * Get adapter options for span labeling request
 */
export function getAdapterOptions(provider: string): Record<string, unknown> {
  const normalizedProvider = provider.toLowerCase();
  
  if (normalizedProvider === 'openai') {
    return {
      schema: OPENAI_ENRICHED_SCHEMA,
      jsonMode: true,
      logprobs: true,
      topLogprobs: 3,
      seed: undefined, // Will be auto-generated from prompt hash
      retryOnValidationFailure: true,
      maxRetries: 2
    };
  }
  
  // Groq/Llama 3
  return {
    schema: GROQ_VALIDATION_SCHEMA,
    jsonMode: true,
    enableSandwich: true,   // Llama 3 PDF Section 3.2
    enablePrefill: true,    // Llama 3 PDF Section 3.3
    logprobs: true,
    topLogprobs: 3,
    seed: undefined,        // Will be auto-generated
    retryOnValidationFailure: true,
    maxRetries: 2
  };
}

// Re-exports for backward compatibility
export const BASE_SYSTEM_PROMPT = buildSystemPrompt('', false, 'groq');
export { buildSystemPrompt as buildContextAwareSystemPrompt };
export { VALID_TAXONOMY_IDS };
