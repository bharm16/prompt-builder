import { logger } from '@infrastructure/Logger';
import { extractResponseText, extractAndParse } from './JsonExtractor.js';
import { RetryPolicy } from './RetryPolicy.js';
import { detectAndGetCapabilities, type ProviderType } from './provider/ProviderDetector.js';

interface EnforceJSONOptions {
  schema?: {
    type: 'object' | 'array';
    required?: string[];
    items?: {
      required?: string[];
    };
  } | null;
  isArray?: boolean;
  maxRetries?: number;
  operation: string;
  /** Explicit provider override (auto-detected if not provided) */
  provider?: ProviderType;
  /** Model being used (helps with provider detection) */
  model?: string;
  [key: string]: unknown;
}

interface AIServiceResponse {
  text?: string;
  metadata?: Record<string, unknown>;
  content?: Array<{
    text: string;
  }>;
}

interface AIService {
  execute(operation: string, options: Record<string, unknown>): Promise<AIServiceResponse>;
}

/**
 * Structured Output Enforcer
 * 
 * Ensures LLM responses return valid JSON in the expected format.
 * 
 * Provider-Aware Optimizations:
 * - OpenAI with strict schema: Skip prompt format instructions (grammar-constrained)
 * - OpenAI with developerMessage: Use developer role for hard constraints
 * - Groq/Llama: Use sandwich prompting and format instructions
 * - Auto-unwrap: Handles `{"suggestions": [...]}` wrapper for json_object mode
 * 
 * Performance Improvements:
 * - ~10-15% faster for OpenAI with strict schema (fewer constraint tokens)
 * - More reliable JSON output across providers
 */
export class StructuredOutputEnforcer {
  /**
   * Enforce structured JSON output from an AI service
   */
  static async enforceJSON<T = unknown>(
    aiService: AIService,
    systemPrompt: string,
    options: EnforceJSONOptions
  ): Promise<T> {
    const {
      schema = null,
      isArray = false,
      maxRetries = 2,
      operation,
      provider: explicitProvider,
      model,
      ...restOptions
    } = options;

    if (!operation) {
      throw new Error('StructuredOutputEnforcer.enforceJSON requires an "operation" option.');
    }

    // Detect provider and capabilities
    const { provider, capabilities } = detectAndGetCapabilities({
      operation,
      model,
      client: explicitProvider,
    });

    // Determine if we should add format instructions to the prompt
    const hasStrictSchema = !!schema && capabilities.strictJsonSchema;
    
    logger.debug('StructuredOutputEnforcer: Provider detection', {
      operation,
      provider,
      hasStrictSchema,
      needsPromptFormatInstructions: capabilities.needsPromptFormatInstructions,
    });

    // Conditionally enhance prompt based on provider capabilities
    let currentSystemPrompt = this._enhancePromptForJSON(
      systemPrompt, 
      isArray, 
      hasStrictSchema,
      capabilities.needsPromptFormatInstructions
    );

    // Use RetryPolicy to wrap JSON extraction
    return RetryPolicy.execute(
      async () => {
        logger.debug('Attempting structured output extraction', {
          maxRetries: maxRetries + 1,
          provider,
          hasStrictSchema,
        });

        // Make API call through AIModelService
        const response = await this._callAIService(
          aiService,
          operation,
          currentSystemPrompt,
          { 
            ...restOptions, 
            isArray,
            // Pass provider info for downstream optimizations
            _providerHint: provider,
            _hasStrictSchema: hasStrictSchema,
          }
        );

        // Extract text from response
        const responseText = extractResponseText(response);

        // Extract and parse JSON (mechanism)
        let parsedJSON: T;
        try {
          parsedJSON = extractAndParse<T>(responseText, isArray);
        } catch (parseError) {
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
          logger.error('Failed to parse JSON response', {
            error: errorMessage,
            cleanedResponse: responseText.substring(0, 200),
            fullLength: responseText.length,
            provider,
            hasStrictSchema,
          });
          throw parseError;
        }

        /**
         * Auto-unwrap array from object wrapper
         * 
         * Groq's json_object mode requires top-level object, so prompts use:
         * {"suggestions": [...]} instead of bare [...]
         * 
         * This unwraps automatically when isArray=true but we get an object
         * with a "suggestions" key containing an array.
         */
        if (isArray && !Array.isArray(parsedJSON) && typeof parsedJSON === 'object' && parsedJSON !== null) {
          const wrapped = parsedJSON as Record<string, unknown>;
          if (Array.isArray(wrapped.suggestions)) {
            logger.debug('Auto-unwrapping suggestions array from object wrapper');
            parsedJSON = wrapped.suggestions as T;
          }
        }

        // Validate against schema if provided
        if (schema) {
          this._validateSchema(parsedJSON, schema);
        }

        logger.debug('Successfully extracted structured output', {
          type: isArray ? 'array' : 'object',
          provider,
        });

        return parsedJSON;
      },
      {
        maxRetries,
        shouldRetry: RetryPolicy.createApiErrorFilter(),
        onRetry: (error, attempt) => {
          // Enhance prompt with error feedback for next attempt
          // Always add error context on retry, regardless of provider
          currentSystemPrompt = this._enhancePromptWithErrorFeedback(
            systemPrompt,
            error.message,
            isArray,
            capabilities.needsPromptFormatInstructions
          );
          logger.warn('Structured output extraction failed, retrying', {
            attempt,
            error: error.message,
            provider,
          });
        },
      }
    );
  }

