import { logger } from '../infrastructure/Logger.js';

/**
 * Structured Output Enforcer
 * Ensures LLM responses return valid JSON in the expected format
 * Uses prefill technique and schema validation
 */
export class StructuredOutputEnforcer {
  /**
   * Enforce structured JSON output from an AI service
   * @param {Object} aiService - AIModelService instance
   * @param {string} systemPrompt - System prompt
   * @param {Object} options - Options
   * @param {string} options.operation - The operation name for AIModelService
   * @param {Object} options.schema - Expected JSON schema (optional, for validation)
   * @param {boolean} options.isArray - Whether output should be array (default: false)
   * @param {number} options.maxRetries - Max retry attempts (default: 2)
   * @returns {Promise<Object|Array>} Parsed and validated JSON
   */
  static async enforceJSON(aiService, systemPrompt, options = {}) {
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

    let lastError = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        logger.debug('Attempting structured output extraction', {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
        });

        // Make API call through AIModelService
        const response = await this._callAIService(
          aiService,
          operation,
          currentSystemPrompt,
          restOptions
        );

        // Extract and clean JSON from response
        const cleanedText = this._cleanJSONResponse(
          response.content[0].text,
          isArray
        );

        // Parse JSON
        const parsedJSON = JSON.parse(cleanedText);

        // Validate against schema if provided
        if (schema) {
          this._validateSchema(parsedJSON, schema);
        }

        logger.debug('Successfully extracted structured output', {
          attempt: attempt + 1,
          type: isArray ? 'array' : 'object',
        });

        return parsedJSON;
      } catch (error) {
        lastError = error;

        // Don't retry API errors (rate limits, auth errors, etc.) - throw immediately
        if (error.name === 'APIError' || error.statusCode) {
          logger.warn('API error encountered, not retrying', {
            error: error.message,
            statusCode: error.statusCode,
          });
          throw error;
        }

        attempt++;

        logger.warn('Structured output extraction failed', {
          attempt,
          error: error.message,
          willRetry: attempt <= maxRetries,
        });

        // If not last attempt, enhance prompt with error feedback
        if (attempt <= maxRetries) {
          currentSystemPrompt = this._enhancePromptWithErrorFeedback(
            systemPrompt, // Use original system prompt
            error.message,
            isArray
          );
        }
      }
    }

    // All retries exhausted
    logger.error('All structured output extraction attempts failed', {
      attempts: maxRetries + 1,
      lastError: lastError.message,
    });

    // Create error and preserve statusCode if original error had one
    const finalError = new Error(
      `Failed to extract valid JSON after ${maxRetries + 1} attempts: ${lastError.message}`
    );

    // Preserve statusCode from APIError
    if (lastError.statusCode) {
      finalError.statusCode = lastError.statusCode;
    }

    throw finalError;
  }

  /**
   * Enhance prompt to enforce JSON output
   * @private
   */
  static _enhancePromptForJSON(systemPrompt, isArray) {
    const jsonType = isArray ? 'JSON array' : 'JSON object';
    const example = isArray ? '[...]': '{...}';

    return `${systemPrompt}` +
           `\n**CRITICAL OUTPUT REQUIREMENT:**\n` +
           `You MUST respond with ONLY a valid ${jsonType}. No other text, no markdown code blocks, no explanations, no preamble.\n\n` +
           `❌ INVALID: 
${example}
` +
           `❌ INVALID: "Here is the ${jsonType}:" followed by ${jsonType}` +
           `❌ INVALID: Any text before or after the ${jsonType}` +
           `✅ VALID: Start immediately with ${isArray ? '[' : '{'} and end with ${isArray ? ']' : '}'}` +
           `\nYour response MUST begin with the opening ${isArray ? 'bracket [' : 'brace {'} character.`;
  }

  /**
   * Enhance prompt with error feedback for retry
   * @private
   */
  static _enhancePromptWithErrorFeedback(systemPrompt, errorMessage, isArray) {
    return `${systemPrompt}` +
           `\n**IMPORTANT - PREVIOUS ATTEMPT FAILED:**\n` +
           `The previous response failed to parse with error: "${errorMessage}"` +
           `\nCommon issues to avoid:` +
           `\n- Including markdown code blocks (
` +
           `- Adding explanatory text before or after the JSON` +
           `- Using single quotes instead of double quotes` +
           `- Including trailing commas` +
           `- Missing required closing ${isArray ? 'brackets ]' : 'braces }'}` +
           `- Improperly escaped strings` +
           `\nPlease try again, ensuring you return ONLY valid ${isArray ? 'JSON array starting with [' : 'JSON object starting with {'}.`;
  }

  /**
   * Call AI Service to get a completion
   * @private
   */
  static async _callAIService(
    aiService,
    operation,
    systemPrompt,
    options
  ) {
    const response = await aiService.execute(operation, {
      systemPrompt,
      userMessage: 'Please provide the output as specified.',
      ...options,
    });

    return response;
  }

  /**
   * Clean JSON response by removing markdown and extra text
   * @private
   */
  static _cleanJSONResponse(text, isArray) {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Remove common preambles
    cleaned = cleaned.replace(
      /^(Here is|Here's|This is|The|Output:|Response:)\s*/i,
      ''
    );

    // Trim whitespace
    cleaned = cleaned.trim();

    // Find the actual JSON start and end
    const startChar = isArray ? '[' : '{';
    const endChar = isArray ? ']' : '}';

    const startIndex = cleaned.indexOf(startChar);
    const lastIndex = cleaned.lastIndexOf(endChar);

    if (startIndex === -1 || lastIndex === -1 || lastIndex < startIndex) {
      throw new Error(
        `Invalid JSON structure: Expected ${startChar}...${endChar}`
      );
    }

    // Extract only the JSON portion
    cleaned = cleaned.substring(startIndex, lastIndex + 1);

    return cleaned;
  }

  /**
   * Validate JSON against schema
   * @private
   */
  static _validateSchema(data, schema) {
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
    if (schema.type === 'object' && schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
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
        for (const field of schema.items.required) {
          if (!(field in item)) {
            throw new Error(
              `Missing required field '${field}' in array item at index ${i}`
            );
          }
        }
      }
    }

    logger.debug('Schema validation passed');
  }
}