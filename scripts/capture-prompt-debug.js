/**
 * Standalone Prompt Debugger Script
 *
 * USAGE:
 * 1. Open the prompt builder application in your browser
 * 2. Open Developer Console (F12 or Cmd+Option+I)
 * 3. Copy and paste this entire script into the console
 * 4. Run: await capturePromptDebug()
 * 5. The data will be logged to console and downloaded as JSON
 *
 * OR run via Node.js:
 * node scripts/capture-prompt-debug.js
 */

(async function() {
  console.log('🚀 Initializing Prompt Debugger...');

  // Check if we're in the browser
  const isBrowser = typeof window !== 'undefined';

  if (!isBrowser) {
    console.error('❌ This script must be run in the browser console');
    console.log('');
    console.log('Instructions:');
    console.log('1. Open the prompt builder app in your browser');
    console.log('2. Open Developer Console (F12 or Cmd+Option+I)');
    console.log('3. Copy this entire script and paste it into the console');
    console.log('4. Run: await capturePromptDebug()');
    return;
  }

  /**
   * Main capture function
   */
  window.capturePromptDebug = async function() {
    console.log('\n🔍 Starting prompt capture...\n');

    // Try to find React component state
    let state = null;
    let rootElement = null;

    try {
      // Find the root element
      rootElement = document.querySelector('#root');
      if (!rootElement) {
        throw new Error('Could not find #root element');
      }

      // Try to access React Fiber to get component state
      const fiberKey = Object.keys(rootElement).find(key =>
        key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
      );

      if (!fiberKey) {
        throw new Error('Could not find React Fiber');
      }

      // Traverse React component tree to find PromptOptimizerContainer
      let fiber = rootElement[fiberKey];
      let promptOptimizerState = null;

      function traverseFiber(fiber, depth = 0) {
        if (depth > 50) return; // Prevent infinite loops

        if (fiber?.memoizedState) {
          // Check if this looks like PromptOptimizerContainer
          if (fiber.memoizedState.promptContext ||
              fiber.memoizedProps?.promptOptimizer) {
            promptOptimizerState = {
              ...fiber.memoizedProps,
              ...fiber.memoizedState
            };
          }
        }

        if (fiber?.child && !promptOptimizerState) {
          traverseFiber(fiber.child, depth + 1);
        }
        if (fiber?.sibling && !promptOptimizerState) {
          traverseFiber(fiber.sibling, depth + 1);
        }
      }

      traverseFiber(fiber);

      if (promptOptimizerState) {
        state = promptOptimizerState;
      }
    } catch (error) {
      console.warn('⚠️  Could not access React state via Fiber:', error.message);
    }

    // Fallback: Try to find state from window globals
    if (!state) {
      console.log('ℹ️  Trying window globals...');

      state = {
        inputPrompt: window.__PROMPT_STATE__?.inputPrompt || '',
        displayedPrompt: window.__PROMPT_STATE__?.displayedPrompt || '',
        optimizedPrompt: window.__PROMPT_STATE__?.optimizedPrompt || '',
        selectedMode: window.__PROMPT_STATE__?.selectedMode || 'video',
        promptContext: window.__PROMPT_STATE__?.promptContext || null
      };
    }

    // Manual fallback: Ask user to provide data
    if (!state.inputPrompt && !state.displayedPrompt) {
      console.log('⚠️  Could not automatically detect prompt state.');
      console.log('');
      console.log('Please manually set the prompt data:');
      console.log('');
      console.log('window.__PROMPT_STATE__ = {');
      console.log('  inputPrompt: "your original prompt here",');
      console.log('  displayedPrompt: "your optimized prompt here",');
      console.log('  selectedMode: "video",');
      console.log('  promptContext: null');
      console.log('};');
      console.log('');
      console.log('Then run: await capturePromptDebug()');
      return null;
    }

    // Extract highlights from prompt
    const highlights = await extractHighlights(
      state.displayedPrompt || state.optimizedPrompt || state.inputPrompt,
      state.promptContext
    );

    console.log(`✅ Found ${highlights.length} highlights`);

    // Capture data
    const capture = {
      timestamp: new Date().toISOString(),
      captureId: `capture-${Date.now()}`,
      originalPrompt: state.inputPrompt || '',
      displayedPrompt: state.displayedPrompt || state.optimizedPrompt || '',
      mode: state.selectedMode || 'video',
      context: state.promptContext,
      highlights: highlights,
      highlightSuggestions: []
    };

    // Fetch suggestions for each highlight
    if (highlights.length > 0) {
      console.log(`\n🔄 Fetching suggestions for ${highlights.length} highlights...\n`);

      for (let i = 0; i < highlights.length; i++) {
        const highlight = highlights[i];
        console.log(`  📝 [${i + 1}/${highlights.length}] "${highlight.text}"`);

        try {
          const suggestions = await fetchSuggestions(highlight, capture, state);

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
          if (i < highlights.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`    ❌ Error: ${error.message}`);
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

    // Print report
    printReport(capture);

    // Download JSON
    downloadJSON(capture);

    // Store globally
    window.__LAST_CAPTURE__ = capture;

    console.log('\n💾 Data saved to: window.__LAST_CAPTURE__');
    console.log('');

    return capture;
  };

  /**
   * Extract highlights from prompt text
   */
  async function extractHighlights(text, context) {
    // Simple regex-based extraction for standalone mode
    // In real app, this would use phraseExtractor.js

    const highlights = [];

    // Pattern for common video prompt elements
    const patterns = [
      { pattern: /\b(aerial|drone|tracking|dolly|pan|tilt|crane|steadicam)\s+(shot|view|perspective|movement)/gi, category: 'cameraMove' },
      { pattern: /\b(close-up|wide shot|medium shot|extreme close-up|establishing shot)/gi, category: 'framing' },
      { pattern: /\b(golden hour|soft|harsh|natural|studio|rim|backlighting|volumetric)\s+(light|lighting)/gi, category: 'lighting' },
      { pattern: /\b(shallow|deep|narrow)\s+depth of field/gi, category: 'depthOfField' },
      { pattern: /\b(vibrant|muted|warm|cool|pastel|monochrome)\s+(colors|color palette)/gi, category: 'color' },
      { pattern: /\bon\s+35mm|on\s+16mm|on\s+film|cinematic/gi, category: 'technical' },
    ];

    for (const { pattern, category } of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        highlights.push({
          text: match[0],
          category: category,
          confidence: 0.8,
          source: 'pattern-match'
        });
      }
    }

    // Look for context elements if available
    if (context?.elements) {
      for (const [key, value] of Object.entries(context.elements)) {
        if (value && text.toLowerCase().includes(value.toLowerCase())) {
          const index = text.toLowerCase().indexOf(value.toLowerCase());
          const actualText = text.substring(index, index + value.length);

          highlights.push({
            text: actualText,
            category: key,
            confidence: 1.0,
            source: 'user-input',
            originalValue: value
          });
        }
      }
    }

    // Remove duplicates
    const unique = [];
    const seen = new Set();

    for (const h of highlights) {
      const key = `${h.text.toLowerCase()}-${h.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(h);
      }
    }

    return unique;
  }

  /**
   * Fetch suggestions from API
   */
  async function fetchSuggestions(highlight, capture, state) {
    try {
      const response = await fetch('/api/get-enhancement-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          highlightedText: highlight.text,
          contextBefore: '',
          contextAfter: '',
          fullPrompt: capture.displayedPrompt,
          originalUserPrompt: capture.originalPrompt,
          brainstormContext: capture.context,
          highlightedCategory: highlight.category,
          highlightedCategoryConfidence: highlight.confidence
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.suggestions || [];
    } catch (error) {
      console.error(`Error fetching suggestions:`, error);
      throw error;
    }
  }

  /**
   * Print formatted report
   */
  function printReport(capture) {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 PROMPT DEBUG REPORT');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Capture ID: ${capture.captureId}`);
    console.log(`Timestamp: ${capture.timestamp}`);
    console.log(`Mode: ${capture.mode}`);
    console.log('');

    console.log('───────────────────────────────────────────────────────');
    console.log('📝 ORIGINAL PROMPT');
    console.log('───────────────────────────────────────────────────────');
    console.log(capture.originalPrompt);
    console.log('');

    if (capture.displayedPrompt !== capture.originalPrompt) {
      console.log('───────────────────────────────────────────────────────');
      console.log('✨ DISPLAYED/OPTIMIZED PROMPT');
      console.log('───────────────────────────────────────────────────────');
      console.log(capture.displayedPrompt);
      console.log('');
    }

    if (capture.context?.elements) {
      console.log('───────────────────────────────────────────────────────');
      console.log('🎨 CREATIVE BRAINSTORM CONTEXT');
      console.log('───────────────────────────────────────────────────────');
      Object.entries(capture.context.elements).forEach(([key, value]) => {
        if (value) {
          console.log(`  ${key}: ${value}`);
        }
      });
      console.log('');
    }

    console.log('───────────────────────────────────────────────────────');
    console.log(`🎯 HIGHLIGHTS (${capture.highlights.length})`);
    console.log('───────────────────────────────────────────────────────');
    capture.highlights.forEach((h, i) => {
      console.log(`\n[${i}] "${h.text}"`);
      console.log(`    Category: ${h.category}`);
      console.log(`    Confidence: ${(h.confidence * 100).toFixed(0)}%`);
      console.log(`    Source: ${h.source}`);
    });
    console.log('');

    console.log('───────────────────────────────────────────────────────');
    console.log(`💡 SUGGESTIONS (${capture.highlightSuggestions.length})`);
    console.log('───────────────────────────────────────────────────────');
    capture.highlightSuggestions.forEach((s) => {
      console.log(`\n[${s.highlightIndex}] "${s.highlightText}" (${s.category})`);

      if (s.error) {
        console.log(`    ❌ Error: ${s.error}`);
      } else if (s.suggestions?.length > 0) {
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
        console.log(`    ℹ️  No suggestions`);
      }
    });

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('End of Report');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n');
  }

  /**
   * Download capture as JSON file
   */
  function downloadJSON(capture) {
    const json = JSON.stringify(capture, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-debug-${capture.captureId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`📥 Downloaded: prompt-debug-${capture.captureId}.json`);
  }

  console.log('✅ Prompt Debugger ready!');
  console.log('');
  console.log('📖 Usage:');
  console.log('  await capturePromptDebug()  - Capture all prompt data and suggestions');
  console.log('  window.__LAST_CAPTURE__     - Access the last captured data');
  console.log('');
  console.log('If automatic detection fails, manually set:');
  console.log('  window.__PROMPT_STATE__ = { inputPrompt: "...", displayedPrompt: "...", ... }');
  console.log('');
})();
