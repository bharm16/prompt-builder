/**
 * PromptOptimizationApi - Enhanced API Service with Two-Stage Streaming
 *
 * Supports Server-Sent Events (SSE) for real-time draft and refinement updates
 * Provides fast perceived performance (~300ms to draft, full refinement in background)
 */

import { ApiClient, ApiError } from './ApiClient';
import { logger } from './LoggingService';
import type { LockedSpan } from '@/features/prompt-optimizer/types';
import type { CapabilityValues } from '@shared/capabilities';

const log = logger.child('PromptOptimizationApi');

interface OptimizeOptions {
  prompt: string;
  mode: string;
  targetModel?: string; // New
  context?: unknown | null;
  brainstormContext?: unknown | null;
  generationParams?: CapabilityValues;
  skipCache?: boolean;
  lockedSpans?: LockedSpan[];
  signal?: AbortSignal;
}

interface OptimizeResult {
  optimizedPrompt: string;
  metadata?: Record<string, unknown>;
}

interface OptimizeWithStreamingOptions extends OptimizeOptions {
  onDraft?: ((draft: string) => void) | null;
  onSpans?: ((spans: unknown[], source: string, meta?: unknown) => void) | null;
  onRefined?: ((refined: string, metadata?: Record<string, unknown>) => void) | null;
  onError?: ((error: Error) => void) | null;
}

interface OptimizeWithStreamingResult {
  draft: string;
  refined: string;
  spans: unknown[];
  metadata: Record<string, unknown> | null;
  usedFallback: boolean;
}

interface StreamWithFetchOptions {
  url: string;
  method: string;
  body: Record<string, unknown>;
  onMessage: (event: string, data: Record<string, unknown>) => void;
  onError: (error: Error) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

interface OfflineResult {
  draft: string;
  refined: string;
  spans: unknown[];
  metadata: Record<string, unknown>;
  usedFallback: boolean;
}

export class PromptOptimizationApi {
  constructor(private readonly client: ApiClient) {}

  /**
   * Optimize a prompt with legacy single-stage API (fallback)
   */
  async optimizeLegacy({
    prompt,
    mode,
    targetModel, // New
    context = null,
    brainstormContext = null,
    generationParams,
    skipCache,
    lockedSpans,
    signal,
  }: OptimizeOptions): Promise<OptimizeResult> {
    try {
      const requestOptions = signal ? { signal } : {};
      return (await this.client.post('/optimize', {
        prompt,
        mode,
        ...(targetModel ? { targetModel } : {}), // New
        context,
        brainstormContext,
        ...(generationParams ? { generationParams } : {}),
        ...(skipCache ? { skipCache } : {}),
        ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
      }, requestOptions)) as OptimizeResult;
    } catch (error) {
      if (this._shouldUseOfflineFallback(error)) {
        const offline = this._buildOfflineResult(
          { prompt, mode, context, brainstormContext },
          error
        );
        return {
          optimizedPrompt: offline.refined,
          metadata: offline.metadata,
        };
      }

      throw error;
    }
  }

  /**
   * Optimize a prompt with two-stage streaming
   */
  async optimizeWithStreaming({
    prompt,
    mode,
    targetModel, // New
    context = null,
    brainstormContext = null,
    generationParams,
    skipCache,
    lockedSpans,
    signal,
    onDraft = null,
    onSpans = null,
    onRefined = null,
    onError = null,
  }: OptimizeWithStreamingOptions): Promise<OptimizeWithStreamingResult> {
    return new Promise((resolve, reject) => {
      let draft: string | null = null;
      let refined: string | null = null;
      let spans: unknown[] | null = null;
      let metadata: Record<string, unknown> | null = null;
      let doneReceived = false;
      let settled = false;

      // Build request URL
      const baseUrl =
        (this.client as unknown as { getBaseUrl?: () => string }).getBaseUrl?.() ||
        '/api';
      const url = `${baseUrl}/optimize-stream`;

      // Create EventSource for SSE
      // Note: EventSource only supports GET, so we use fetch with streaming instead
      this.streamWithFetch({
        url,
        method: 'POST',
        body: {
          prompt,
          mode,
          ...(targetModel ? { targetModel } : {}), // New
          context,
          brainstormContext,
          ...(generationParams ? { generationParams } : {}),
          ...(skipCache ? { skipCache } : {}),
          ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
        },
        ...(signal ? { signal } : {}),
        onMessage: (event, data) => {
          try {
            switch (event) {
              case 'draft':
                draft = data.draft as string;
                if (onDraft && typeof onDraft === 'function') {
                  onDraft(draft);
                }
                break;

              case 'spans':
                // New event type for parallel span labeling
                spans = data.spans as unknown[];
                if (onSpans && typeof onSpans === 'function') {
                  onSpans(
                    data.spans as unknown[],
                    (data.source as string) || 'unknown',
                    data.meta
                  );
                }
                break;

              case 'refined':
                refined = data.refined as string;
                metadata = (data.metadata as Record<string, unknown>) || null;
                if (onRefined && typeof onRefined === 'function') {
                  onRefined(refined, metadata || undefined);
                }
                break;

              case 'done':
                // Resolve with final result including spans
                doneReceived = true;
                if (!settled) {
                  settled = true;
                  resolve({
                    draft: draft || refined || '',
                    refined: refined || draft || '',
                    spans: spans || [],
                    metadata,
                    usedFallback: (data.usedFallback as boolean) || false,
                  });
                }
                break;

              case 'error':
                const error = new Error(
                  (data.error as string) || 'Streaming optimization failed'
                );
                if (onError && typeof onError === 'function') {
                  onError(error);
                }
                if (!settled) {
                  settled = true;
                  reject(error);
                }
                break;
            }
          } catch (parseError) {
            log.error('Error parsing streaming event', parseError as Error, {
              event,
            });
          }
        },
        onError: (error) => {
          if (onError && typeof onError === 'function') {
            onError(error);
          }
          if (!settled) {
            settled = true;
            reject(error);
          }
        },
        onComplete: () => {
          if (settled || doneReceived) {
            return;
          }
          const error = new Error('Streaming ended before completion');
          if (onError && typeof onError === 'function') {
            onError(error);
          }
          settled = true;
          reject(error);
        },
      });
    });
  }

