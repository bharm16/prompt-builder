import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  promptSchema,
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
  creativeSuggestionSchema,
} from '../../utils/validation.js';

/**
 * Create API routes
 * @param {Object} services - Service instances
 * @returns {Router} Express router
 */
export function createAPIRoutes(services) {
  const router = express.Router();

  const {
    promptOptimizationService,
    questionGenerationService,
    enhancementService,
    sceneDetectionService,
    creativeSuggestionService,
  } = services;

  // POST /api/optimize - Optimize prompt
  router.post(
    '/optimize',
    validateRequest(promptSchema),
    asyncHandler(async (req, res) => {
      const { prompt, mode, context } = req.body;

      const optimizedPrompt = await promptOptimizationService.optimize({
        prompt,
        mode,
        context,
      });

      res.json({ optimizedPrompt });
    })
  );

  // POST /api/generate-questions - Generate context questions
  router.post(
    '/generate-questions',
    asyncHandler(async (req, res) => {
      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const questions = await questionGenerationService.generateQuestions(
        prompt
      );

      res.json(questions);
    })
  );

  // POST /api/get-enhancement-suggestions - Get enhancement suggestions
  router.post(
    '/get-enhancement-suggestions',
    validateRequest(suggestionSchema),
    asyncHandler(async (req, res) => {
      const {
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
        originalUserPrompt,
      } = req.body;

      const result = await enhancementService.getEnhancementSuggestions({
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
        originalUserPrompt,
      });

      res.json(result);
    })
  );

  // POST /api/get-custom-suggestions - Get custom suggestions
  router.post(
    '/get-custom-suggestions',
    validateRequest(customSuggestionSchema),
    asyncHandler(async (req, res) => {
      const { highlightedText, customRequest, fullPrompt } = req.body;

      const result = await enhancementService.getCustomSuggestions({
        highlightedText,
        customRequest,
        fullPrompt,
      });

      res.json(result);
    })
  );

  // POST /api/detect-scene-change - Detect scene changes
  router.post(
    '/detect-scene-change',
    validateRequest(sceneChangeSchema),
    asyncHandler(async (req, res) => {
      const { changedField, newValue, oldValue, fullPrompt, affectedFields } =
        req.body;

      const result = await sceneDetectionService.detectSceneChange({
        changedField,
        newValue,
        oldValue,
        fullPrompt,
        affectedFields,
      });

      res.json(result);
    })
  );

  // POST /api/get-creative-suggestions - Get creative suggestions
  router.post(
    '/get-creative-suggestions',
    validateRequest(creativeSuggestionSchema),
    asyncHandler(async (req, res) => {
      const { elementType, currentValue, context, concept } = req.body;

      const result = await creativeSuggestionService.getCreativeSuggestions({
        elementType,
        currentValue,
        context,
        concept,
      });

      res.json(result);
    })
  );

  return router;
}
