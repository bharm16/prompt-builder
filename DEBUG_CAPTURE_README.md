# Prompt Debug Capture Tool

This tool captures your video prompts along with all highlighted words and their AI suggestions for troubleshooting.

## 📋 What It Captures

For each prompt, the tool captures:

1. **Original Prompt** - The text you entered
2. **Displayed/Optimized Prompt** - The processed/optimized version
3. **Creative Brainstorm Context** - Any context elements you provided
4. **Highlights** - All underlined/highlighted words with:
   - The highlighted text
   - Category (lighting, cameraMove, framing, etc.)
   - Confidence score
   - Source (user-input, semantic-match, nlp-extracted)
5. **AI Suggestions** - For each highlight:
   - All suggestion text alternatives
   - Explanations for each suggestion
   - Compatibility scores
   - Suggestion categories

## 🚀 Three Ways to Use

### Method 1: Browser Console Script (Quickest)

**No code changes needed! Use this for immediate troubleshooting.**

1. Open your prompt builder application in the browser
2. Open Developer Console (F12 or Cmd+Option+I on Mac)
3. Copy the entire contents of `scripts/capture-prompt-debug.js`
4. Paste into the console and press Enter
5. Run:
   ```javascript
   await capturePromptDebug()
   ```
6. The data will be:
   - Logged to console with a formatted report
   - Downloaded as a JSON file
   - Stored in `window.__LAST_CAPTURE__`

**If automatic detection fails:**
```javascript
// Manually set the prompt data
window.__PROMPT_STATE__ = {
  inputPrompt: "your original prompt here",
  displayedPrompt: "your optimized prompt here",
  selectedMode: "video",
  promptContext: null
};

// Then run capture
await capturePromptDebug()
```

### Method 2: UI Button (Best for Regular Use)

**Add a debug button to your application UI.**

1. Open `client/src/features/prompt-optimizer/PromptOptimizerContainer.jsx`

2. Add the import at the top:
   ```javascript
   import DebugButton from '../../components/DebugButton';
   ```

3. Add the button component inside your JSX (place it anywhere, it will appear fixed in bottom-right):
   ```jsx
   <DebugButton
     inputPrompt={promptOptimizer.inputPrompt}
     displayedPrompt={promptOptimizer.displayedPrompt}
     optimizedPrompt={promptOptimizer.optimizedPrompt}
     selectedMode={selectedMode}
     promptContext={promptContext}
   />
   ```

4. Save and reload the app

5. Click the "🔍 Debug Capture" button to capture data

6. Click the "💾 Export JSON" button to download the last capture

### Method 3: Programmatic API (For Automated Testing)

**Use the hook directly in your code.**

```javascript
import { usePromptDebugger } from '../hooks/usePromptDebugger';

function MyComponent() {
  const { capturePromptData, exportToFile, isCapturing } = usePromptDebugger({
    inputPrompt: promptOptimizer.inputPrompt,
    displayedPrompt: promptOptimizer.displayedPrompt,
    optimizedPrompt: promptOptimizer.optimizedPrompt,
    selectedMode,
    promptContext
  });

  const handleDebug = async () => {
    const capture = await capturePromptData();
    console.log('Captured:', capture);
  };

  return (
    <button onClick={handleDebug} disabled={isCapturing}>
      Debug
    </button>
  );
}
```

**Or use the debugger class directly:**

```javascript
import { promptDebugger } from '../utils/promptDebugger';

// Capture data
const capture = await promptDebugger.captureFullPromptData(
  state,
  fetchSuggestionsFunction
);

// Export to file
promptDebugger.exportToFile();

// Print report to console
promptDebugger.printReport();

// Access last capture
console.log(promptDebugger.lastCapture);

// Get summary of all captures
console.log(promptDebugger.getSummary());

// Clear all captures
promptDebugger.clearCaptures();
```

## 📊 Output Format

The captured data is a JSON object with this structure:

