import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import { createSseChannel } from '@routes/optimize/sse';
import type { PromptOptimizationServiceContract } from '../types';

export const createOptimizeStreamHandler = (
  promptOptimizationService: PromptOptimizationServiceContract
) =>
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.id || 'unknown';
    const userId = extractUserId(req);
    const operation = 'optimize-stream';

    const {
      prompt,
      mode,
      targetModel,
      context,
      brainstormContext,
      generationParams,
      skipCache,
      lockedSpans,
    } = req.body;

    const { normalizedGenerationParams, error } = normalizeGenerationParams({
      generationParams,
      targetModel,
      operation,
      requestId,
      userId,
    });
    if (error) {
      res.status(error.status).json({ error: error.error, details: error.details });
      return;
    }

    const { signal, sendEvent, markProcessingStarted, close } = createSseChannel(req, res);

    const startTime = Date.now();

    logger.info('Optimize-stream request received', {
      operation,
      requestId,
      userId,
      promptLength: prompt?.length || 0,
      mode,
      targetModel,
      hasContext: !!context,
      hasBrainstormContext: !!brainstormContext,
      generationParamCount: generationParams ? Object.keys(generationParams).length : 0,
      skipCache: !!skipCache,
      lockedSpanCount: Array.isArray(lockedSpans) ? lockedSpans.length : 0,
    });

    try {
      markProcessingStarted();

      const result = await promptOptimizationService.optimizeTwoStage({
        prompt,
        mode,
        targetModel,
        context,
        brainstormContext,
        generationParams: normalizedGenerationParams,
        skipCache,
        lockedSpans,
        signal,
        onDraftChunk: (delta: string): void => {
          if (!delta) {
            return;
          }
          sendEvent('draft_delta', {
            delta,
            timestamp: Date.now(),
          });
        },
        onRefinedChunk: (delta: string): void => {
          if (!delta) {
            return;
          }
          sendEvent('refined_delta', {
            delta,
            timestamp: Date.now(),
          });
        },
        onDraft: (
          draft: string,
          spans: { spans?: unknown[]; meta?: unknown } | null
        ): void => {
          sendEvent('draft', {
            draft,
            status: 'draft_ready',
            timestamp: Date.now(),
          });

          if (spans) {
            sendEvent('spans', {
              spans: spans.spans || [],
              meta: spans.meta || null,
              source: 'draft',
              timestamp: Date.now(),
            });
          }
        },
      });

      sendEvent('refined', {
        refined: result.refined,
        status: 'complete',
        metadata: result.metadata,
        timestamp: Date.now(),
      });

      if (result.refinedSpans) {
        sendEvent('spans', {
          spans: result.refinedSpans.spans || [],
          meta: result.refinedSpans.meta || null,
          source: 'refined',
          timestamp: Date.now(),
        });
      }

      sendEvent('done', {
        status: 'finished',
        usedFallback: result.usedFallback || false,
      });

      logger.info('Optimize-stream request completed', {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        usedFallback: result.usedFallback || false,
      });

      close();
    } catch (error: unknown) {
      if (signal.aborted || res.writableEnded) {
        close();
        return;
      }

      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Optimize-stream request failed', errorInstance, {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        promptLength: prompt?.length || 0,
      });

      sendEvent('error', {
        error: errorInstance.message,
        status: 'failed',
      });

      close();
    }
  };
