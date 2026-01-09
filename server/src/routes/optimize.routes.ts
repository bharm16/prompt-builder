import express, { type Router } from 'express';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';
import { normalizeOptimizationRequest } from '@middleware/normalizeOptimizationRequest';
import { validateRequest } from '@middleware/validateRequest';
import { extractUserId } from '@utils/requestHelpers';
import { promptSchema, compileSchema } from '@utils/validation';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import { createSseChannel } from '@routes/optimize/sse';

interface OptimizeServices {
  promptOptimizationService: any;
}

/**
 * Create optimization routes
 * Handles prompt optimization (single-stage and streaming two-stage)
 */
export function createOptimizeRoutes(services: OptimizeServices): Router {
  const router = express.Router();
  const { promptOptimizationService } = services;

  // POST /optimize - Optimize prompt (single-stage, backward compatible)
  router.post(
    '/optimize',
    normalizeOptimizationRequest,
    validateRequest(promptSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const userId = extractUserId(req);
      const operation = 'optimize';
      
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

      logger.info('Optimize request received', {
        operation,
        requestId,
        userId,
        promptLength: prompt?.length || 0,
        mode,
        targetModel, // New
        hasContext: !!context,
        hasBrainstormContext: !!brainstormContext,
        generationParamCount: generationParams ? Object.keys(generationParams).length : 0,
        skipCache: !!skipCache,
        lockedSpanCount: Array.isArray(lockedSpans) ? lockedSpans.length : 0,
      });

      try {
        let metadata: Record<string, unknown> | null = null;
        const optimizedPrompt = await promptOptimizationService.optimize({
          prompt,
          mode,
          targetModel, // New
          context,
          brainstormContext,
          generationParams: normalizedGenerationParams,
          skipCache,
          lockedSpans,
          onMetadata: (next: Record<string, unknown>) => {
            metadata = { ...(metadata || {}), ...next };
          },
        });

        logger.info('Optimize request completed', {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
          inputLength: prompt?.length || 0,
          outputLength: optimizedPrompt?.length || 0,
        });

        res.json({
          optimizedPrompt,
          ...(metadata ? { metadata } : {}),
        });
      } catch (error: any) {
        logger.error('Optimize request failed', error, {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
          promptLength: prompt?.length || 0,
        });
        throw error;
      }
    })
  );

  // POST /optimize-stream - Two-stage optimization with streaming
  router.post(
    '/optimize-stream',
    normalizeOptimizationRequest,
    validateRequest(promptSchema),
    asyncHandler(async (req, res) => {
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
        targetModel, // New
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
          targetModel, // New
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
      } catch (error: any) {
        if (signal.aborted || res.writableEnded) {
          close();
          return;
        }
        logger.error('Optimize-stream request failed', error, {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
          promptLength: prompt?.length || 0,
        });

        sendEvent('error', {
          error: error.message,
          status: 'failed',
        });

        close();
      }
    })
  );

  // POST /optimize-compile - Compile a pre-optimized prompt for a target model (Stage 3 only)
  router.post(
    '/optimize-compile',
    validateRequest(compileSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const userId = extractUserId(req);
      const operation = 'optimize-compile';

      const { prompt, targetModel, context } = req.body;

      logger.info('Optimize-compile request received', {
        operation,
        requestId,
        userId,
        promptLength: prompt?.length || 0,
        targetModel,
        hasContext: !!context,
      });

      try {
        const result = await promptOptimizationService.compilePrompt({
          prompt,
          targetModel,
          context,
        });

        logger.info('Optimize-compile request completed', {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
          outputLength: result.compiledPrompt?.length || 0,
          targetModel: result.targetModel,
        });

        res.json({
          compiledPrompt: result.compiledPrompt,
          ...(result.metadata ? { metadata: result.metadata } : {}),
          ...(result.targetModel ? { targetModel: result.targetModel } : {}),
        });
      } catch (error: any) {
        logger.error('Optimize-compile request failed', error, {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
          promptLength: prompt?.length || 0,
          targetModel,
        });
        throw error;
      }
    })
  );

  return router;
}
