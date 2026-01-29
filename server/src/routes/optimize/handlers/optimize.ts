import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import { normalizeGenerationParams } from '@routes/optimize/normalizeGenerationParams';
import type { PromptOptimizationServiceContract } from '../types';
import { promptSchema } from '@config/schemas/promptSchemas';

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

    const { normalizedGenerationParams, error } = normalizeGenerationParams({
      generationParams,
      targetModel,
      operation,
      requestId,
      userId,
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
        sourcePrompt,
      });

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
