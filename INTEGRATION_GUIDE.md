# Debug Button Integration Guide

## Quick Start: Add Debug Button to UI

Follow these steps to add the debug button to your PromptOptimizerContainer:

### Step 1: Add Import

Open `client/src/features/prompt-optimizer/PromptOptimizerContainer.jsx`

Add this import at the top with the other imports (around line 23):

```javascript
import DebugButton from '../../components/DebugButton';
```

So the imports section looks like:

```javascript
import CreativeBrainstormEnhanced from '../../components/CreativeBrainstormEnhanced';
import { ToastProvider, useToast } from '../../components/Toast';
import Settings, { useSettings } from '../../components/Settings';
import DebugButton from '../../components/DebugButton';  // <-- Add this line
import KeyboardShortcuts, { useKeyboardShortcuts } from '../../components/KeyboardShortcuts';
```

### Step 2: Add Component

Find the closing `</main>` tag (around line 1090).

Add the DebugButton component **before** the `</div>` that closes the main container (line 1091):

```jsx
        {!showResults && (
          <footer className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <a
              href="/privacy-policy"
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              Privacy Policy
            </a>
          </footer>
        )}
      </main>

      {/* Debug Button - Only show in development or with ?debug=true */}
      {(process.env.NODE_ENV === 'development' ||
        new URLSearchParams(window.location.search).get('debug') === 'true') && (
        <DebugButton
          inputPrompt={promptOptimizer.inputPrompt}
          displayedPrompt={promptOptimizer.displayedPrompt}
          optimizedPrompt={promptOptimizer.optimizedPrompt}
          selectedMode={selectedMode}
          promptContext={promptContext}
        />
      )}
    </div>
  );
}
```

### Step 3: Save and Test

1. Save the file
2. Reload your app
3. You should see two buttons in the bottom-right corner:
   - **🔍 Debug Capture** - Captures all prompt data
   - **💾 Export JSON** - Exports the last capture

### Optional: Always Show Debug Button

If you want the debug button to always be visible (not just in development), use this simpler version:

```jsx
      </main>

      <DebugButton
        inputPrompt={promptOptimizer.inputPrompt}
        displayedPrompt={promptOptimizer.displayedPrompt}
        optimizedPrompt={promptOptimizer.optimizedPrompt}
        selectedMode={selectedMode}
        promptContext={promptContext}
      />
    </div>
  );
}
```

### Optional: Enable with URL Parameter

To show the debug button only when `?debug=true` is in the URL:

```jsx
      </main>

      {new URLSearchParams(window.location.search).get('debug') === 'true' && (
        <DebugButton
          inputPrompt={promptOptimizer.inputPrompt}
          displayedPrompt={promptOptimizer.displayedPrompt}
          optimizedPrompt={promptOptimizer.optimizedPrompt}
          selectedMode={selectedMode}
          promptContext={promptContext}
        />
      )}
    </div>
  );
}
```

Then access your app with: `http://localhost:3000?debug=true`

## How to Use

1. **Enter a prompt** in your application
2. **Click "🔍 Debug Capture"** button
3. **Wait** while it fetches suggestions for all highlights (progress shown in console)
4. **View the report** in the browser console
5. **Click "💾 Export JSON"** to download the data

## Console Output

You'll see output like:

```
🔍 Starting prompt capture...
✅ Found 15 highlights
🔄 Fetching suggestions for 15 highlights...
  📝 [1/15] Fetching suggestions for: "delicate fingers"
    ✅ Got 3 suggestions
  📝 [2/15] Fetching suggestions for: "vibrant origami crane"
    ✅ Got 4 suggestions
  ...
✅ Capture complete!
📊 Summary:
  - Original prompt: Close-up of delicate fingers meticulously...
  - Highlights: 15
  - Suggestions captured: 15

💾 Access the data:
  - window.promptDebugger.lastCapture
  - window.promptDebugger.exportToFile()
  - window.promptDebugger.printReport()
```

## Styling the Debug Button

To customize the button position or style, pass additional props:

```jsx
<DebugButton
  inputPrompt={promptOptimizer.inputPrompt}
  displayedPrompt={promptOptimizer.displayedPrompt}
  optimizedPrompt={promptOptimizer.optimizedPrompt}
  selectedMode={selectedMode}
  promptContext={promptContext}
  style={{
    bottom: '100px',  // Move higher
    right: '10px',    // Move to the right
  }}
  className="my-custom-class"
/>
```

## Keyboard Shortcut (Optional)

To add a keyboard shortcut for debugging, add this to the `useKeyboardShortcuts` hook setup:

```javascript
const shortcuts = {
  // ... existing shortcuts ...
  'd': {
    key: 'd',
    ctrlKey: true,
    description: 'Capture debug data',
    action: () => {
      if (window.promptDebugger) {
        window.promptDebugger.captureFullPromptData(/* ... */);
      }
    },
  },
};
```

Then press **Ctrl+D** (or **Cmd+D** on Mac) to trigger debug capture.

## Next Steps

See [DEBUG_CAPTURE_README.md](./DEBUG_CAPTURE_README.md) for:
- How to use the browser console script
- Output format documentation
- Troubleshooting guide
- Advanced usage examples
