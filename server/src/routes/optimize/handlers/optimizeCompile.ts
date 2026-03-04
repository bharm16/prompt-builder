import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import type { PromptOptimizationServiceContract } from '../types';
import { compileSchema } from '@config/schemas/promptSchemas';
import { normalizeTargetModel } from './requestNormalization';

export const createOptimizeCompileHandler = (
  promptOptimizationService: PromptOptimizationServiceContract
) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const startTime = Date.now();
    const requestId = req.id || 'unknown';
    const userId = extractUserId(req);
    const operation = 'optimize-compile';

    const parsed = compileSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('Optimize-compile request validation failed', {
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

    const { prompt, targetModel, context } = parsed.data;
    const normalizedTargetModel = normalizeTargetModel(targetModel) ?? targetModel;
    if (targetModel.trim().toLowerCase() !== normalizedTargetModel) {
      logger.warn('Deprecated targetModel alias normalized', {
        operation,
        requestId,
        userId,
        requestedTargetModel: targetModel,
        normalizedTargetModel,
      });
    }

    logger.info('Optimize-compile request received', {
      operation,
      requestId,
      userId,
      promptLength: prompt?.length || 0,
      targetModel: normalizedTargetModel,
      hasContext: !!context,
    });

    try {
      const result = await promptOptimizationService.compilePrompt({
        prompt,
        targetModel: normalizedTargetModel,
        context,
      });

      if (res.headersSent || res.writableEnded) {
        logger.warn('Optimize-compile completed after response already closed; skipping payload write', {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
        });
        return;
      }

      logger.info('Optimize-compile request completed', {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        outputLength: result.compiledPrompt?.length || 0,
        targetModel: result.targetModel,
      });

      const responseMetadata = {
        ...(result.metadata || {}),
        normalizedModelId: result.targetModel,
        intentLockPassed:
          typeof result.metadata?.intentLockPassed === 'boolean'
            ? result.metadata.intentLockPassed
            : true,
      };

      const responsePayload = {
        compiledPrompt: result.compiledPrompt,
        metadata: responseMetadata,
        ...(result.targetModel ? { targetModel: result.targetModel } : {}),
      };

      return res.json({
        success: true,
        data: responsePayload,
        ...responsePayload,
      });
    } catch (error: unknown) {
      if (res.headersSent || res.writableEnded) {
        logger.warn('Optimize-compile failed after response already closed; suppressing rethrow', {
          operation,
          requestId,
          userId,
          duration: Date.now() - startTime,
        });
        return;
      }

      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Optimize-compile request failed', errorInstance, {
        operation,
        requestId,
        userId,
        duration: Date.now() - startTime,
        promptLength: prompt?.length || 0,
        targetModel: normalizedTargetModel,
      });
      throw error;
    }
  };
