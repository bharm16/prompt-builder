/**
 * Prompt Debugger - Captures prompt data and AI suggestions for troubleshooting
 *
 * Usage:
 * 1. Import in PromptOptimizerContainer.jsx
 * 2. Call debugger.captureFullPromptData() to capture all data
 * 3. Call debugger.exportToFile() to download JSON file
 * 4. Or access debugger.lastCapture to view in console
 */

import { extractVideoPromptPhrases } from '../features/prompt-optimizer/phraseExtractor';

class PromptDebugger {
  constructor() {
    this.captures = [];
    this.lastCapture = null;
  }

  /**
   * Capture all prompt data including highlights and suggestions
   * @param {Object} state - Application state
   * @param {Function} fetchSuggestions - Function to fetch suggestions for a highlight
   * @returns {Promise<Object>} Captured data
   */
  async captureFullPromptData(state, fetchSuggestions) {
    console.log('🔍 Starting prompt capture...');

    const capture = {
      timestamp: new Date().toISOString(),
      captureId: `capture-${Date.now()}`,

      // Original prompt
      originalPrompt: state.inputPrompt || '',

      // Displayed/optimized prompt
      displayedPrompt: state.displayedPrompt || state.optimizedPrompt || '',

      // Mode
      mode: state.selectedMode || 'video',

      // Context from Creative Brainstorm
      context: state.promptContext?.toJSON() || null,

      // Extract highlights
      highlights: [],

      // Suggestions for each highlight
      highlightSuggestions: []
    };

    // Extract all highlights from the displayed prompt
    if (capture.displayedPrompt) {
      try {
        const phrases = extractVideoPromptPhrases(
          capture.displayedPrompt,
          state.promptContext
        );

        capture.highlights = phrases.map((phrase, index) => ({
          index,
          text: phrase.text,
          category: phrase.category,
          confidence: phrase.confidence,
          source: phrase.source,
          color: phrase.color,
          originalValue: phrase.originalValue
        }));

        console.log(`✅ Found ${capture.highlights.length} highlights`);
      } catch (error) {
        console.error('❌ Error extracting highlights:', error);
        capture.highlights = [];
      }
    }

    // Fetch suggestions for each highlight
    if (fetchSuggestions && capture.highlights.length > 0) {
      console.log(`🔄 Fetching suggestions for ${capture.highlights.length} highlights...`);

      for (let i = 0; i < capture.highlights.length; i++) {
        const highlight = capture.highlights[i];
        console.log(`  📝 [${i + 1}/${capture.highlights.length}] Fetching suggestions for: "${highlight.text}"`);

        try {
          // Fetch suggestions for this highlight
          const suggestions = await fetchSuggestions(highlight);

          capture.highlightSuggestions.push({
            highlightIndex: i,
            highlightText: highlight.text,
            category: highlight.category,
            suggestionsCount: suggestions?.length || 0,
            suggestions: suggestions || [],
            fetchedAt: new Date().toISOString()
          });

          console.log(`    ✅ Got ${suggestions?.length || 0} suggestions`);

          // Small delay to avoid rate limiting
          if (i < capture.highlights.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`    ❌ Error fetching suggestions for "${highlight.text}":`, error);
          capture.highlightSuggestions.push({
            highlightIndex: i,
            highlightText: highlight.text,
            category: highlight.category,
            error: error.message,
            fetchedAt: new Date().toISOString()
          });
        }
      }
    }

    // Store capture
    this.lastCapture = capture;
    this.captures.push(capture);

    console.log('✅ Capture complete!');
    console.log('📊 Summary:');
    console.log(`  - Original prompt: ${capture.originalPrompt.substring(0, 50)}...`);
    console.log(`  - Highlights: ${capture.highlights.length}`);
    console.log(`  - Suggestions captured: ${capture.highlightSuggestions.length}`);
    console.log('');
    console.log('💾 Access the data:');
    console.log('  - window.promptDebugger.lastCapture');
    console.log('  - window.promptDebugger.exportToFile()');
    console.log('  - window.promptDebugger.printReport()');

    return capture;
  }

