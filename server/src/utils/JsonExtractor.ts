/**
 * JSON Extractor
 *
 * Pure functions for extracting and cleaning JSON from LLM responses.
 * Handles mechanism (how to clean/parse) without policy (retry logic).
 */
import type { AIResponse } from '@interfaces/IAIClient';

/**
 * Extract text from AI service response
 * Handles both { text: string } and { content: [{ text: string }] } formats
 */
export function extractResponseText(response: AIResponse): string {
  if (response.text) {
    return response.text;
  }
  if (response.content && Array.isArray(response.content) && response.content.length > 0) {
    return response.content[0]?.text || '';
  }
  return '';
}

/**
 * Clean JSON response by removing markdown and extra text
 */
export function cleanJSONResponse(text: string, isArray: boolean): string {
  // Add more aggressive cleaning before parsing
  let cleanedResponse = text
    .replace(/```json\n?/gi, '')  // Case-insensitive markdown removal
    .replace(/```\n?/gi, '')       // Case-insensitive markdown removal
    .trim();

  // Remove common preambles
  cleanedResponse = cleanedResponse.replace(
    /^(Here is|Here's|This is|The|Output:|Response:)\s*/i,
    ''
  );

  // If it starts with explanation text, find the array/object
  const startChar = isArray ? '[' : '{';
  if (!cleanedResponse.startsWith(startChar)) {
    const arrayStart = cleanedResponse.indexOf(startChar);
    if (arrayStart !== -1) {
      cleanedResponse = cleanedResponse.substring(arrayStart);
    }
  }

  // Find the actual JSON start and end
  const endChar = isArray ? ']' : '}';

  const startIndex = cleanedResponse.indexOf(startChar);
  const lastIndex = cleanedResponse.lastIndexOf(endChar);

  if (startIndex === -1 || lastIndex === -1 || lastIndex < startIndex) {
    throw new Error(
      `Invalid JSON structure: Expected ${startChar}...${endChar}`
    );
  }

  // Extract only the JSON portion
  cleanedResponse = cleanedResponse.substring(startIndex, lastIndex + 1);

  return cleanedResponse;
}

/**
 * Extract and parse JSON from response text.
 *
 * When `schema` is provided, the parsed value is validated at runtime
 * (e.g. via Zod `.parse()`), replacing the unchecked `as T` cast with
 * a true type boundary.
 */
export function extractAndParse<T>(
  responseText: string,
  isArray: boolean,
  schema?: { parse: (data: unknown) => T }
): T {
  const cleanedText = cleanJSONResponse(responseText, isArray);
  const raw: unknown = JSON.parse(cleanedText);
  return schema ? schema.parse(raw) : raw as T;
}
