/**
 * Type definitions for OpenAI-compatible API integration
 */

import type { AIResponse } from '@interfaces/IAIClient';

export interface CompletionOptions {
  userMessage?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  signal?: AbortSignal;
  jsonMode?: boolean;
  isArray?: boolean;
  responseFormat?: { type: string; [key: string]: unknown };
  schema?: Record<string, unknown>;
  messages?: Array<{ role: string; content: string }>;
  onChunk?: (chunk: string) => void;
  developerMessage?: string;
  enableBookending?: boolean;
  seed?: number;
  logprobs?: boolean;
  topLogprobs?: number;
  prediction?: {
    type: 'content';
    content: string;
  };
  retryOnValidationFailure?: boolean;
  maxRetries?: number;
  store?: boolean;
  streamOptions?: { include_usage?: boolean };
}

export interface AdapterConfig {
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  defaultTimeout?: number;
  providerName?: string;
}

export interface AbortControllerResult {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
  abortedByTimeout: { value: boolean };
}

export interface OpenAiMessage {
  role: string;
  content: string;
}

export type OpenAiPayload = Record<string, unknown>;

export interface LogprobInfo {
  token: string;
  logprob: number;
  probability: number;
}

export interface OpenAIResponseData {
  choices?: Array<{
    message?: { content?: string };
    logprobs?: {
      content?: Array<{
        token: string;
        logprob: number;
        top_logprobs?: Array<{ token: string; logprob: number }>;
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: unknown;
  system_fingerprint?: string;
  id?: string;
  model?: string;
}

export type { AIResponse };
