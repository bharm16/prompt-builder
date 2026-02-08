import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import type { PromptOptimizationServiceContract } from '../types';
import { promptSchema } from '@config/schemas/promptSchemas';
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
	      };
	      const result = await promptOptimizationService.optimize(optimizeRequest);

      logger.info('Optimize request completed', {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        inputLength: prompt?.length || 0,
        outputLength: result.prompt?.length || 0,
      });

      const responsePayload = {
        prompt: result.prompt,
        optimizedPrompt: result.prompt,
        inputMode: result.inputMode,
        ...(result.i2v ? { i2v: result.i2v } : {}),
        ...(result.metadata ? { metadata: result.metadata } : {}),
      };

      return res.json({
        success: true,
        data: responsePayload,
        ...responsePayload,
      });
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Optimize request failed', errorInstance, {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        promptLength: prompt?.length || 0,
      });
      throw error;
    }
  };