  /**
   * Enhance prompt to enforce JSON output
   * 
   * Provider-Aware Behavior:
   * - OpenAI with strict schema: Skip format instructions (grammar handles it)
   * - All other cases: Add minimal format instruction
   * 
   * @private
   */
  private static _enhancePromptForJSON(
    systemPrompt: string, 
    isArray: boolean,
    hasStrictSchema: boolean,
    needsPromptFormatInstructions: boolean
  ): string {
    // If using strict schema mode (OpenAI), grammar-constrained decoding
    // handles format enforcement automatically. Adding text instructions
    // wastes ~15-20 tokens and can cause parsing confusion.
    if (hasStrictSchema && !needsPromptFormatInstructions) {
      logger.debug('Skipping JSON format instructions (strict schema mode)');
      return systemPrompt;
    }

    // For providers without strict schema (Groq/Llama, etc.),
    // add minimal format instruction
    const start = isArray ? '[' : '{';
    return `${systemPrompt}\n\nRespond with ONLY valid JSON. Start with ${start} - no other text.`;
  }

  /**
   * Enhance prompt with error feedback for retry
   * Always adds feedback regardless of provider (retry needs guidance)
   * 
   * @private
   */
  private static _enhancePromptWithErrorFeedback(
    systemPrompt: string, 
    errorMessage: string, 
    isArray: boolean,
    needsPromptFormatInstructions: boolean
  ): string {
    const start = isArray ? '[' : '{';
    
    // On retry, always provide explicit format guidance
    // The previous attempt failed, so we need stronger direction
    return `${systemPrompt}

Previous attempt failed: ${errorMessage}

RETRY INSTRUCTIONS:
- Respond with ONLY valid JSON
- Start with ${start}
- No markdown code blocks, no explanatory text
- Ensure all required fields are present`;
  }

  /**
   * Call AI Service to get a completion
   * 
   * Passes through provider hints for downstream optimization
   * @private
   */
  private static async _callAIService(
    aiService: AIService,
    operation: string,
    systemPrompt: string,
    options: Record<string, unknown>
  ): Promise<AIServiceResponse> {
    const executeOptions: Record<string, unknown> = {
      systemPrompt,
      userMessage: 'Please provide the output as specified.',
      ...options,
    };

    // If schema is provided, pass it through for strict mode
    // The adapter will convert this to response_format: { type: "json_schema", ... }
    if (options.schema) {
      executeOptions.schema = options.schema;
      // Remove jsonMode since strict schema mode supersedes it
      delete executeOptions.jsonMode;
    }

    const response = await aiService.execute(operation, executeOptions);

    return response;
  }

  /**
   * Validate JSON against schema
   * @private
   */
  private static _validateSchema(
    data: unknown,
    schema: {
      type: 'object' | 'array';
      required?: string[];
      items?: {
        required?: string[];
      };
    }
  ): void {
    // Check if data is array when schema expects array
    if (schema.type === 'array' && !Array.isArray(data)) {
      throw new Error('Expected array but got object');
    }

    // Check if data is object when schema expects object
    if (schema.type === 'object' && Array.isArray(data)) {
      throw new Error('Expected object but got array');
    }

    // Check required fields for objects
    if (schema.type === 'object' && schema.required && typeof data === 'object' && data !== null) {
      const dataObj = data as Record<string, unknown>;
      for (const field of schema.required) {
        if (!(field in dataObj)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }

    // Check array items schema
    if (
      schema.type === 'array' &&
      schema.items &&
      schema.items.required &&
      Array.isArray(data)
    ) {
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (typeof item === 'object' && item !== null) {
          const itemObj = item as Record<string, unknown>;
          for (const field of schema.items.required) {
            if (!(field in itemObj)) {
              throw new Error(
                `Missing required field '${field}' in array item at index ${i}`
              );
            }
          }
        }
      }
    }

    logger.debug('Schema validation passed');
  }
}
