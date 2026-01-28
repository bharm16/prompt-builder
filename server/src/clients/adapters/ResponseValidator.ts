/**
 * LLM Response Validator
 * 
 * Validates LLM responses for common issues:
 * - Malformed JSON
 * - Refusal patterns
 * - Empty responses
 * - Truncation detection
 * - Preamble/postamble detection
 * 
 * Used by both GroqLlamaAdapter and OpenAICompatibleAdapter
 * for automatic retry logic on validation failures.
 */

export interface ValidationOptions {
  expectJson?: boolean;
  expectArray?: boolean;
  schema?: Record<string, unknown>;
  maxLength?: number;
  minLength?: number;
  requiredFields?: string[];
  allowPartial?: boolean; // Allow truncated but valid partial responses
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  parsed?: unknown; // Parsed JSON if valid
  confidence: number; // 0-1 confidence in validity
  isRefusal: boolean;
  isTruncated: boolean;
  hasPreamble: boolean;
  hasPostamble: boolean;
  cleanedText?: string; // Text with preamble/postamble removed
}

/**
 * Common refusal patterns across models
 */
const REFUSAL_PATTERNS = [
  /I (?:cannot|can't|won't|will not|am unable to)/i,
  /I'm (?:not able|unable) to/i,
  /(?:Sorry|Apologies), (?:but )?I (?:cannot|can't)/i,
  /This request (?:violates|goes against)/i,
  /I (?:must|have to) (?:decline|refuse)/i,
  /(?:As an AI|As a language model), I/i,
  /I don't (?:feel comfortable|think it's appropriate)/i,
  /That's (?:not something|outside what) I can/i,
];

/**
 * Common preamble patterns (text before actual response)
 */
