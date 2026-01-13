import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { VideoConceptServiceContract } from '../types';

export const createVideoCompleteHandler = (
  videoConceptService: VideoConceptServiceContract
) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const startTime = Date.now();
    const requestId = req.id || 'unknown';
    const operation = 'video-complete';

    const { existingElements, concept, smartDefaultsFor } = req.body;

    logger.info('Video complete request received', {
      operation,
      requestId,
      elementCount: existingElements?.length || 0,
      hasConcept: !!concept,
      smartDefaultsFor,
    });

    try {
      const completion = await videoConceptService.completeScene({
        existingElements,
        concept,
      });

      let smartDefaults = null;
      if (smartDefaultsFor) {
        smartDefaults = await videoConceptService.getSmartDefaults({
          elementType: smartDefaultsFor,
          existingElements: completion.suggestions,
        });
      }

      logger.info('Video complete request completed', {
        operation,
        requestId,
        duration: Date.now() - startTime,
        suggestionCount: completion.suggestions?.length || 0,
        hasSmartDefaults: !!smartDefaults,
      });

      return res.json({
        suggestions: completion.suggestions,
        smartDefaults,
      });
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Video complete request failed', errorInstance, {
        operation,
        requestId,
        duration: Date.now() - startTime,
        elementCount: existingElements?.length || 0,
      });
      throw error;
    }
  };
