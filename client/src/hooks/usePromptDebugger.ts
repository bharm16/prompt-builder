import { useState, useCallback } from 'react';
import { promptDebugger } from '../utils/promptDebugger';
import { API_CONFIG } from '../config/api.config';
import { logger } from '../services/LoggingService';
import type { PromptDebuggerState, Highlight } from './types';

export function usePromptDebugger(state: PromptDebuggerState) {
  const [isCapturing, setIsCapturing] = useState(false);

  /**
   * Fetch suggestions for a specific highlight
   */
  const fetchSuggestionsForHighlight = useCallback(
    async (highlight: Highlight): Promise<string[]> => {
      const startTime = performance.now();
      
      logger.debug('Fetching suggestions for highlight', {
        operation: 'fetchSuggestionsForHighlight',
        highlightText: highlight.text.substring(0, 50),
        highlightCategory: highlight.category,
      });
      logger.startTimer('fetchSuggestionsForHighlight');

      try {
        const fullPrompt = state.displayedPrompt || state.optimizedPrompt || state.inputPrompt;
        const highlightIndex = fullPrompt.indexOf(highlight.text);

        const contextBefore = fullPrompt
          .substring(Math.max(0, highlightIndex - 300), highlightIndex)
          .trim();
        const contextAfter = fullPrompt
          .substring(
            highlightIndex + highlight.text.length,
            Math.min(fullPrompt.length, highlightIndex + highlight.text.length + 300)
          )
          .trim();

        const response = await fetch('/api/get-enhancement-suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_CONFIG.apiKey,
          },
          body: JSON.stringify({
            highlightedText: highlight.text,
            contextBefore,
            contextAfter,
            fullPrompt,
            originalUserPrompt: state.inputPrompt,
            brainstormContext:
              state.promptContext && typeof state.promptContext === 'object' && 'toJSON' in state.promptContext
                ? (state.promptContext.toJSON as () => unknown)()
                : state.promptContext,
            highlightedCategory: highlight.category,
            highlightedCategoryConfidence: highlight.confidence,
            highlightedPhrase: highlight.text,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as { suggestions?: string[] };
        const suggestions = data.suggestions || [];
        const duration = logger.endTimer('fetchSuggestionsForHighlight');
        
        logger.info('Suggestions fetched successfully', {
          operation: 'fetchSuggestionsForHighlight',
          suggestionCount: suggestions.length,
          duration,
        });
        
        return suggestions;
      } catch (error) {
        logger.endTimer('fetchSuggestionsForHighlight');
        logger.error('Error fetching suggestions for highlight', error as Error, {
          hook: 'usePromptDebugger',
          operation: 'fetchSuggestionsForHighlight',
          highlightText: highlight.text,
          highlightCategory: highlight.category,
          duration: Math.round(performance.now() - startTime),
        });
        throw error;
      }
    },
    [state]
  );

  /**
   * Capture all prompt data including highlights and suggestions
   */
  const capturePromptData = useCallback(async () => {
    const startTime = performance.now();
    setIsCapturing(true);

    logger.debug('Starting prompt data capture', {
      operation: 'capturePromptData',
      highlightCount: state.highlights?.length || 0,
    });
    logger.startTimer('capturePromptData');

    try {
      const capture = await promptDebugger.captureFullPromptData(state, fetchSuggestionsForHighlight);

      // Automatically print report to console
      promptDebugger.printReport(capture);

      const duration = logger.endTimer('capturePromptData');
      logger.info('Prompt data captured successfully', {
        operation: 'capturePromptData',
        duration,
        captureSize: JSON.stringify(capture).length,
      });

      return capture;
    } catch (error) {
      logger.endTimer('capturePromptData');
      logger.error('Error capturing prompt data', error as Error, {
        hook: 'usePromptDebugger',
        operation: 'capturePromptData',
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    } finally {
      setIsCapturing(false);
    }
  }, [state, fetchSuggestionsForHighlight]);

  /**
   * Export the last capture to a file
   */
  const exportToFile = useCallback(() => {
    promptDebugger.exportToFile();
  }, []);

  /**
   * Export all captures to a file
   */
  const exportAllCaptures = useCallback(() => {
    promptDebugger.exportAllCaptures();
  }, []);

  return {
    capturePromptData,
    exportToFile,
    exportAllCaptures,
    isCapturing,
    lastCapture: promptDebugger.lastCapture,
    debugger: promptDebugger,
  };
}

export default usePromptDebugger;

