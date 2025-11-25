/**
 * API Layer for Span Labeling
 *
 * Centralizes all API calls for span labeling operations.
 * Each method returns a Promise that resolves with the API response data.
 */

import { API_CONFIG } from '@config/api.config';

/**
 * Default headers for span labeling API requests
 */
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': API_CONFIG.apiKey,
};

interface LabelSpansPayload {
  text: string;
  maxSpans?: number;
  minConfidence?: number;
  policy?: Record<string, unknown>;
  templateVersion?: string;
}

interface LabelSpansResponse {
  spans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  meta: Record<string, unknown> | null;
}

/**
 * Builds the request body for span labeling API call
 * @private
 */
function buildBody(payload: LabelSpansPayload): string {
  const body = {
    text: payload.text,
    maxSpans: payload.maxSpans,
    minConfidence: payload.minConfidence,
    policy: payload.policy,
    templateVersion: payload.templateVersion,
  };

  return JSON.stringify(body);
}

/**
 * Span Labeling API
 */
export class SpanLabelingApi {
  /**
   * Labels spans in the provided text
   *
   * @param payload - The span labeling request payload
   * @param signal - Optional abort signal for cancellation
   * @returns Response with spans and metadata
   * @throws Error If the request fails
   */
  static async labelSpans(
    payload: LabelSpansPayload,
    signal: AbortSignal | null = null
  ): Promise<LabelSpansResponse> {
    const res = await fetch('/llm/label-spans', {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: buildBody(payload),
      ...(signal && { signal }),
    });

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      try {
        const errorBody = (await res.json()) as { message?: string };
        if (errorBody?.message) {
          message = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors and fall back to default message
      }
      const error = new Error(message) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }

    const data = (await res.json()) as {
      spans?: unknown[];
      meta?: Record<string, unknown> | null;
    };
    return {
      spans: Array.isArray(data?.spans) ? (data.spans as LabelSpansResponse['spans']) : [],
      meta: data?.meta ?? null,
    };
  }
}

