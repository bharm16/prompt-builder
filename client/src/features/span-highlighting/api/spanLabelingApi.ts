/**
 * API Layer for Span Labeling
 *
 * Centralizes all API calls for span labeling operations.
 * Each method returns a Promise that resolves with the API response data.
 */

import { API_CONFIG } from '@config/api.config';
import { logger } from '@/services/LoggingService';

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
  policy?: unknown;
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
      maxSpans: payload.maxSpans
    });

    const res = await fetch('/llm/label-spans/stream', {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: buildBody(payload),
      ...(signal && { signal }),
    });

    if (!res.ok) {
        // Fallback to blocking if stream endpoint missing (404) or error
        if (res.status === 404) {
            this.log.warn('Stream endpoint not found, falling back to blocking', { status: 404 });
            const blocking = await this.labelSpans(payload, signal);
            blocking.spans.forEach(onChunk);
            return blocking;
        }
        
        // Error handling matches labelSpans
        let message = `Request failed with status ${res.status}`;
        try {
            const errorBody = (await res.json()) as { message?: string };
            if (errorBody?.message) {
            message = errorBody.message;
            }
        } catch {
             // Ignore
        }
        const error = new Error(message) as Error & { status?: number };
        error.status = res.status;
        this.log.error('Stream request failed', error, { status: res.status });
        throw error;
    }
    
    // Process NDJSON stream
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Response body not readable');
    
    const decoder = new TextDecoder();
    let buffer = '';
    const spans: LabelSpansResponse['spans'] = [];

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep last incomplete line
            
            for (const line of lines) {
                if (!line.trim()) continue;
                this.log.debug('Stream chunk received', { line });
                try {
                    const span = JSON.parse(line);
                    if (span.error) {
                         // Stream reported error
                         throw new Error(span.error);
                    }
                    if (span.text && (span.category || span.role)) {
                         onChunk(span);
                         spans.push(span);
                    }
                } catch (e) {
                    this.log.warn('JSON parse failed', {
                        line,
                        error: (e as Error).message
                    });
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
    
    this.log.info('Stream completed', { spanCount: spans.length });
    return { spans, meta: { streaming: true } };
  }
}
