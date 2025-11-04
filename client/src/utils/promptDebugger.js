/**
 * Prompt Debugger - Stub implementation
 *
 * The original implementation has been removed as part of the migration to LLM-only highlighting.
 * This stub maintains API compatibility for components that depend on it.
 */

export const promptDebugger = {
  /**
   * Capture full prompt data (stub - returns minimal data)
   */
  async captureFullPromptData(state, fetchSuggestionsForHighlight) {
    return {
      timestamp: new Date().toISOString(),
      inputPrompt: state.inputPrompt || '',
      optimizedPrompt: state.optimizedPrompt || '',
      displayedPrompt: state.displayedPrompt || '',
      selectedMode: state.selectedMode || 'video',
      highlights: [],
      suggestions: []
    };
  },

  /**
   * Print report (stub - no-op)
   */
  printReport(capture) {
    // No-op: debugging functionality removed
  },

  /**
   * Export to file (stub - no-op)
   */
  exportToFile() {
    // No-op: debugging functionality removed
  },

  /**
   * Export all captures (stub - no-op)
   */
  exportAllCaptures() {
    // No-op: debugging functionality removed
  },

  /**
   * Last capture (stub - returns null)
   */
  lastCapture: null
};

export default promptDebugger;
