/**
 * LLM Client Factory
 * 
 * Creates provider-specific LLM clients based on environment configuration.
 * This ensures proper isolation of provider-specific optimizations.
 * 
 * CRITICAL CONSTRAINT: Changes to Groq must not affect OpenAI behavior.
 * The factory pattern ensures this by routing to completely separate implementations.
 */

import { RobustLlmClient } from './RobustLlmClient.js';
import { GroqLlmClient } from './GroqLlmClient.js';
import { OpenAILlmClient } from './OpenAILlmClient.js';
import { detectProvider } from '@utils/provider/ProviderDetector.js';
import type { ILlmClient, LlmClientProvider } from './ILlmClient.js';

/**
 * Factory options for creating an LLM client
 */
interface LlmClientFactoryOptions {
  /** Explicit provider override */
  provider?: LlmClientProvider;
  /** Model name for auto-detection */
  model?: string;
  /** Operation name for config lookup */
  operation?: string;
}

/**
 * Create an LLM client for the specified provider
 * 
 * Provider selection priority:
 * 1. Explicit provider parameter
 * 2. SPAN_PROVIDER environment variable
 * 3. Auto-detect from model name
 * 4. Default to Groq (current production default)
 * 
 * @param options - Factory options
 * @returns Provider-specific LLM client
 */
export function createLlmClient(options: LlmClientFactoryOptions = {}): ILlmClient {
  const provider = resolveProvider(options);

  switch (provider) {
    case 'openai':
      return new OpenAILlmClient();
    
    case 'groq':
      return new GroqLlmClient();
    
    default:
      // Default to RobustLlmClient which has generic handling
      // This is safer than guessing wrong
      console.warn(`[LlmClientFactory] Unknown provider '${provider}', using default RobustLlmClient`);
      return new RobustLlmClient();
  }
}

/**
 * Resolve provider from options, environment, or auto-detection
 */
function resolveProvider(options: LlmClientFactoryOptions): LlmClientProvider {
  // 1. Explicit provider parameter
  if (options.provider) {
    return options.provider;
  }

  // 2. Environment variable for span labeling
  const envProvider = process.env.SPAN_PROVIDER?.toLowerCase();
  if (envProvider === 'openai' || envProvider === 'groq' || envProvider === 'anthropic') {
    return envProvider as LlmClientProvider;
  }

  // 3. Auto-detect from model name
  if (options.model) {
    const detected = detectProvider({ model: options.model });
    if (detected === 'openai' || detected === 'groq') {
      return detected;
    }
  }

  // 4. Auto-detect from operation-specific env var
  if (options.operation) {
    const operationUpper = options.operation.toUpperCase().replace(/-/g, '_');
    const operationProvider = process.env[`${operationUpper}_PROVIDER`]?.toLowerCase();
    if (operationProvider === 'openai' || operationProvider === 'groq') {
      return operationProvider as LlmClientProvider;
    }
  }

  // 5. Default to Groq (current production default)
  return 'groq';
}

/**
 * Get the current provider for span labeling
 * Useful for logging and debugging
 */
export function getCurrentSpanProvider(): LlmClientProvider {
  return resolveProvider({ operation: 'span_labeling' });
}

export default {
  createLlmClient,
  getCurrentSpanProvider,
};
