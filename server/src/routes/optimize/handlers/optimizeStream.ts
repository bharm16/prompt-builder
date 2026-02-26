import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import { createSseChannel } from '@routes/optimize/sse';
import type { PromptOptimizationServiceContract } from '../types';
import { promptSchema } from '@config/schemas/promptSchemas';
import { normalizeContext, normalizeLockedSpans, normalizeTargetModel } from './requestNormalization';

export const createOptimizeStreamHandler = (
  promptOptimizationService: PromptOptimizationServiceContract
) =>
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.id || 'unknown';
    const userId = extractUserId(req);
    const operation = 'optimize-stream';

    const parsed = promptSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('Optimize-stream request validation failed', {
        operation,
        requestId,
        userId,
        issues: parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const {
      prompt,
      mode,
      targetModel,
      context,
      brainstormContext,
      generationParams,
      skipCache,
      lockedSpans,
      startImage,
    } = parsed.data;
    const normalizedTargetModel = normalizeTargetModel(targetModel);
    const normalizedContext = normalizeContext(context);
    const normalizedLockedSpans = normalizeLockedSpans(lockedSpans);

    if (typeof startImage === 'string' && startImage.trim().length > 0) {
      res.status(400).json({
        success: false,
        error: 'Streaming optimization does not support image-to-video. Use /api/optimize.',
      });
      return;
    }

    const { normalizedGenerationParams, error } = normalizeGenerationParams({
      generationParams,
      operation,
      requestId,
      ...(normalizedTargetModel ? { targetModel: normalizedTargetModel } : {}),
      ...(userId ? { userId } : {}),
    });
    if (error) {
      res.status(error.status).json({
        success: false,
        error: error.error,
        details: error.details,
      });
      return;
    }

    const { signal: channelSignal, sendEvent, markProcessingStarted, close } = createSseChannel(req, res);

    const STREAM_TIMEOUT_MS = 120_000;
    const timeoutSignal = AbortSignal.timeout(STREAM_TIMEOUT_MS);
    const signal = AbortSignal.any([channelSignal, timeoutSignal]);

    const startTime = Date.now();

    logger.info('Optimize-stream request received', {
      operation,
      requestId,
      userId,
      promptLength: prompt?.length || 0,
      mode,
      targetModel: normalizedTargetModel,
      hasContext: !!normalizedContext,
      hasBrainstormContext: !!brainstormContext,
      generationParamCount: generationParams ? Object.keys(generationParams).length : 0,
      skipCache: !!skipCache,
      lockedSpanCount: normalizedLockedSpans.length,
    });

    try {
      markProcessingStarted();

      const optimizeRequest = {
        prompt,
        mode,
        context: normalizedContext,
        brainstormContext: brainstormContext ?? null,
        generationParams: normalizedGenerationParams,
        skipCache,
        lockedSpans: normalizedLockedSpans,
        signal,
        ...(normalizedTargetModel ? { targetModel: normalizedTargetModel } : {}),
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
      };
      const result = await promptOptimizationService.optimizeTwoStage(optimizeRequest);

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
      if (timeoutSignal.aborted && !res.writableEnded) {
        logger.warn('Optimize-stream timed out', {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
          timeoutMs: STREAM_TIMEOUT_MS,
        });
        sendEvent('error', {
          error: 'Stream timeout exceeded',
          status: 'timeout',
        });
        close();
        return;
      }

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
