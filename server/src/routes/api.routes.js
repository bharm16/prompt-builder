import express from 'express';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { PerformanceMonitor } from '../middleware/performanceMonitor.js';
import {
  promptSchema,
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
  creativeSuggestionSchema,
  completeSceneSchema,
  variationsSchema,
  parseConceptSchema,
  videoValidationSchema,
  semanticParseSchema,
} from '../utils/validation.js';
import { extractSemanticSpans } from '../services/nlp/NlpSpanService.js';

/**
 * Create API routes
 * @param {Object} services - Service instances
 * @returns {Router} Express router
 */
export function createAPIRoutes(services) {
  const router = express.Router();

  const {
    promptOptimizationService,
    enhancementService,
    sceneDetectionService,
    videoConceptService,
    textCategorizerService,
    metricsService,
  } = services;

  // Initialize performance monitor
  const perfMonitor = new PerformanceMonitor(metricsService);

  // POST /api/optimize - Optimize prompt (single-stage, backward compatible)
  router.post(
    '/optimize',
    validateRequest(promptSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const operation = 'optimize';
      
      const { prompt, mode, context, brainstormContext } = req.body;

      logger.info('Optimize request received', {
        operation,
        requestId,
        promptLength: prompt?.length || 0,
        mode,
        hasContext: !!context,
        hasBrainstormContext: !!brainstormContext,
      });

      try {
        const optimizedPrompt = await promptOptimizationService.optimize({
          prompt,
          mode,
          context,
          brainstormContext, // Pass brainstorm context to service
        });

        logger.info('Optimize request completed', {
          operation,
          requestId,
          duration: Date.now() - startTime,
          inputLength: prompt?.length || 0,
          outputLength: optimizedPrompt?.length || 0,
        });

        res.json({ optimizedPrompt });
      } catch (error) {
        logger.error('Optimize request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          promptLength: prompt?.length || 0,
        });
        throw error;
      }
    })
  );

  // POST /api/optimize-stream - Two-stage optimization with streaming
  // Streams draft first, then refined version
  router.post(
    '/optimize-stream',
    validateRequest(promptSchema),
    asyncHandler(async (req, res) => {
      const { prompt, mode, context, brainstormContext } = req.body;

      // Set up Server-Sent Events (SSE) headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Helper to send SSE message
      const sendEvent = (eventType, data) => {
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const operation = 'optimize-stream';

      logger.info('Optimize-stream request received', {
        operation,
        requestId,
        promptLength: prompt?.length || 0,
        mode,
        hasContext: !!context,
        hasBrainstormContext: !!brainstormContext,
      });

      try {
        // Start two-stage optimization with parallel span labeling
        const result = await promptOptimizationService.optimizeTwoStage({
          prompt,
          mode,
          context,
          brainstormContext,
          // Stream draft AND spans to client immediately when ready
          onDraft: (draft, spans) => {
            // Send draft text
            sendEvent('draft', {
              draft,
              status: 'draft_ready',
              timestamp: Date.now(),
            });

            // Send spans immediately if available (parallel execution)
            if (spans) {
              sendEvent('spans', {
                spans: spans.spans || [],
                meta: spans.meta || null,
                source: 'draft',
                timestamp: Date.now(),
              });
            }
          },
        });

        // Send refined version when complete
        sendEvent('refined', {
          refined: result.refined,
          status: 'complete',
          metadata: result.metadata,
          timestamp: Date.now(),
        });

        // Send updated spans for refined text if available
        if (result.refinedSpans) {
          sendEvent('spans', {
            spans: result.refinedSpans.spans || [],
            meta: result.refinedSpans.meta || null,
            source: 'refined',
            timestamp: Date.now(),
          });
        }

        // Send completion signal
        sendEvent('done', {
          status: 'finished',
          usedFallback: result.usedFallback || false,
        });

        logger.info('Optimize-stream request completed', {
          operation,
          requestId,
          duration: Date.now() - startTime,
          usedFallback: result.usedFallback || false,
        });

        res.end();
      } catch (error) {
        logger.error('Optimize-stream request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          promptLength: prompt?.length || 0,
        });

        sendEvent('error', {
          error: error.message,
          status: 'failed',
        });

        res.end();
      }
    })
  );

  // New consolidated video concept endpoints
  router.post(
    '/video/suggestions',
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
      } catch (error) {
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

  router.post(
    '/video/validate',
    validateRequest(videoValidationSchema),
    asyncHandler(async (req, res) => {
      const { elementType, value, elements } = req.body;

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

      res.json({
        compatibility,
        conflicts: conflictResult?.conflicts || [],
      });
    })
  );

  router.post(
    '/video/complete',
    validateRequest(completeSceneSchema),
    asyncHandler(async (req, res) => {
      const { existingElements, concept, smartDefaultsFor } = req.body;
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

      res.json({
        suggestions: completion.suggestions,
        smartDefaults,
      });
    })
  );

  router.post(
    '/video/variations',
    validateRequest(variationsSchema),
    asyncHandler(async (req, res) => {
      const { elements, concept } = req.body;
      const variations = await videoConceptService.generateVariations({
        elements,
        concept,
      });
      res.json(variations);
    })
  );

  router.post(
    '/video/parse',
    validateRequest(parseConceptSchema),
    asyncHandler(async (req, res) => {
      const { concept } = req.body;
      const parsed = await videoConceptService.parseConcept({ concept });
      res.json(parsed);
    })
  );

  router.post(
    '/video/semantic-parse',
    validateRequest(semanticParseSchema),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const operation = 'semantic-parse';
      
      const { text } = req.body;

      logger.info('Semantic parse request received', {
        operation,
        requestId,
        textLength: text?.length || 0,
      });

      try {
        const spans = await textCategorizerService.parseText({ text });
        
        logger.info('Semantic parse request completed', {
          operation,
          requestId,
          duration: Date.now() - startTime,
          spanCount: spans?.length || 0,
        });

        res.json({ spans });
      } catch (error) {
        logger.error('Semantic parse request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
          textLength: text?.length || 0,
        });
        res.status(error.statusCode || 500).json({
          error: 'Categorization failed',
          message: 'Unable to parse text into semantic spans',
        });
      }
    })
  );

  // POST /api/get-enhancement-suggestions - Get enhancement suggestions
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
        allLabeledSpans, // Complete span composition
        nearbySpans, // Proximate context
        editHistory, // NEW: Edit history for consistency
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

      // Track service call timing
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
          allLabeledSpans, // Pass to service
          nearbySpans, // Pass to service
          editHistory, // NEW: Pass to service
        });

        // Track metadata
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
      } catch (error) {
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

  // POST /api/get-custom-suggestions - Get custom suggestions
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
      } catch (error) {
        logger.error('Custom suggestions request failed', error, {
          operation,
          requestId,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    })
  );

  // POST /api/detect-scene-change - Detect scene changes
  router.post(
    '/detect-scene-change',
    validateRequest(sceneChangeSchema),
    asyncHandler(async (req, res) => {
      const {
        changedField,
        newValue,
        oldValue,
        fullPrompt,
        affectedFields,
        sectionHeading,
        sectionContext,
      } =
        req.body;

      const result = await sceneDetectionService.detectSceneChange({
        changedField,
        newValue,
        oldValue,
        fullPrompt,
        affectedFields,
        sectionHeading,
        sectionContext,
      });

      res.json(result);
    })
  );

  // GET /api/test-nlp - Test NLP pipeline
  router.get(
    '/test-nlp',
    asyncHandler(async (req, res) => {
      const { prompt } = req.query;
      if (!prompt) {
        return res.status(400).json({ error: 'prompt query parameter is required' });
      }
      const result = await extractSemanticSpans(prompt);
      res.json(result);
    })
  );


  return router;
}