  /**
   * Export captured data to JSON file
   * @param {Object} capture - Specific capture to export (defaults to last)
   */
  exportToFile(capture = null) {
    const data = capture || this.lastCapture;

    if (!data) {
      console.warn('⚠️  No capture data to export');
      return;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-debug-${data.captureId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ Exported: prompt-debug-${data.captureId}.json`);
  }

  /**
   * Export all captures to JSON file
   */
  exportAllCaptures() {
    if (this.captures.length === 0) {
      console.warn('⚠️  No captures to export');
      return;
    }

    const json = JSON.stringify(this.captures, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-debug-all-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ Exported ${this.captures.length} captures`);
  }

  /**
   * Print a formatted report to console
   * @param {Object} capture - Specific capture to print (defaults to last)
   */
  printReport(capture = null) {
    const data = capture || this.lastCapture;

    if (!data) {
      console.warn('⚠️  No capture data to print');
      return;
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 PROMPT DEBUG REPORT');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Capture ID: ${data.captureId}`);
    console.log(`Timestamp: ${data.timestamp}`);
    console.log(`Mode: ${data.mode}`);
    console.log('');

    console.log('───────────────────────────────────────────────────────');
    console.log('📝 ORIGINAL PROMPT');
    console.log('───────────────────────────────────────────────────────');
    console.log(data.originalPrompt);
    console.log('');

    if (data.displayedPrompt !== data.originalPrompt) {
      console.log('───────────────────────────────────────────────────────');
      console.log('✨ DISPLAYED/OPTIMIZED PROMPT');
      console.log('───────────────────────────────────────────────────────');
      console.log(data.displayedPrompt);
      console.log('');
    }

    if (data.context) {
      console.log('───────────────────────────────────────────────────────');
      console.log('🎨 CREATIVE BRAINSTORM CONTEXT');
      console.log('───────────────────────────────────────────────────────');
      Object.entries(data.context.elements || {}).forEach(([key, value]) => {
        if (value) {
          console.log(`  ${key}: ${value}`);
        }
      });
      console.log('');
    }

    console.log('───────────────────────────────────────────────────────');
    console.log(`🎯 HIGHLIGHTS (${data.highlights.length})`);
    console.log('───────────────────────────────────────────────────────');
    data.highlights.forEach((h, i) => {
      console.log(`\n[${i}] "${h.text}"`);
      console.log(`    Category: ${h.category}`);
      console.log(`    Confidence: ${(h.confidence * 100).toFixed(0)}%`);
      console.log(`    Source: ${h.source}`);
      if (h.originalValue) {
        console.log(`    Original Value: ${h.originalValue}`);
      }
    });
    console.log('');

    console.log('───────────────────────────────────────────────────────');
    console.log(`💡 SUGGESTIONS (${data.highlightSuggestions.length})`);
    console.log('───────────────────────────────────────────────────────');
    data.highlightSuggestions.forEach((s, i) => {
      console.log(`\n[${s.highlightIndex}] "${s.highlightText}" (${s.category})`);

      if (s.error) {
        console.log(`    ❌ Error: ${s.error}`);
      } else if (s.suggestions && s.suggestions.length > 0) {
        console.log(`    ✅ ${s.suggestionsCount} suggestions:`);
        s.suggestions.forEach((suggestion, idx) => {
          console.log(`\n    ${idx + 1}. "${suggestion.text}"`);
          if (suggestion.explanation) {
            console.log(`       ${suggestion.explanation}`);
          }
          if (suggestion.category) {
            console.log(`       Category: ${suggestion.category}`);
          }
          if (suggestion.compatibility !== undefined) {
            console.log(`       Compatibility: ${(suggestion.compatibility * 100).toFixed(0)}%`);
          }
        });
      } else {
        console.log(`    ℹ️  No suggestions received`);
      }
    });

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('End of Report');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n');
  }

  /**
   * Clear all captures
   */
  clearCaptures() {
    this.captures = [];
    this.lastCapture = null;
    console.log('✅ Cleared all captures');
  }

  /**
   * Get summary of all captures
   */
  getSummary() {
    return {
      totalCaptures: this.captures.length,
      captures: this.captures.map(c => ({
        captureId: c.captureId,
        timestamp: c.timestamp,
        highlightsCount: c.highlights.length,
        suggestionsCount: c.highlightSuggestions.length
      }))
    };
  }
}

// Create singleton instance
export const promptDebugger = new PromptDebugger();

// Make it globally accessible for console debugging
if (typeof window !== 'undefined') {
  window.promptDebugger = promptDebugger;
}

export default promptDebugger;
