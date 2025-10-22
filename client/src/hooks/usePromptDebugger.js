/**
 * Hook to integrate prompt debugger into the application
 *
 * Usage in PromptOptimizerContainer.jsx:
 *
 * import { usePromptDebugger } from '../hooks/usePromptDebugger';
 *
 * const { capturePromptData, isCapturing } = usePromptDebugger({
 *   inputPrompt: promptOptimizer.inputPrompt,
 *   displayedPrompt: promptOptimizer.displayedPrompt,
 *   optimizedPrompt: promptOptimizer.optimizedPrompt,
 *   selectedMode,
 *   promptContext
 * });
 *
 * // Then call capturePromptData() to capture all data
 */

import { useState, useCallback } from 'react';
import { promptDebugger } from '../utils/promptDebugger';

export function usePromptDebugger(state) {
  const [isCapturing, setIsCapturing] = useState(false);

  /**
   * Fetch suggestions for a specific highlight
   */
  const fetchSuggestionsForHighlight = useCallback(async (highlight) => {
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
          'X-API-Key': 'dev-key-12345',
        },
        body: JSON.stringify({
          highlightedText: highlight.text,
          contextBefore,
          contextAfter,
          fullPrompt,
          originalUserPrompt: state.inputPrompt,
          brainstormContext: state.promptContext?.toJSON ? state.promptContext.toJSON() : state.promptContext,
          highlightedCategory: highlight.category,
          highlightedCategoryConfidence: highlight.confidence,
          highlightedPhrase: highlight.text,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error(`Error fetching suggestions for "${highlight.text}":`, error);
      throw error;
    }
  }, [state]);

  /**
   * Capture all prompt data including highlights and suggestions
   */
  const capturePromptData = useCallback(async () => {
    setIsCapturing(true);

    try {
      const capture = await promptDebugger.captureFullPromptData(
        state,
        fetchSuggestionsForHighlight
      );

      // Automatically print report to console
      promptDebugger.printReport(capture);

      return capture;
    } catch (error) {
      console.error('Error capturing prompt data:', error);
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
    debugger: promptDebugger
  };
}

export default usePromptDebugger;
