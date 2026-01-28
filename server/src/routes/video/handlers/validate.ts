import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { VideoConceptServiceContract } from '../types';

export const createVideoValidateHandler = (
  videoConceptService: VideoConceptServiceContract
) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const startTime = Date.now();
    const requestId = req.id || 'unknown';
    const operation = 'video-validate';

    const { elementType, value, elements } = req.body;

    logger.info('Video validate request received', {
      operation,
      requestId,
      elementType,
      hasValue: typeof value !== 'undefined',
      elementCount: elements?.length || 0,
    });

    try {
      const compatibilityPromise =
        elementType && typeof value !== 'undefined'
          ? videoConceptService.checkCompatibility({
              elementType,
              value,
              existingElements: elements,
            })
          : Promise.resolve(null);

      const [compatibility, conflictResult] = await Promise.all([
        compatibilityPromise,
        videoConceptService.detectConflicts({ elements }),
      ]);

      logger.info('Video validate request completed', {
        operation,
        requestId,
        duration: Date.now() - startTime,
        hasCompatibility: !!compatibility,
        conflictCount: conflictResult?.conflicts?.length || 0,
      });

      return res.json({
        compatibility,
        conflicts: conflictResult?.conflicts || [],
      });
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Video validate request failed', errorInstance, {
        operation,
        requestId,
        duration: Date.now() - startTime,
        elementType,
      });
      throw error;
    }
  };
