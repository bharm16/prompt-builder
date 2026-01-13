/**
 * API Layer for Span Labeling
 *
 * Centralizes all API calls for span labeling operations.
 * Each method returns a Promise that resolves with the API response data.
 */

import { logger } from '@/services/LoggingService';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import type { LabelSpansPayload, LabelSpansResponse } from './spanLabelingTypes';
import { buildLabelSpansBody } from './spanLabelingRequest';
import { buildRequestError } from './spanLabelingErrors';
import { parseLabelSpansResponse } from './spanLabelingResponse';
import { readSpanLabelStream } from './spanLabelingStream';

/**
 * Span Labeling API
 */
export class SpanLabelingApi {
  private static log = logger.child('SpanLabelingApi');

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
    const authHeaders = await buildFirebaseAuthHeaders();
    const res = await fetch('/llm/label-spans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: buildLabelSpansBody(payload),
      ...(signal && { signal }),
    });

    if (!res.ok) {
      throw await buildRequestError(res);
    }

    const data: unknown = await res.json();
    return parseLabelSpansResponse(data);
  }

  /**
   * Labels spans using streaming (NDJSON)
   *
   * @param payload - The span labeling request payload
   * @param onChunk - Callback for each received span
   * @param signal - Optional abort signal for cancellation
   */
  static async labelSpansStream(
    payload: LabelSpansPayload,
    onChunk: (span: LabelSpansResponse['spans'][0]) => void,
    signal: AbortSignal | null = null
  ): Promise<LabelSpansResponse> {
    this.log.debug('Stream started', {
      textLength: payload.text.length,
      maxSpans: payload.maxSpans,
    });

    const authHeaders = await buildFirebaseAuthHeaders();
    const res = await fetch('/llm/label-spans/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: buildLabelSpansBody(payload),
      ...(signal && { signal }),
    });

    if (!res.ok) {
      if (res.status === 404) {
        this.log.warn('Stream endpoint not found, falling back to blocking', { status: 404 });
        const blocking = await this.labelSpans(payload, signal);
        blocking.spans.forEach(onChunk);
        return blocking;
      }

      const error = await buildRequestError(res);
      this.log.error('Stream request failed', error, { status: res.status });
      throw error;
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Response body not readable');

    const { spans, linesProcessed, parseErrors } = await readSpanLabelStream(reader, onChunk, this.log);

    this.log.info('Stream completed', {
      spanCount: spans.length,
      linesProcessed,
      parseErrors,
    });

    return { spans, meta: { streaming: true } };
  }
}
