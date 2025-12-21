import express, { type Router } from 'express';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';
import { validateRequest } from '@middleware/validateRequest';
import { extractUserId } from '@utils/requestHelpers';
import { promptSchema } from '@utils/validation';

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
    validateRequest(promptSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const userId = extractUserId(req);
      const operation = 'optimize';
      
      const { prompt, mode, context, brainstormContext } = req.body;

      logger.info('Optimize request received', {
        operation,
        requestId,
        userId,
        promptLength: prompt?.length || 0,
        mode,
        hasContext: !!context,
        hasBrainstormContext: !!brainstormContext,
      });

      try {
        let metadata: Record<string, unknown> | null = null;
        const optimizedPrompt = await promptOptimizationService.optimize({
          prompt,
          mode,
          context,
          brainstormContext,
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
    validateRequest(promptSchema),
    asyncHandler(async (req, res) => {
      const { prompt, mode, context, brainstormContext } = req.body;
      const abortController = new AbortController();
      const { signal } = abortController;
      const onAbort = (): void => {
        if (!signal.aborted) {
          abortController.abort();
        }
      };
      req.on('close', onAbort);
      req.on('aborted', onAbort);

      // Set up Server-Sent Events (SSE) headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const sendEvent = (eventType: string, data: unknown): void => {
        if (signal.aborted || res.writableEnded) {
          return;
        }
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const userId = extractUserId(req);
      const operation = 'optimize-stream';

      logger.info('Optimize-stream request received', {
        operation,
        requestId,
        userId,
        promptLength: prompt?.length || 0,
        mode,
        hasContext: !!context,
        hasBrainstormContext: !!brainstormContext,
      });

      try {
        const result = await promptOptimizationService.optimizeTwoStage({
          prompt,
          mode,
          context,
          brainstormContext,
          signal,
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

        res.end();
      } catch (error: any) {
        if (signal.aborted || res.writableEnded) {
          res.end();
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

        res.end();
      }
    })
  );

  return router;
}
