import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { VideoConceptServiceContract } from '../types';

export const createVideoSuggestionsHandler = (
  videoConceptService: VideoConceptServiceContract
) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const startTime = Date.now();
    const requestId = req.id || 'unknown';
    const operation = 'video-suggestions';

    const { elementType, currentValue, context, concept } = req.body;

    logger.info('Video suggestions request received', {
      operation,
      requestId,
      elementType,
      hasCurrentValue: !!currentValue,
      hasContext: !!context,
      hasConcept: !!concept,
    });

    try {
      const result = await videoConceptService.getCreativeSuggestions({
        elementType,
        currentValue,
        context,
        concept,
      });

      logger.info('Video suggestions request completed', {
        operation,
        requestId,
        duration: Date.now() - startTime,
        suggestionCount: result.suggestions?.length || 0,
      });

      return res.json(result);
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Video suggestions request failed', errorInstance, {
        operation,
        requestId,
        duration: Date.now() - startTime,
        elementType,
      });
      throw error;
    }
  };
