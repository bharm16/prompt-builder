import express, { type Router } from 'express';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';
import { validateRequest } from '@middleware/validateRequest';
import { PerformanceMonitor } from '@middleware/performanceMonitor';
import { extractUserId } from '@utils/requestHelpers';
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
} from '@utils/validation';
import { extractSemanticSpans } from '@llm/span-labeling/nlp/NlpSpanService';

interface ApiServices {
  promptOptimizationService: any;
  enhancementService: any;
  sceneDetectionService: any;
  videoConceptService: any;
  metricsService?: any;
}

/**
 * Create API routes
 * @param {Object} services - Service instances
 * @returns {Router} Express router
 */
export function createAPIRoutes(services: ApiServices): Router {
  const router = express.Router();

  const {
    promptOptimizationService,
    enhancementService,
    sceneDetectionService,
    videoConceptService,
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
      const userId = extractUserId(req);
      const operation = 'optimize';
      
      const { prompt, mode, context, brainstormContext } = req.body;

      logger.info('Optimize request received', {
        operation,
        requestId,
        userId,
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
          userId,
          duration: Date.now() - startTime,
          inputLength: prompt?.length || 0,
          outputLength: optimizedPrompt?.length || 0,
        });

        res.json({ optimizedPrompt });
      } catch (error: any) {
        logger.error('Optimize request failed', error, {
          operation,
          requestId,
          userId,
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
      const abortController = new AbortController();
      const { signal } = abortController;
      const onAbort = (): void => {
        if (!signal.aborted) {
          abortController.abort();
        }
      };
      req.on('close', onAbort);
      req.on('aborted', onAbort);

      // Set up Server-Sent Events (SSE) headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Helper to send SSE message
      const sendEvent = (eventType: string, data: unknown): void => {
        if (signal.aborted || res.writableEnded) {
          return;
        }
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const startTime = Date.now();
      const requestId = req.id || 'unknown';
      const userId = extractUserId(req);
      const operation = 'optimize-stream';

      logger.info('Optimize-stream request received', {
        operation,
        requestId,
        userId,
        promptLength: prompt?.length || 0,
        mode,
        hasContext: !!context,
        hasBrainstormContext: !!brainstormContext,
      });

      try {
        // Start two-stage optimization (streaming draft + refined)
        const result = await promptOptimizationService.optimizeTwoStage({
          prompt,
          mode,
          context,
          brainstormContext,
          signal,
          // Stream draft (and spans if provided) to client immediately when ready
          onDraft: (
            draft: string,
            spans: { spans?: unknown[]; meta?: unknown } | null
          ): void => {
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
          userId,
          duration: Date.now() - startTime,
          usedFallback: result.usedFallback || false,
        });

        res.end();
      } catch (error: any) {
        if (signal.aborted || res.writableEnded) {
          res.end();
          return;
        }
        logger.error('Optimize-stream request failed', error, {
          operation,
          requestId,
          userId,
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
      const userId = extractUserId(req);
      const operation = 'video-suggestions';
      
      const { elementType, currentValue, context, concept } = req.body;

      logger.info('Video suggestions request received', {
        operation,
        requestId,
        userId,
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
          userId,
          duration: Date.now() - startTime,
          suggestionCount: result.suggestions?.length || 0,
        });

        res.json(result);
      } catch (error: any) {
        logger.error('Video suggestions request failed', error, {
          operation,
          requestId,
          userId,
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

  router.post(
    '/video/complete',
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

  router.post(
    '/video/variations',
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

  router.post(
    '/video/parse',
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

  // POST /api/detect-scene-change - Detect scene changes
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
      } =
        req.body;

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

  // GET /api/test-nlp - Test NLP pipeline
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