```json
{
  "timestamp": "2025-10-21T12:34:56.789Z",
  "captureId": "capture-1729513296789",
  "originalPrompt": "Close-up of delicate fingers meticulously folding...",
  "displayedPrompt": "Close-up of delicate fingers meticulously folding...",
  "mode": "video",
  "context": {
    "version": "1.0.0",
    "elements": {
      "subject": "delicate fingers",
      "action": "folding",
      "location": "Japanese tea room",
      ...
    }
  },
  "highlights": [
    {
      "index": 0,
      "text": "delicate fingers",
      "category": "subject",
      "confidence": 1.0,
      "source": "user-input"
    },
    {
      "index": 1,
      "text": "vibrant origami crane",
      "category": "descriptive",
      "confidence": 0.75,
      "source": "nlp-extracted"
    }
  ],
  "highlightSuggestions": [
    {
      "highlightIndex": 0,
      "highlightText": "delicate fingers",
      "category": "subject",
      "suggestionsCount": 3,
      "suggestions": [
        {
          "text": "slender, precise fingers",
          "explanation": "Adds detail about finger shape and movement quality",
          "category": "Physical Description",
          "compatibility": 0.95
        },
        {
          "text": "nimble hands",
          "explanation": "Emphasizes dexterity and skill",
          "category": "Physical Description",
          "compatibility": 0.90
        }
      ],
      "fetchedAt": "2025-10-21T12:35:01.234Z"
    }
  ]
}
```

## 🔍 Console Output

The tool prints a formatted report to the console:

```
═══════════════════════════════════════════════════════
📊 PROMPT DEBUG REPORT
═══════════════════════════════════════════════════════
Capture ID: capture-1729513296789
Timestamp: 2025-10-21T12:34:56.789Z
Mode: video

───────────────────────────────────────────────────────
📝 ORIGINAL PROMPT
───────────────────────────────────────────────────────
Close-up of delicate fingers meticulously folding...

───────────────────────────────────────────────────────
🎯 HIGHLIGHTS (15)
───────────────────────────────────────────────────────

[0] "delicate fingers"
    Category: subject
    Confidence: 100%
    Source: user-input

[1] "vibrant origami crane"
    Category: descriptive
    Confidence: 75%
    Source: nlp-extracted

───────────────────────────────────────────────────────
💡 SUGGESTIONS (15)
───────────────────────────────────────────────────────

[0] "delicate fingers" (subject)
    ✅ 3 suggestions:

    1. "slender, precise fingers"
       Adds detail about finger shape and movement quality
       Category: Physical Description
       Compatibility: 95%

    2. "nimble hands"
       Emphasizes dexterity and skill
       Category: Physical Description
       Compatibility: 90%
```

## 🐛 Troubleshooting

### Problem: Script says "Could not find React Fiber"

**Solution:** Use manual mode:

```javascript
window.__PROMPT_STATE__ = {
  inputPrompt: "Copy your original prompt here",
  displayedPrompt: "Copy your displayed prompt here",
  selectedMode: "video",
  promptContext: null
};

await capturePromptDebug()
```

### Problem: No suggestions are being captured

**Possible causes:**
1. Backend server is not running
2. API endpoint `/api/get-enhancement-suggestions` is not accessible
3. Rate limiting is preventing requests

**Solution:**
- Check browser Network tab for failed requests
- Verify backend is running on the correct port
- Check backend logs for errors

### Problem: Highlights are not detected

**Cause:** The standalone script uses simple pattern matching.

**Solution:** Use Method 2 (UI Button) or Method 3 (Programmatic API) which use the full phraseExtractor logic.

## 📁 Files Created

```
/Users/bryceharmon/Desktop/prompt-builder/
├── client/src/
│   ├── utils/
│   │   └── promptDebugger.js          # Main debugger class
│   ├── hooks/
│   │   └── usePromptDebugger.js       # React hook wrapper
│   └── components/
│       └── DebugButton.jsx            # UI button component
├── scripts/
│   └── capture-prompt-debug.js        # Standalone console script
└── DEBUG_CAPTURE_README.md            # This file
```

## 💡 Tips

1. **Capture before and after optimization** - Run the capture twice to compare how the prompt changes

2. **Test specific highlights** - Manually click on different highlights in the UI and capture to see how suggestions differ

3. **Compare across prompts** - Use `promptDebugger.captures` to access all historical captures

4. **Automated testing** - Integrate the programmatic API into your test suite

5. **Share with team** - Export JSON files and share for collaborative debugging

## 🔗 Related Files

- **Highlight Detection:** `client/src/features/prompt-optimizer/phraseExtractor.js`
- **Suggestions API:** `server/src/services/EnhancementService.js`
- **Prompt Context:** `client/src/utils/PromptContext.js`
- **Main Container:** `client/src/features/prompt-optimizer/PromptOptimizerContainer.jsx`

## 📞 Support

If you encounter any issues:

1. Check the browser console for error messages
2. Verify all files are in the correct locations
3. Ensure the backend server is running
4. Check network requests in DevTools

For questions about the prompt builder architecture, see the exploration report in the agent output.