const PREAMBLE_PATTERNS = [
  /^(?:Here(?:'s| is) (?:the|your|a) (?:JSON|response|output|result)[:\s]*)/i,
  /^(?:Sure[!,]?\s*(?:here(?:'s| is))?)/i,
  /^(?:Of course[!,]?\s*)/i,
  /^(?:Certainly[!,]?\s*)/i,
  /^(?:I'd be happy to help[.!]?\s*)/i,
  /^(?:Let me (?:help|provide|generate)[^.]*[.]\s*)/i,
  /^```(?:json)?\s*/i, // Markdown code block start
];

/**
 * Common postamble patterns (text after actual response)
 */
const POSTAMBLE_PATTERNS = [
  /\s*```\s*$/i, // Markdown code block end
  /\s*Let me know if (?:you (?:need|want|have)|there's)/i,
  /\s*Feel free to (?:ask|reach out|let me know)/i,
  /\s*I hope (?:this|that) helps/i,
  /\s*Is there anything else/i,
];

/**
 * Validate an LLM response
 */
export function validateLLMResponse(
  text: string,
  options: ValidationOptions = {}
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    confidence: 1.0,
    isRefusal: false,
    isTruncated: false,
    hasPreamble: false,
    hasPostamble: false,
  };

  // Handle empty response
  if (!text || text.trim().length === 0) {
    result.isValid = false;
    result.errors.push('Empty response');
    result.confidence = 0;
    return result;
  }

  // Check for refusal
  result.isRefusal = detectRefusal(text);
  if (result.isRefusal) {
    result.isValid = false;
    result.errors.push('Response appears to be a refusal');
    result.confidence = 0.1;
    return result;
  }

  // Check length constraints
  if (options.minLength && text.length < options.minLength) {
    result.errors.push(`Response too short: ${text.length} < ${options.minLength}`);
    result.isValid = false;
    result.confidence *= 0.5;
  }

  if (options.maxLength && text.length > options.maxLength) {
    result.warnings.push(`Response may be truncated: ${text.length} > ${options.maxLength}`);
    result.isTruncated = true;
    result.confidence *= 0.8;
  }

  // JSON validation
  if (options.expectJson) {
    const jsonResult = validateJsonResponse(text, options);
    result.isValid = result.isValid && jsonResult.isValid;
    result.errors.push(...jsonResult.errors);
    result.warnings.push(...jsonResult.warnings);
    result.parsed = jsonResult.parsed;
    result.hasPreamble = jsonResult.hasPreamble;
    result.hasPostamble = jsonResult.hasPostamble;
    if (jsonResult.cleanedText !== undefined) {
      result.cleanedText = jsonResult.cleanedText;
    }
    result.confidence *= jsonResult.confidence;

    // Check truncation for JSON
    if (result.parsed === undefined && text.includes('{')) {
      const openBraces = (text.match(/{/g) || []).length;
      const closeBraces = (text.match(/}/g) || []).length;
      if (openBraces > closeBraces) {
        result.isTruncated = true;
        result.warnings.push(`JSON appears truncated: ${openBraces} open braces, ${closeBraces} close braces`);
      }
    }

    // Validate required fields
    if (result.parsed && options.requiredFields && options.requiredFields.length > 0) {
      const missingFields = options.requiredFields.filter(
        field => !hasNestedField(result.parsed as Record<string, unknown>, field)
      );
      if (missingFields.length > 0) {
        result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        result.isValid = false;
        result.confidence *= 0.5;
      }
    }
  }

  return result;
}

/**
 * Detect if response is a refusal
 */
export function detectRefusal(text: string): boolean {
  const trimmed = text.trim();
  
  // Check each refusal pattern
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate JSON response specifically
 */
function validateJsonResponse(
  text: string,
  options: ValidationOptions
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  parsed?: unknown;
  confidence: number;
  hasPreamble: boolean;
  hasPostamble: boolean;
  cleanedText?: string;
  isRefusal: boolean;
  isTruncated: boolean;
} {
  const result: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    parsed?: unknown;
    confidence: number;
    hasPreamble: boolean;
    hasPostamble: boolean;
    cleanedText?: string;
    isRefusal: boolean;
    isTruncated: boolean;
  } = {
    isValid: true,
    errors: [],
    warnings: [],
    confidence: 1.0,
    hasPreamble: false,
    hasPostamble: false,
    isRefusal: false,
    isTruncated: false,
  };

  let cleanedText = text.trim();

  // Detect and remove preamble
  for (const pattern of PREAMBLE_PATTERNS) {
    if (pattern.test(cleanedText)) {
      result.hasPreamble = true;
      cleanedText = cleanedText.replace(pattern, '').trim();
      result.warnings.push('Response contained preamble text');
      result.confidence *= 0.9;
    }
  }

  // Detect and remove postamble
  for (const pattern of POSTAMBLE_PATTERNS) {
    if (pattern.test(cleanedText)) {
      result.hasPostamble = true;
      cleanedText = cleanedText.replace(pattern, '').trim();
      result.warnings.push('Response contained postamble text');
      result.confidence *= 0.9;
    }
  }

  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleanedText = codeBlockMatch[1].trim();
    result.hasPreamble = true;
    result.hasPostamble = true;
    result.warnings.push('JSON was wrapped in markdown code blocks');
    result.confidence *= 0.95;
  }

  // Find JSON boundaries
  const expectArray = options.expectArray ?? false;
  const jsonStart = cleanedText.indexOf(expectArray ? '[' : '{');
  const jsonEnd = cleanedText.lastIndexOf(expectArray ? ']' : '}');

  if (jsonStart === -1) {
    result.errors.push(`No ${expectArray ? 'array' : 'object'} found in response`);
    result.isValid = false;
    result.confidence = 0.1;
    return result;
  }

  if (jsonEnd === -1 || jsonEnd < jsonStart) {
    result.errors.push('JSON appears incomplete or malformed');
    result.isValid = false;
    result.confidence = 0.2;
    return result;
  }

  // Extract JSON substring
  const extractedJson = cleanedText.substring(jsonStart, jsonEnd + 1);
  result.cleanedText = extractedJson;

  // Parse JSON
  try {
    result.parsed = JSON.parse(extractedJson);
    
    // Validate expected type
    if (expectArray && !Array.isArray(result.parsed)) {
      result.errors.push('Expected array but got object');
      result.isValid = false;
      result.confidence *= 0.3;
    } else if (!expectArray && Array.isArray(result.parsed)) {
      result.errors.push('Expected object but got array');
      result.isValid = false;
      result.confidence *= 0.3;
    }
  } catch (e) {
    const parseError = e as Error;
    result.errors.push(`JSON parse error: ${parseError.message}`);
    result.isValid = false;
    result.confidence = 0.1;

    // Try to provide helpful context
    const errorMatch = parseError.message.match(/position (\d+)/);
    if (errorMatch?.[1]) {
      const position = Number.parseInt(errorMatch[1], 10);
      const contextStart = Math.max(0, position - 20);
      const contextEnd = Math.min(extractedJson.length, position + 20);
      const context = extractedJson.substring(contextStart, contextEnd);
      result.errors.push(`Error context: "...${context}..."`);
    }
  }

  // Return result with proper typing
  return result;
}

/**
 * Check if object has a nested field (supports dot notation)
 */
function hasNestedField(obj: Record<string, unknown>, path: string): boolean {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current !== undefined;
}

/**
 * Attempt to repair common JSON issues
 */
