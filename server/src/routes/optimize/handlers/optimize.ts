import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import type { PromptOptimizationServiceContract } from '../types';

export const createOptimizeHandler = (
  promptOptimizationService: PromptOptimizationServiceContract
) =>
  async (req: Request, res: Response): Promise<Response | void> => {
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
      startImage,
      constraintMode,
    } = req.body;

    const { normalizedGenerationParams, error } = normalizeGenerationParams({
      generationParams,
      targetModel,
      operation,
      requestId,
      userId,
    });
    if (error) {
      return res.status(error.status).json({ error: error.error, details: error.details });
    }

    logger.info('Optimize request received', {
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
      hasStartImage: typeof startImage === 'string' && startImage.length > 0,
      constraintMode,
    });

    try {
      const result = await promptOptimizationService.optimize({
        prompt,
        mode,
        targetModel,
        context,
        brainstormContext,
        generationParams: normalizedGenerationParams,
        skipCache,
        lockedSpans,
        startImage,
        constraintMode,
      });

      logger.info('Optimize request completed', {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        inputLength: prompt?.length || 0,
        outputLength: result.prompt?.length || 0,
      });

      return res.json({
        prompt: result.prompt,
        optimizedPrompt: result.prompt,
        inputMode: result.inputMode,
        ...(result.i2v ? { i2v: result.i2v } : {}),
        ...(result.metadata ? { metadata: result.metadata } : {}),
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
