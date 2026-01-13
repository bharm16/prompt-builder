/**
 * OpenAI adapter module exports
 *
 * This module provides utilities for interacting with OpenAI-compatible APIs,
 * following SRP by separating concerns:
 * - types.ts: Type definitions (contract changes)
 * - OpenAiMessageBuilder: Message construction (prompt strategy changes)
 * - OpenAiRequestBuilder: Payload building (request format changes)
 * - OpenAiResponseParser: Response normalization (response format changes)
 * - OpenAiStreamParser: Stream decoding (SSE changes)
 */

export { OpenAiMessageBuilder } from './OpenAiMessageBuilder.ts';
export { OpenAiRequestBuilder } from './OpenAiRequestBuilder.ts';
export { OpenAiResponseParser } from './OpenAiResponseParser.ts';
export { OpenAiStreamParser } from './OpenAiStreamParser.ts';

export type {
  CompletionOptions,
  AdapterConfig,
  AbortControllerResult,
  OpenAiMessage,
  OpenAiPayload,
  LogprobInfo,
  OpenAIResponseData,
  AIResponse,
} from './types.ts';
