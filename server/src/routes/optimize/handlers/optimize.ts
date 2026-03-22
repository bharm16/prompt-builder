import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import type { PromptOptimizationServiceContract } from '../types';
import { promptSchema } from '@config/schemas/promptSchemas';
// Response wire format defined in shared/schemas/optimization.schemas.ts —
// client validates against OptimizeResponseSchema at the fetch boundary.
import { normalizeContext, normalizeLockedSpans, normalizeTargetModel } from './requestNormalization';

export const createOptimizeHandler = (
  promptOptimizationService: PromptOptimizationServiceContract
) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const startTime = Date.now();
    const requestId = req.id || 'unknown';
    const userId = extractUserId(req);
    const operation = 'optimize';

    const parsed = promptSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('Optimize request validation failed', {
        operation,
        requestId,
        userId,
        issues: parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: parsed.error.issues,
      });
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
      constraintMode,
	      sourcePrompt,
	    } = parsed.data;
	    const normalizedTargetModel = normalizeTargetModel(targetModel);
	    const normalizedContext = normalizeContext(context);
	    const normalizedLockedSpans = normalizeLockedSpans(lockedSpans);
      if (
        typeof targetModel === 'string' &&
        normalizedTargetModel &&
        targetModel.trim().toLowerCase() !== normalizedTargetModel
      ) {
        logger.warn('Deprecated targetModel alias normalized', {
          operation,
          requestId,
          userId,
          requestedTargetModel: targetModel,
          normalizedTargetModel,
        });
      }

	    const { normalizedGenerationParams, error } = normalizeGenerationParams({
	      generationParams,
	      operation,
	      requestId,
	      ...(normalizedTargetModel ? { targetModel: normalizedTargetModel } : {}),
	      ...(userId ? { userId } : {}),
	    });
    if (error) {
      return res
        .status(error.status)
        .json({ success: false, error: error.error, details: error.details });
    }

    logger.info('Optimize request received', {
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
	      hasStartImage: typeof startImage === 'string' && startImage.length > 0,
	      constraintMode,
	    });

    const requestAbortController = new AbortController();
    const abortInFlight = (): void => {
      if (!requestAbortController.signal.aborted) {
        requestAbortController.abort();
      }
    };

    req.once('aborted', abortInFlight);
    req.once('close', abortInFlight);
    res.once('close', abortInFlight);
    res.once('finish', abortInFlight);

    try {
	      const optimizeRequest = {
	        prompt,
	        mode,
	        context: normalizedContext,
	        brainstormContext: brainstormContext ?? null,
	        generationParams: normalizedGenerationParams,
	        skipCache,
	        lockedSpans: normalizedLockedSpans,
	        ...(normalizedTargetModel ? { targetModel: normalizedTargetModel } : {}),
	        ...(typeof startImage === 'string' && startImage.length > 0 ? { startImage } : {}),
	        ...(constraintMode !== undefined ? { constraintMode } : {}),
	        ...(typeof sourcePrompt === 'string' && sourcePrompt.length > 0
	          ? { sourcePrompt }
	          : {}),
          signal: requestAbortController.signal,
	      };
	      const result = await promptOptimizationService.optimize(optimizeRequest);

      if (res.headersSent || res.writableEnded) {
        logger.warn('Optimize request completed after response already closed; skipping payload write', {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
        });
        return;
      }

      logger.info('Optimize request completed', {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        inputLength: prompt?.length || 0,
        outputLength: result.prompt?.length || 0,
      });

      const responseMetadata = {
        ...(result.metadata || {}),
        ...(normalizedTargetModel ? { normalizedModelId: normalizedTargetModel } : {}),
        intentLockPassed:
          typeof result.metadata?.intentLockPassed === 'boolean'
            ? result.metadata.intentLockPassed
            : true,
      };

      const responsePayload = {
        prompt: result.prompt,
        optimizedPrompt: result.prompt,
        inputMode: result.inputMode,
        ...(result.artifactKey ? { artifactKey: result.artifactKey } : {}),
        ...(result.compilation ? { compilation: result.compilation } : {}),
        ...(result.i2v ? { i2v: result.i2v } : {}),
        metadata: responseMetadata,
      };

      res.setHeader('X-Response-Version', '2');
      return res.json({
        success: true,
        // DEPRECATED: `data` envelope duplicates top-level fields.
        // Clients should read top-level fields directly (prompt, metadata, etc.).
        // This wrapper will be removed in a future version.
        data: responsePayload,
        ...responsePayload,
      });
    } catch (error: unknown) {
      if (res.headersSent || res.writableEnded) {
        logger.warn('Optimize request failed after response already closed; suppressing rethrow', {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
        });
        return;
      }

      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Optimize request failed', errorInstance, {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        promptLength: prompt?.length || 0,
      });
	      throw error;
	    } finally {
      req.removeListener('aborted', abortInFlight);
      req.removeListener('close', abortInFlight);
      res.removeListener('close', abortInFlight);
      res.removeListener('finish', abortInFlight);
    }
  };