  /**
   * Internal method to handle SSE streaming with fetch
   * @private
   */
  private async streamWithFetch({
    url,
    method,
    body,
    onMessage,
    onError,
    onComplete,
    signal,
  }: StreamWithFetchOptions): Promise<void> {
    try {
      const config = this.client as unknown as {
        config?: { defaultHeaders?: Record<string, string> };
      };
      const apiKey =
        config.config?.defaultHeaders?.['X-API-Key'] || '';

      const requestInit: RequestInit = {
        method: method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(body),
      };
      if (signal) {
        requestInit.signal = signal;
      }

      const response = await fetch(url, requestInit);

      if (!response.ok) {
        const error = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        ) as Error & { status?: number; statusText?: string };
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = 'message'; // Default event type

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;
              onMessage(currentEvent, data);
            } catch (e) {
              log.warn('Failed to parse SSE data', {
                dataStr: dataStr.substring(0, 100),
                error: (e as Error).message,
              });
            }
          }
        }
      }
      if (typeof onComplete === 'function') {
        onComplete();
      }
    } catch (error) {
      const err = error as Error & {
        status?: number | null;
        response?: { status?: number };
      };
      if (err && typeof err.status === 'undefined') {
        const statusValue = err.response?.status;
        err.status = statusValue !== undefined ? statusValue : null;
      }

      if (!this._isAbortError(err)) {
        log.error('Streaming fetch error', err);
      }
      onError(err);
    }
  }

  /**
   * Optimize with automatic fallback to legacy API if streaming fails
   */
  async optimizeWithFallback(
    options: OptimizeWithStreamingOptions
  ): Promise<OptimizeWithStreamingResult> {
    let streamingError: Error | null = null;
    const { onError, signal, ...streamingOptions } = options;
    const onRefined = options.onRefined;

    if (signal?.aborted) {
      const aborted = new DOMException('Request aborted', 'AbortError');
      if (typeof onError === 'function') {
        onError(aborted);
      }
      throw aborted;
    }

    try {
      // Try streaming first
      return await this.optimizeWithStreaming({
        ...streamingOptions,
        ...(signal ? { signal } : {}),
        onError: (error) => {
          streamingError = error;
        },
      });
    } catch (error) {
      if (this._isAbortError(error)) {
        if (typeof onError === 'function') {
          onError(error as Error);
        }
        throw error;
      }
      streamingError = error as Error;
      log.warn('Streaming failed, falling back to legacy API', {
        promptLength: options.prompt?.length || 0,
        error: (error as Error).message,
      });

      if (this._shouldUseOfflineFallback(error)) {
        return this._handleOfflineFallback(options, error);
      }
    }

    const { prompt, mode, targetModel, context, brainstormContext, generationParams, skipCache, lockedSpans } = options;

    try {
      // Fallback to single-stage API
      const result = await this.optimizeLegacy({
        prompt,
        mode,
        ...(targetModel ? { targetModel } : {}),
        context,
        brainstormContext,
        ...(generationParams ? { generationParams } : {}),
        ...(skipCache ? { skipCache } : {}),
        ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
        ...(signal ? { signal } : {}),
      });

      // Format as two-stage result
      const optimized = result.optimizedPrompt;
      if (typeof onRefined === 'function' && !signal?.aborted) {
        onRefined(optimized, { ...(result.metadata || {}), usedFallback: true });
      }
      return {
        draft: optimized,
        refined: optimized,
        spans: [],
        metadata: { usedFallback: true, ...result.metadata },
        usedFallback: true,
      };
    } catch (legacyError) {
      if (
        this._shouldUseOfflineFallback(legacyError) ||
        this._shouldUseOfflineFallback(streamingError)
      ) {
        return this._handleOfflineFallback(options, legacyError);
      }

      if (typeof onError === 'function') {
        onError(legacyError as Error);
      }
      throw legacyError;
    }
  }

  /**
   * Get quality score for a prompt (same as V1)
   */
  calculateQualityScore(inputPrompt: string, outputPrompt: string): number {
    let score = 0;
    const inputWords = inputPrompt.split(/\s+/).length;
    const outputWords = outputPrompt.split(/\s+/).length;

    // Length improvement
    if (outputWords > inputWords * 2) score += 25;
    else if (outputWords > inputWords) score += 15;

    // Structure (sections with headers)
    const sections = (outputPrompt.match(/\*\*/g) || []).length / 2;
    score += Math.min(sections * 10, 30);

    // Key components
    if (outputPrompt.includes('Goal')) score += 15;
    if (
      outputPrompt.includes('Return Format') ||
      outputPrompt.includes('Research')
    )
      score += 15;
    if (outputPrompt.includes('Context') || outputPrompt.includes('Learning'))
      score += 15;

    return Math.min(score, 100);
  }

  private _handleOfflineFallback(
    options: OptimizeWithStreamingOptions,
    error: unknown
  ): OptimizeWithStreamingResult {
    const offlineResult = this._buildOfflineResult(options, error);
    this._emitOfflineCallbacks(offlineResult, options);
    return offlineResult;
  }

  private _emitOfflineCallbacks(
    result: OfflineResult,
    {
      onDraft,
      onSpans,
      onRefined,
    }: {
      onDraft?: ((draft: string) => void) | null;
      onSpans?: ((spans: unknown[], source: string, meta?: unknown) => void) | null;
      onRefined?: ((refined: string, metadata?: Record<string, unknown>) => void) | null;
    }
  ): void {
    if (typeof onDraft === 'function') {
      onDraft(result.draft);
    }

    if (typeof onSpans === 'function') {
      onSpans([], 'offline-fallback', result.metadata);
    }

    if (typeof onRefined === 'function') {
      onRefined(result.refined, result.metadata);
    }
  }

  private _shouldUseOfflineFallback(error: unknown): boolean {
    if (!error) {
      return false;
    }

    const err = error as Error & {
      status?: number;
      response?: { status?: number };
    };

    const status =
      err.status ??
      err?.response?.status ??
      (err instanceof ApiError ? err.status : null);
    if (status === 401 || status === 403) {
      return true;
    }

    const message = (err.message || '').toLowerCase();
    return (
      message.includes('401') ||
      message.includes('unauthorized') ||
      message.includes('permission')
    );
  }

  private _isAbortError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const err = error as { name?: string; code?: string };
    return err.name === 'AbortError' || err.code === 'ABORT_ERR';
  }

  private _buildOfflineResult(
    { prompt, mode }: OptimizeOptions,
    error: unknown
  ): OfflineResult {
    const trimmedPrompt = (prompt || '').trim();
    const normalizedMode = mode ? mode.replace(/-/g, ' ') : 'optimize';

    const baselineSuggestions = [
      'Clarify the intended audience and the desired tone.',
      'Specify any formatting or length requirements for the response.',
      'Add relevant context, constraints, or examples that the model should follow.',
    ];

    const suggestionList = baselineSuggestions.map((tip) => `- ${tip}`).join('\n');

    const draft = [
      `✨ Offline Prompt Assistant (${normalizedMode})`,
      '',
      trimmedPrompt
        ? `Original prompt:\n${trimmedPrompt}`
        : 'No original prompt was provided.',
      '',
      'Quick tips to strengthen your prompt:',
      suggestionList,
    ].join('\n');

    const refined = [
      draft,
      '',
      'This locally generated guidance is shown because the live optimization API could not be reached (401 Unauthorized).',
      'Update your API credentials or start the backend service to restore real-time optimizations.',
    ].join('\n');

    const err = error as Error | null;
    const metadata = {
      usedFallback: true,
      offline: true,
      reason: 'unauthorized',
      errorMessage: err?.message || null,
    };

    return {
      draft,
      refined,
      spans: [],
      metadata,
      usedFallback: true,
    };
  }
}

// Export singleton instance
import { apiClient } from './ApiClient';
export const promptOptimizationApiV2 = new PromptOptimizationApi(apiClient);
