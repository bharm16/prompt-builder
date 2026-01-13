import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import type { PromptOptimizationServiceContract } from '../types';

export const createOptimizeCompileHandler = (
  promptOptimizationService: PromptOptimizationServiceContract
) =>
  async (req: Request, res: Response): Promise<Response | void> => {
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

      return res.json({
        compiledPrompt: result.compiledPrompt,
        ...(result.metadata ? { metadata: result.metadata } : {}),
        ...(result.targetModel ? { targetModel: result.targetModel } : {}),
      });
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Optimize-compile request failed', errorInstance, {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        promptLength: prompt?.length || 0,
        targetModel,
      });
      throw error;
    }
  };
