import express, { type Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { validateRequest } from '@middleware/validateRequest';
import {
  creativeSuggestionSchema,
  completeSceneSchema,
  variationsSchema,
  parseConceptSchema,
  videoValidationSchema,
} from '@utils/validation';
import type { VideoServices } from './video/types';
import { createVideoSuggestionsHandler } from './video/handlers/suggestions';
import { createVideoValidateHandler } from './video/handlers/validate';
import { createVideoCompleteHandler } from './video/handlers/complete';
import { createVideoVariationsHandler } from './video/handlers/variations';
import { createVideoParseHandler } from './video/handlers/parse';

/**
 * Create video concept routes
 * Handles video suggestions, validation, completion, variations, and parsing
 */
export function createVideoRoutes(services: VideoServices): Router {
  const router = express.Router();
  const { videoConceptService } = services;

  const suggestionsHandler = createVideoSuggestionsHandler(videoConceptService);
  const validateHandler = createVideoValidateHandler(videoConceptService);
  const completeHandler = createVideoCompleteHandler(videoConceptService);
  const variationsHandler = createVideoVariationsHandler(videoConceptService);
  const parseHandler = createVideoParseHandler(videoConceptService);

  router.post(
    '/suggestions',
    validateRequest(creativeSuggestionSchema),
    asyncHandler(suggestionsHandler)
  );

  router.post(
    '/validate',
    validateRequest(videoValidationSchema),
    asyncHandler(validateHandler)
  );

  router.post(
    '/complete',
    validateRequest(completeSceneSchema),
    asyncHandler(completeHandler)
  );

  router.post(
    '/variations',
    validateRequest(variationsSchema),
    asyncHandler(variationsHandler)
  );

  router.post(
    '/parse',
    validateRequest(parseConceptSchema),
    asyncHandler(parseHandler)
  );

  return router;
}
