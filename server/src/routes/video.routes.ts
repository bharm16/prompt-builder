import express, { type Router } from 'express';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';
import { validateRequest } from '@middleware/validateRequest';
import {
  creativeSuggestionSchema,
  completeSceneSchema,
  variationsSchema,
  parseConceptSchema,
  videoValidationSchema,
} from '@utils/validation';

interface VideoServices {
  videoConceptService: any;
}

/**
 * Create video concept routes
 * Handles video suggestions, validation, completion, variations, and parsing
 */
export function createVideoRoutes(services: VideoServices): Router {
  const router = express.Router();
  const { videoConceptService } = services;

  // POST /suggestions - Get creative suggestions for video elements
  router.post(
    '/suggestions',
    validateRequest(creativeSuggestionSchema),
    asyncHandler(async (req, res) => {
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

        res.json(result);
      } catch (error: any) {
        logger.error('Video suggestions request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          elementType,
        });
        throw error;
      }
    })
  );

  // POST /validate - Validate video elements and detect conflicts
  router.post(
    '/validate',
    validateRequest(videoValidationSchema),
    asyncHandler(async (req, res) => {
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

        res.json({
          compatibility,
          conflicts: conflictResult?.conflicts || [],
        });
      } catch (error: any) {
        logger.error('Video validate request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          elementType,
        });
        throw error;
      }
    })
  );

  // POST /complete - Complete a scene with suggestions
  router.post(
    '/complete',
    validateRequest(completeSceneSchema),
    asyncHandler(async (req, res) => {
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

        res.json({
          suggestions: completion.suggestions,
          smartDefaults,
        });
      } catch (error: any) {
        logger.error('Video complete request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          elementCount: existingElements?.length || 0,
        });
        throw error;
      }
    })
  );

  // POST /variations - Generate variations of video elements
  router.post(
    '/variations',
    validateRequest(variationsSchema),
    asyncHandler(async (req, res) => {
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

        res.json(variations);
      } catch (error: any) {
        logger.error('Video variations request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          elementCount: elements?.length || 0,
        });
        throw error;
      }
    })
  );

  // POST /parse - Parse a concept into structured elements
  router.post(
    '/parse',
    validateRequest(parseConceptSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const operation = 'video-parse';
      
      const { concept } = req.body;

      logger.info('Video parse request received', {
        operation,
        requestId,
        conceptLength: concept?.length || 0,
      });

      try {
        const parsed = await videoConceptService.parseConcept({ concept });

        logger.info('Video parse request completed', {
          operation,
          requestId,
          duration: Date.now() - startTime,
          elementCount: parsed?.elements?.length || 0,
        });

        res.json(parsed);
      } catch (error: any) {
        logger.error('Video parse request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          conceptLength: concept?.length || 0,
        });
        throw error;
      }
    })
  );

  return router;
}
