/**
 * GeminiResponseParser - Handles response normalization from Gemini API
 *
 * Single Responsibility: Parse and normalize Gemini API responses to the
 * standard AIResponse format. Changes when Gemini's response schema changes.
 */

import type { GeminiResponse, GeminiPart, AIResponse } from './types.ts';

export class GeminiResponseParser {
  /**
   * Parse Gemini API response into normalized AIResponse format
   */
  parseResponse(data: GeminiResponse): AIResponse {
    const text = this.extractTextFromParts(data.candidates?.[0]?.content?.parts);

    return {
      text,
      metadata: {
        raw: data,
      },
    };
  }

  /**
   * Extract text content from Gemini's parts array
   *
   * Gemini responses contain an array of "parts", each potentially
   * containing text. This method concatenates all text parts.
   */
  extractTextFromParts(parts?: GeminiPart[]): string {
    if (!Array.isArray(parts)) {
      return '';
    }

    return parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('');
  }
}
