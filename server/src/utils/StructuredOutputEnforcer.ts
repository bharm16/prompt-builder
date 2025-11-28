import { logger } from '@infrastructure/Logger';
import { extractResponseText, extractAndParse } from './JsonExtractor.js';
import { RetryPolicy } from './RetryPolicy.js';

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
 * Ensures LLM responses return valid JSON in the expected format
 * Uses prefill technique and schema validation
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
      operation, // Extract operation for AIModelService
      ...restOptions
    } = options;

    if (!operation) {
      throw new Error('StructuredOutputEnforcer.enforceJSON requires an "operation" option.');
    }

    // Add structured output enforcement to system prompt
    let currentSystemPrompt = this._enhancePromptForJSON(systemPrompt, isArray);

    // Use RetryPolicy to wrap JSON extraction
    return RetryPolicy.execute(
      async () => {
        logger.debug('Attempting structured output extraction', {
          maxRetries: maxRetries + 1,
        });

        // Make API call through AIModelService
        const response = await this._callAIService(
          aiService,
          operation,
          currentSystemPrompt,
          { ...restOptions, isArray }  // Pass the isArray flag through
        );

        // Extract text from response
        const responseText = extractResponseText(response);

        // Extract and parse JSON (mechanism)
        let parsedJSON: T;
        try {
          parsedJSON = extractAndParse<T>(responseText, isArray);
        } catch (parseError) {
          // Log the actual response to debug
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
          logger.error('Failed to parse JSON response', {
            error: errorMessage,
            cleanedResponse: responseText.substring(0, 200),
            fullLength: responseText.length,
          });
          throw parseError;
        }

        // Validate against schema if provided
        if (schema) {
          this._validateSchema(parsedJSON, schema);
        }

        logger.debug('Successfully extracted structured output', {
          type: isArray ? 'array' : 'object',
        });

        return parsedJSON;
      },
      {
        maxRetries,
        shouldRetry: RetryPolicy.createApiErrorFilter(),
        onRetry: (error, attempt) => {
          // Enhance prompt with error feedback for next attempt
          currentSystemPrompt = this._enhancePromptWithErrorFeedback(
            systemPrompt, // Use original system prompt
            error.message,
            isArray
          );
          logger.warn('Structured output extraction failed, retrying', {
            attempt,
            error: error.message,
          });
        },
      }
    );
  }

  /**
   * Enhance prompt to enforce JSON output
   * @private
   */
  private static _enhancePromptForJSON(systemPrompt: string, isArray: boolean): string {
    const jsonType = isArray ? 'JSON array' : 'JSON object';
    const example = isArray ? '[...]': '{...}';

    return `${systemPrompt}` +
           `\n**CRITICAL OUTPUT REQUIREMENT:**\n` +
           `You MUST respond with ONLY a valid ${jsonType}. No other text, no markdown code blocks, no explanations, no preamble.\n\n` +
           `❌ INVALID: \n${example}\n` +
           `❌ INVALID: "Here is the ${jsonType}:" followed by ${jsonType}` +
           `❌ INVALID: Any text before or after the ${jsonType}` +
           `✅ VALID: Start immediately with ${isArray ? '[' : '{'} and end with ${isArray ? ']' : '}'}` +
           `\nYour response MUST begin with the opening ${isArray ? 'bracket [' : 'brace {'} character.`;
  }

  /**
   * Enhance prompt with error feedback for retry
   * @private
   */
  private static _enhancePromptWithErrorFeedback(systemPrompt: string, errorMessage: string, isArray: boolean): string {
    return `${systemPrompt}` +
           `\n**IMPORTANT - PREVIOUS ATTEMPT FAILED:**\n` +
           `The previous response failed to parse with error: "${errorMessage}"` +
           `\nCommon issues to avoid:` +
           `\n- Including markdown code blocks (\`\`\`json\`\`\`)` +
           `\n- Adding explanatory text before or after the JSON` +
           `\n- Using single quotes instead of double quotes` +
           `\n- Including trailing commas` +
           `\n- Missing required closing ${isArray ? 'brackets ]' : 'braces }'}` +
           `\n- Improperly escaped strings` +
           `\nPlease try again, ensuring you return ONLY valid ${isArray ? 'JSON array starting with [' : 'JSON object starting with {'}.`;
  }

  /**
   * Call AI Service to get a completion
   * @private
   */
  private static async _callAIService(
    aiService: AIService,
    operation: string,
    systemPrompt: string,
    options: Record<string, unknown>
  ): Promise<AIServiceResponse> {
    const response = await aiService.execute(operation, {
      systemPrompt,
      userMessage: 'Please provide the output as specified.',
      ...options,
    });

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
    // Basic schema validation
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

