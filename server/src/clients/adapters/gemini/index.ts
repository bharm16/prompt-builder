/**
 * Gemini adapter module exports
 *
 * This module provides utilities for interacting with the Gemini API,
 * following SRP by separating concerns:
 * - types.ts: Type definitions (contract changes)
 * - GeminiMessageBuilder: Message format conversion (request format changes)
 * - GeminiResponseParser: Response normalization (response format changes)
 */

export { GeminiMessageBuilder } from './GeminiMessageBuilder.ts';
export { GeminiResponseParser } from './GeminiResponseParser.ts';

export type {
  CompletionOptions,
  AdapterConfig,
  AbortControllerResult,
  GeminiPayload,
  GeminiContent,
  GeminiPart,
  GeminiGenerationConfig,
  GeminiSystemInstruction,
  GeminiResponse,
  GeminiCandidate,
  GeminiMessagesResult,
  AIResponse,
} from './types.ts';
