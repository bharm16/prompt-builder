import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { VideoConceptServiceContract } from '../types';

export const createVideoVariationsHandler = (
  videoConceptService: VideoConceptServiceContract
) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const startTime = Date.now();
    const requestId = req.id || 'unknown';
    const operation = 'video-variations';

    const { elements, concept } = req.body;

    logger.info('Video variations request received', {
      operation,
      requestId,
      elementCount: elements?.length || 0,
      hasConcept: !!concept,
    });

    try {
      const variations = await videoConceptService.generateVariations({
        elements,
        concept,
      });

      logger.info('Video variations request completed', {
        operation,
        requestId,
        duration: Date.now() - startTime,
        variationCount: variations?.variations?.length || 0,
      });

      return res.json(variations);
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Video variations request failed', errorInstance, {
        operation,
        requestId,
        duration: Date.now() - startTime,
        elementCount: elements?.length || 0,
      });
      throw error;
    }
  };
