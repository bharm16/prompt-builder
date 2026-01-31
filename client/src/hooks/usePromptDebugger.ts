import { useState, useCallback } from 'react';
import { promptDebugger } from '../utils/promptDebugger';
import { logger } from '../services/LoggingService';
import { fetchHighlightSuggestions } from './usePromptDebuggerApi';
import { buildHighlightSuggestionPayload } from './usePromptDebuggerUtils';
import type { PromptDebuggerState, Highlight } from './types';

interface UsePromptDebuggerResult {
  capturePromptData: () => ReturnType<typeof promptDebugger.captureFullPromptData>;
  exportToFile: () => void;
  exportAllCaptures: () => void;
  isCapturing: boolean;
  lastCapture: typeof promptDebugger.lastCapture;
  debugger: typeof promptDebugger;
}

export function usePromptDebugger(state: PromptDebuggerState): UsePromptDebuggerResult {
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
        const payload = buildHighlightSuggestionPayload(state, highlight);
        const suggestions = await fetchHighlightSuggestions(payload);
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
