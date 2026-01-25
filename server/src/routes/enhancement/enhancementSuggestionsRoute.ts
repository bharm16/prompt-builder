import type { Router } from 'express';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '@middleware/asyncHandler';
import { validateRequest } from '@middleware/validateRequest';
import { PerformanceMonitor } from '@middleware/performanceMonitor';
import { suggestionSchema } from '@utils/validation';
import { countSuggestions } from './utils';

interface EnhancementSuggestionsResult {
  suggestions?: unknown[];
  fromCache?: boolean;
  [key: string]: unknown;
}

interface EnhancementSuggestionsDeps {
  enhancementService: {
    getEnhancementSuggestions: (payload: Record<string, unknown>) => Promise<EnhancementSuggestionsResult>;
  };
  perfMonitor: PerformanceMonitor;
}

export function registerEnhancementSuggestionsRoute(
  router: Router,
  { enhancementService, perfMonitor }: EnhancementSuggestionsDeps
): void {
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

        const suggestionCount = countSuggestions(result.suggestions);

        if (req.perfMonitor) {
          req.perfMonitor.end('service_call');
          req.perfMonitor.addMetadata('cacheHit', result.fromCache || false);
          req.perfMonitor.addMetadata('suggestionCount', suggestionCount);
          req.perfMonitor.addMetadata(
            'category',
            highlightedCategory || 'unknown'
          );
        }

        logger.info('Enhancement suggestions request completed', {
          operation,
          requestId,
          duration: Date.now() - startTime,
          suggestionCount,
          fromCache: result.fromCache || false,
          category: highlightedCategory,
        });

        res.json(result);
      } catch (error) {
        logger.error('Enhancement suggestions request failed', error instanceof Error ? error : new Error(String(error)), {
          operation,
          requestId,
          duration: Date.now() - startTime,
          highlightedCategory,
        });
        throw error;
      }
    })
  );
}
