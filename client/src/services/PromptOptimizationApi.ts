/**
 * PromptOptimizationApi - Enhanced API Service with Two-Stage Streaming
 *
 * Supports Server-Sent Events (SSE) for real-time draft and refinement updates
 * Provides fast perceived performance (~300ms to draft, full refinement in background)
 */

import { ApiClient } from './ApiClient';
import { logger } from './LoggingService';
import { calculateQualityScore as scorePromptQuality } from './prompt-optimization/qualityScore';
import {
  buildOfflineResult,
  handleOfflineFallback,
  isAbortError,
  shouldUseOfflineFallback,
} from './prompt-optimization/offlineFallback';
import { streamWithFetch } from './prompt-optimization/streamWithFetch';
import type {
  OptimizeOptions,
  OptimizeResult,
  OptimizeWithStreamingOptions,
  OptimizeWithStreamingResult,
} from './prompt-optimization/types';

const log = logger.child('PromptOptimizationApi');

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
      if (shouldUseOfflineFallback(error)) {
        const offline = buildOfflineResult(
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
      const streamLog = {
        warn: (message: string, meta?: Record<string, unknown>) => log.warn(message, meta),
        error: (message: string, error?: Error) => {
          if (!isAbortError(error)) {
            log.error(message, error);
          }
        },
      };

      streamWithFetch(
        {
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
      },
      { log: streamLog }
    );
    });
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
      if (isAbortError(error)) {
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

      if (shouldUseOfflineFallback(error)) {
        return handleOfflineFallback(options, error);
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
        shouldUseOfflineFallback(legacyError) ||
        shouldUseOfflineFallback(streamingError)
      ) {
        return handleOfflineFallback(options, legacyError);
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
    return scorePromptQuality(inputPrompt, outputPrompt);
  }
}

// Export singleton instance
import { apiClient } from './ApiClient';
export const promptOptimizationApiV2 = new PromptOptimizationApi(apiClient);
