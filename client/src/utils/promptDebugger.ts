/**
 * Prompt Debugger - Stub implementation
 *
 * The original implementation has been removed as part of the migration to LLM-only highlighting.
 * This stub maintains API compatibility for components that depend on it.
 */

interface PromptState {
  inputPrompt?: string;
  optimizedPrompt?: string;
  displayedPrompt?: string;
  selectedMode?: string;
}

interface PromptCapture {
  timestamp: string;
  inputPrompt: string;
  optimizedPrompt: string;
  displayedPrompt: string;
  selectedMode: string;
  highlights: unknown[];
  suggestions: unknown[];
}

interface PromptDebugger {
  captureFullPromptData: (
    state: PromptState,
    fetchSuggestionsForHighlight: unknown
  ) => Promise<PromptCapture>;
  printReport: (capture: PromptCapture) => void;
  exportToFile: () => void;
  exportAllCaptures: () => void;
  lastCapture: PromptCapture | null;
}

export const promptDebugger: PromptDebugger = {
  /**
   * Capture full prompt data (stub - returns minimal data)
   */
  async captureFullPromptData(state: PromptState): Promise<PromptCapture> {
    return {
      timestamp: new Date().toISOString(),
      inputPrompt: state.inputPrompt || '',
      optimizedPrompt: state.optimizedPrompt || '',
      displayedPrompt: state.displayedPrompt || '',
      selectedMode: state.selectedMode || 'video',
      highlights: [],
      suggestions: [],
    };
  },

  /**
   * Print report (stub - no-op)
   */
  printReport(): void {
    // No-op: debugging functionality removed
  },

  /**
   * Export to file (stub - no-op)
   */
  exportToFile(): void {
    // No-op: debugging functionality removed
  },

  /**
   * Export all captures (stub - no-op)
   */
  exportAllCaptures(): void {
    // No-op: debugging functionality removed
  },

  /**
   * Last capture (stub - returns null)
   */
  lastCapture: null,
};

export default promptDebugger;

