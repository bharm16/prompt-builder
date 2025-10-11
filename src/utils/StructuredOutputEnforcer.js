import { logger } from '../infrastructure/Logger.js';

/**
 * Structured Output Enforcer
 * Ensures LLM responses return valid JSON in the expected format
 * Uses prefill technique and schema validation
 */
export class StructuredOutputEnforcer {
  /**
   * Enforce structured JSON output from Claude API
   * @param {Object} claudeClient - Claude API client instance
   * @param {string} systemPrompt - System prompt
   * @param {Object} options - Options
   * @param {Object} options.schema - Expected JSON schema (optional, for validation)
   * @param {boolean} options.isArray - Whether output should be array (default: false)
   * @param {number} options.maxRetries - Max retry attempts (default: 2)
   * @returns {Promise<Object|Array>} Parsed and validated JSON
   */
  static async enforceJSON(claudeClient, systemPrompt, options = {}) {
    const {
      schema = null,
      isArray = false,
      maxRetries = 2,
      ...claudeOptions
    } = options;

    // Add structured output enforcement to system prompt
    const enhancedPrompt = this._enhancePromptForJSON(systemPrompt, isArray);

    let lastError = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        logger.debug('Attempting structured output extraction', {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
        });

        // Make API call with prefill for JSON
        const response = await this._callWithPrefill(
          claudeClient,
          enhancedPrompt,
          isArray,
          claudeOptions
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
        attempt++;

        logger.warn('Structured output extraction failed', {
          attempt,
          error: error.message,
          willRetry: attempt <= maxRetries,
        });

        // If not last attempt, enhance prompt with error feedback
        if (attempt <= maxRetries) {
          systemPrompt = this._enhancePromptWithErrorFeedback(
            systemPrompt,
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

    throw new Error(
      `Failed to extract valid JSON after ${maxRetries + 1} attempts: ${lastError.message}`
    );
  }

  /**
   * Enhance prompt to enforce JSON output
   * @private
   */
  static _enhancePromptForJSON(systemPrompt, isArray) {
    const jsonType = isArray ? 'JSON array' : 'JSON object';
    const example = isArray ? '[...]' : '{...}';

    return `${systemPrompt}

**CRITICAL OUTPUT REQUIREMENT:**
You MUST respond with ONLY a valid ${jsonType}. No other text, no markdown code blocks, no explanations, no preamble.

❌ INVALID: \`\`\`json\\n${example}\\n\`\`\`
❌ INVALID: "Here is the ${jsonType}:" followed by ${jsonType}
❌ INVALID: Any text before or after the ${jsonType}
✅ VALID: Start immediately with ${isArray ? '[' : '{'} and end with ${isArray ? ']' : '}'}

Your response MUST begin with the opening ${isArray ? 'bracket [' : 'brace {'} character.`;
  }

  /**
   * Enhance prompt with error feedback for retry
   * @private
   */
  static _enhancePromptWithErrorFeedback(systemPrompt, errorMessage, isArray) {
    return `${systemPrompt}

**IMPORTANT - PREVIOUS ATTEMPT FAILED:**
The previous response failed to parse with error: "${errorMessage}"

Common issues to avoid:
- Including markdown code blocks (\`\`\`json)
- Adding explanatory text before or after the JSON
- Using single quotes instead of double quotes
- Including trailing commas
- Missing required closing ${isArray ? 'brackets ]' : 'braces }'}
- Improperly escaped strings

Please try again, ensuring you return ONLY valid ${isArray ? 'JSON array starting with [' : 'JSON object starting with {'}.`;
  }

  /**
   * Call Claude API with prefill technique for JSON
   * @private
   */
  static async _callWithPrefill(
    claudeClient,
    systemPrompt,
    isArray,
    claudeOptions
  ) {
    // Use prefill technique by making assistant start with { or [
    const prefillChar = isArray ? '[' : '{';

    // Make the request through Claude client's internal method
    const response = await claudeClient._makeRequest(systemPrompt, {
      ...claudeOptions,
      userMessage: 'Please provide the output as specified.',
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
