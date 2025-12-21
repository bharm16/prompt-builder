import express, { type Router } from 'express';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';
import { validateRequest } from '@middleware/validateRequest';
import { PerformanceMonitor } from '@middleware/performanceMonitor';
import {
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
} from '@utils/validation';
import { extractSemanticSpans } from '@llm/span-labeling/nlp/NlpSpanService';

interface EnhancementServices {
  enhancementService: any;
  sceneDetectionService: any;
  metricsService?: any;
}

/**
 * Create enhancement routes
 * Handles enhancement suggestions, custom suggestions, scene detection, and NLP testing
 */
export function createEnhancementRoutes(services: EnhancementServices): Router {
  const router = express.Router();
  const { enhancementService, sceneDetectionService, metricsService } = services;

  const perfMonitor = new PerformanceMonitor(metricsService);

  // POST /get-enhancement-suggestions - Get enhancement suggestions
  router.post(
    '/get-enhancement-suggestions',
    perfMonitor.trackRequest.bind(perfMonitor),
    validateRequest(suggestionSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const operation = 'get-enhancement-suggestions';
      
      const {
        highlightedText,
        contextBefore,
        contextAfter,
        fullPrompt,
        originalUserPrompt,
        brainstormContext,
        highlightedCategory,
        highlightedCategoryConfidence,
        highlightedPhrase,
        allLabeledSpans,
        nearbySpans,
        editHistory,
      } = req.body;

      logger.info('Enhancement suggestions request received', {
        operation,
        requestId,
        highlightedTextLength: highlightedText?.length || 0,
        fullPromptLength: fullPrompt?.length || 0,
        highlightedCategory,
        highlightedCategoryConfidence,
        hasBrainstormContext: !!brainstormContext,
        spanCount: allLabeledSpans?.length || 0,
      });

      if (req.perfMonitor) {
        req.perfMonitor.start('service_call');
      }

      try {
        const result = await enhancementService.getEnhancementSuggestions({
          highlightedText,
          contextBefore,
          contextAfter,
          fullPrompt,
          originalUserPrompt,
          brainstormContext,
          highlightedCategory,
          highlightedCategoryConfidence,
          highlightedPhrase,
          allLabeledSpans,
          nearbySpans,
          editHistory,
        });

        if (req.perfMonitor) {
          req.perfMonitor.end('service_call');
          req.perfMonitor.addMetadata('cacheHit', result.fromCache || false);
          req.perfMonitor.addMetadata('suggestionCount', result.suggestions?.length || 0);
          req.perfMonitor.addMetadata('category', highlightedCategory || 'unknown');
        }

        logger.info('Enhancement suggestions request completed', {
          operation,
          requestId,
          duration: Date.now() - startTime,
          suggestionCount: result.suggestions?.length || 0,
          fromCache: result.fromCache || false,
          category: highlightedCategory,
        });

        res.json(result);
      } catch (error: any) {
        logger.error('Enhancement suggestions request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          highlightedCategory,
        });
        throw error;
      }
    })
  );

  // POST /get-custom-suggestions - Get custom suggestions
  router.post(
    '/get-custom-suggestions',
    validateRequest(customSuggestionSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const operation = 'get-custom-suggestions';
      
      const { highlightedText, customRequest, fullPrompt } = req.body;

      logger.info('Custom suggestions request received', {
        operation,
        requestId,
        highlightedTextLength: highlightedText?.length || 0,
        customRequestLength: customRequest?.length || 0,
        fullPromptLength: fullPrompt?.length || 0,
      });

      try {
        const result = await enhancementService.getCustomSuggestions({
          highlightedText,
          customRequest,
          fullPrompt,
        });

        logger.info('Custom suggestions request completed', {
          operation,
          requestId,
          duration: Date.now() - startTime,
          suggestionCount: result.suggestions?.length || 0,
        });

        res.json(result);
      } catch (error: any) {
        logger.error('Custom suggestions request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    })
  );

  // POST /detect-scene-change - Detect scene changes
  router.post(
    '/detect-scene-change',
    validateRequest(sceneChangeSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const operation = 'detect-scene-change';
      
      const {
        changedField,
        newValue,
        oldValue,
        fullPrompt,
        affectedFields,
        sectionHeading,
        sectionContext,
      } = req.body;

      logger.info('Scene change detection request received', {
        operation,
        requestId,
        changedField,
        hasNewValue: !!newValue,
        hasOldValue: !!oldValue,
        affectedFieldCount: affectedFields?.length || 0,
      });

      try {
        const result = await sceneDetectionService.detectSceneChange({
          changedField,
          newValue,
          oldValue,
          fullPrompt,
          affectedFields,
          sectionHeading,
          sectionContext,
        });

        logger.info('Scene change detection request completed', {
          operation,
          requestId,
          duration: Date.now() - startTime,
          isSceneChange: result?.isSceneChange || false,
        });

        res.json(result);
      } catch (error: any) {
        logger.error('Scene change detection request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          changedField,
        });
        throw error;
      }
    })
  );

  // GET /test-nlp - Test NLP pipeline
  router.get(
    '/test-nlp',
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const operation = 'test-nlp';
      
      const { prompt } = req.query;
      const promptValue = Array.isArray(prompt) ? prompt[0] : prompt;

      logger.debug('NLP test request received', {
        operation,
        requestId,
        hasPrompt: !!prompt,
      });

      if (typeof promptValue !== 'string' || promptValue.trim().length === 0) {
        logger.warn('NLP test request missing prompt parameter', {
          operation,
          requestId,
        });
        return res.status(400).json({ error: 'prompt query parameter is required' });
      }

      try {
        const result = await extractSemanticSpans(promptValue);

        logger.info('NLP test request completed', {
          operation,
          requestId,
          duration: Date.now() - startTime,
          spanCount: result?.spans?.length || 0,
        });

        return res.json(result);
      } catch (error: any) {
        logger.error('NLP test request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          promptLength: promptValue.length,
        });
        throw error;
      }
    })
  );

  return router;
}
