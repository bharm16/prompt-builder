import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  promptSchema,
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
  creativeSuggestionSchema,
  generateQuestionsSchema,
  compatibilitySchema,
  completeSceneSchema,
  variationsSchema,
  parseConceptSchema,
  refinementsSchema,
  conflictsSchema,
  technicalParamsSchema,
  validatePromptSchema,
  smartDefaultsSchema,
  saveTemplateSchema,
  templateRecommendationsSchema,
  recordUserChoiceSchema,
  alternativePhrasingsSchema,
} from '../utils/validation.js';

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
    creativeSuggestionEnhancedService, // Add enhanced service
  } = services;

  // POST /api/optimize - Optimize prompt
  router.post(
    '/optimize',
    validateRequest(promptSchema),
    asyncHandler(async (req, res) => {
      const { prompt, mode, context, brainstormContext } = req.body;

      const optimizedPrompt = await promptOptimizationService.optimize({
        prompt,
        mode,
        context,
        brainstormContext, // Pass brainstorm context to service
      });

      res.json({ optimizedPrompt });
    })
  );

  // POST /api/generate-questions - Generate context questions
  router.post(
    '/generate-questions',
    validateRequest(generateQuestionsSchema),
    asyncHandler(async (req, res) => {
      const { prompt } = req.body;

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
        brainstormContext,
      } = req.body;

      const result = await enhancementService.getEnhancementSuggestions({
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
        originalUserPrompt,
        brainstormContext,
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

  // POST /api/check-compatibility - Check element compatibility
  router.post(
    '/check-compatibility',
    validateRequest(compatibilitySchema),
    asyncHandler(async (req, res) => {
      const { elementType, value, existingElements } = req.body;

      const result = await creativeSuggestionEnhancedService.checkCompatibility({
        elementType,
        value,
        existingElements,
      });

      res.json(result);
    })
  );

  // POST /api/complete-scene - Complete scene with AI suggestions
  router.post(
    '/complete-scene',
    validateRequest(completeSceneSchema),
    asyncHandler(async (req, res) => {
      const { existingElements, concept } = req.body;

      const result = await creativeSuggestionEnhancedService.completeScene({
        existingElements,
        concept,
      });

      res.json(result);
    })
  );

  // POST /api/generate-variations - Generate scene variations
  router.post(
    '/generate-variations',
    validateRequest(variationsSchema),
    asyncHandler(async (req, res) => {
      const { elements, concept } = req.body;

      const result = await creativeSuggestionEnhancedService.generateVariations({
        elements,
        concept,
      });

      res.json(result);
    })
  );

  // POST /api/parse-concept - Parse concept into elements
  router.post(
    '/parse-concept',
    validateRequest(parseConceptSchema),
    asyncHandler(async (req, res) => {
      const { concept } = req.body;

      const result = await creativeSuggestionEnhancedService.parseConcept({
        concept,
      });

      res.json(result);
    })
  );

  // POST /api/get-refinements - Get refinement suggestions
  router.post(
    '/get-refinements',
    validateRequest(refinementsSchema),
    asyncHandler(async (req, res) => {
      const { elements } = req.body;

      const result = await creativeSuggestionEnhancedService.getRefinementSuggestions({
        elements,
      });

      res.json(result);
    })
  );

  // POST /api/detect-conflicts - Detect element conflicts
  router.post(
    '/detect-conflicts',
    validateRequest(conflictsSchema),
    asyncHandler(async (req, res) => {
      const { elements } = req.body;

      const result = await creativeSuggestionEnhancedService.detectConflicts({
        elements,
      });

      res.json(result);
    })
  );

  // POST /api/generate-technical-params - Generate technical parameters
  router.post(
    '/generate-technical-params',
    validateRequest(technicalParamsSchema),
    asyncHandler(async (req, res) => {
      const { elements } = req.body;

      const result = await creativeSuggestionEnhancedService.generateTechnicalParams({
        elements,
      });

      res.json(result);
    })
  );

  // POST /api/validate-prompt - Validate prompt quality
  router.post(
    '/validate-prompt',
    validateRequest(validatePromptSchema),
    asyncHandler(async (req, res) => {
      const { elements, concept } = req.body;

      const result = await creativeSuggestionEnhancedService.validatePrompt({
        elements,
        concept,
      });

      res.json(result);
    })
  );

  // POST /api/get-smart-defaults - Get smart defaults for element
  router.post(
    '/get-smart-defaults',
    validateRequest(smartDefaultsSchema),
    asyncHandler(async (req, res) => {
      const { elementType, existingElements } = req.body;

      const result = await creativeSuggestionEnhancedService.getSmartDefaults({
        elementType,
        existingElements,
      });

      res.json(result);
    })
  );

  // POST /api/save-template - Save element template
  router.post(
    '/save-template',
    validateRequest(saveTemplateSchema),
    asyncHandler(async (req, res) => {
      const { name, elements, concept, userId } = req.body;

      const result = await creativeSuggestionEnhancedService.saveTemplate({
        name,
        elements,
        concept,
        userId,
      });

      res.json(result);
    })
  );

  // POST /api/get-template-recommendations - Get template recommendations
  router.post(
    '/get-template-recommendations',
    validateRequest(templateRecommendationsSchema),
    asyncHandler(async (req, res) => {
      const { userId, currentElements } = req.body;

      const result = await creativeSuggestionEnhancedService.getTemplateRecommendations({
        userId,
        currentElements,
      });

      res.json(result);
    })
  );

  // POST /api/record-user-choice - Record user element choice
  router.post(
    '/record-user-choice',
    validateRequest(recordUserChoiceSchema),
    asyncHandler(async (req, res) => {
      const { elementType, chosen, rejected, userId } = req.body;

      const result = await creativeSuggestionService.recordUserChoice({
        elementType,
        chosen,
        rejected,
        userId,
      });

      res.json(result);
    })
  );

  // POST /api/get-alternative-phrasings - Get alternative phrasings
  router.post(
    '/get-alternative-phrasings',
    validateRequest(alternativePhrasingsSchema),
    asyncHandler(async (req, res) => {
      const { elementType, value } = req.body;

      const result = await creativeSuggestionEnhancedService.getAlternativePhrasings({
        elementType,
        value,
      });

      res.json(result);
    })
  );

  return router;
}
