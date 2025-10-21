# Prompt Builder - Workflow & Implementation Documentation
**Branch:** production-changes/prompt-changes
**Generated:** 2025-10-21

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Current Workflow](#current-workflow)
3. [Text Parsing Implementation](#text-parsing-implementation)
4. [Component Breakdown](#component-breakdown)
5. [Data Flow](#data-flow)
6. [Key Features](#key-features)

---

## System Architecture

### Tech Stack
- **Frontend:** React 18+ with Vite
- **Routing:** React Router v6
- **Styling:** Tailwind CSS
- **NLP:** compromise.js for phrase extraction
- **Backend:** Express.js + Node.js
- **AI:** Claude API (Anthropic) / OpenAI API
- **State Management:** React hooks (useState, useEffect, useCallback)

### Project Structure
```
prompt-builder/
├── client/
│   └── src/
│       ├── features/
│       │   ├── prompt-optimizer/
│       │   │   ├── PromptOptimizerContainer.jsx    # Main orchestrator
│       │   │   ├── PromptInput.jsx                 # Input component
│       │   │   ├── PromptCanvas.jsx                # Editor/Canvas
│       │   │   └── phraseExtractor.js              # Text parsing
│       │   └── history/
│       │       └── HistorySidebar.jsx
│       ├── hooks/
│       │   ├── usePromptOptimizer.js               # Core optimization logic
│       │   └── usePromptHistory.js                 # History management
│       └── components/
│           ├── PromptEnhancementEditor.jsx         # AI suggestions panel
│           └── ModeSelector.jsx
└── server/
    └── src/
        ├── services/
        │   ├── PromptOptimizationService.js        # Backend optimization
        │   └── VideoPromptTemplates.js
        └── routes/
            └── api.routes.js
```

---

## Current Workflow

### 1. User Journey Overview

```
[User Input] → [Mode Selection] → [Optimization] → [AI Processing] →
[Typewriter Display] → [Text Parsing] → [Interactive Editing]
```

### 2. Detailed Step-by-Step Flow

#### **Step 1: Landing Page**
- **Location:** `PromptInput.jsx` (lines 147-233)
- User sees clean input interface with:
  - Hero section: "Prompt Builder"
  - Mode selector tabs (Standard, Reasoning, Research, Socratic, Video)
  - Textarea for prompt input
  - Quick action buttons for template prompts
  - "Optimize" button

#### **Step 2: Input & Mode Selection**
- **Component:** `PromptInput.jsx`
- User enters text in textarea (lines 174-186)
  ```jsx
  <textarea
    value={inputPrompt}
    onChange={(e) => onInputChange(e.target.value)}
    placeholder="Describe what you want to create..."
  />
  ```
- User selects mode via `ModeSelector.jsx`
- Pressing Enter or clicking "Optimize" triggers optimization

#### **Step 3: API Call & Processing**
- **Hook:** `usePromptOptimizer.js` (lines 61-97)
- Flow:
  1. Validates input is not empty
  2. Sets `isProcessing = true`
  3. Makes POST request to `/api/optimize`
     ```javascript
     const response = await fetch('/api/optimize', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-API-Key': 'dev-key-12345',
       },
       body: JSON.stringify({
         prompt: prompt,
         mode: selectedMode,
         context: context,
       }),
     });
     ```
  4. Backend (`PromptOptimizationService.js`) processes:
     - Builds mode-specific system prompt (lines 140-166)
     - Calls Claude API with optimized parameters
     - Returns structured, optimized prompt

#### **Step 4: Typewriter Animation**
- **Container:** `PromptOptimizerContainer.jsx` (lines 148-174)
- Once API returns optimized text:
  ```javascript
  const intervalId = setInterval(() => {
    if (currentIndex <= optimizedPrompt.length) {
      const text = optimizedPrompt.slice(0, currentIndex);
      setDisplayedPrompt(text);
      currentIndex += 3; // 3 chars at a time
    }
  }, 5); // Every 5ms
  ```
- Creates smooth typing effect showing the AI's response

#### **Step 5: Text Parsing & Highlighting**
- **Component:** `PromptCanvas.jsx` (lines 22-227)
- **CRITICAL:** Highlighting ONLY activates when:
  1. Mode is `video` mode
  2. Animation is complete (`isAnimationComplete === true`)

- **Key Logic** (lines 448-466):
  ```javascript
  // Check if animation is complete
  useEffect(() => {
    if (displayedPrompt && optimizedPrompt && displayedPrompt === optimizedPrompt) {
      setIsAnimationComplete(true); // Trigger highlighting
    }
  }, [displayedPrompt, optimizedPrompt]);

  // Enable ML highlighting ONLY after animation completes
  const enableMLHighlighting = selectedMode === 'video' && isAnimationComplete;
  const { html: formattedHTML } = useMemo(
    () => formatTextToHTML(displayedPrompt, enableMLHighlighting),
    [displayedPrompt, enableMLHighlighting]
  );
  ```

---

## Text Parsing Implementation

### Overview
The text parsing system uses **two-stage processing**:
1. **Formatting stage:** Converts plain text to HTML with styling
2. **ML highlighting stage:** Applies NLP-based phrase extraction (video mode only)

### Stage 1: Text-to-HTML Formatting
**Function:** `formatTextToHTML()` in `PromptCanvas.jsx` (lines 22-227)

#### Input Processing
```javascript
const lines = text.split('\n');
```

#### Pattern Detection & Formatting
The formatter detects these patterns:

1. **Headers with separators** (lines 150-164)
   ```
   ━━━━━━━━━━
   MAIN TITLE
   ━━━━━━━━━━
   ```
   → Converts to `<h1>` with styling

2. **ALL CAPS headers** (lines 167-179)
   ```
   SECTION TITLE
   ```
   → Converts to `<h2>`

3. **Lines ending with colon** (lines 182-187)
   ```
   Subsection:
   ```
   → Converts to `<h3>`

4. **Bullet points** (lines 190-195)
   ```
   - Item text
   • Another item
   ```
   → Converts to styled `<div>` with bullet

5. **Numbered lists** (lines 198-204)
   ```
   1. First item
   2. Second item
   ```
   → Converts to numbered `<div>`

6. **Paragraphs** (lines 207-223)
   - Regular text becomes `<p>` tags
   - Multiple consecutive lines are joined

#### Example Transform
```
Input:
━━━━━━━━━━
VIDEO PROMPT
━━━━━━━━━━

TECHNICAL SPECS:
- Camera: 35mm lens
- Lighting: Golden hour

Output (HTML):
<h1 style="...">VIDEO PROMPT</h1>
<h3 style="...">Technical Specs</h3>
<div style="..."><span>•</span><p>Camera: 35mm lens</p></div>
<div style="..."><span>•</span><p>Lighting: Golden hour</p></div>
```

### Stage 2: ML-Powered Phrase Extraction
**File:** `phraseExtractor.js`
**Library:** compromise.js (NLP library)

#### Activation Conditions
- ONLY runs in **video mode**
- ONLY after **typewriter animation completes**
- Prevents classification during streaming

#### Phrase Extraction Logic

**Function:** `extractVideoPromptPhrases(text)` (lines 4-44)

##### 1. Descriptive Phrases (lines 11-16)
```javascript
const descriptive = doc.match('#Adjective+ #Noun+').out('array')
// Example matches: "golden hour lighting", "soft shadows"
phrases.push(...descriptive.map(p => ({
  text: p,
  category: 'descriptive',
  color: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.5)' }
})))
```

##### 2. Camera Movements (lines 18-24)
```javascript
const cameraMovement = doc.match('camera #Adverb? #Verb').out('array')
// Example matches: "camera slowly dollies", "camera pans"
phrases.push(...cameraMovement.map(p => ({
  text: p,
  category: 'camera',
  color: { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.5)' }
})))
```

##### 3. Compound Nouns (lines 26-32)
```javascript
const compounds = doc.match('#Noun #Noun+').out('array')
// Example matches: "frock coat", "battlefield cemetery"
phrases.push(...compounds.map(p => ({
  text: p,
  category: 'subject',
  color: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)' }
})))
```

##### 4. Technical Specs (lines 34-40)
```javascript
const technical = doc.match('/[0-9]+mm|[0-9]+fps|[0-9]+:[0-9]+/').out('array')
// Example matches: "35mm", "24fps", "2.39:1"
phrases.push(...technical.map(p => ({
  text: p,
  category: 'technical',
  color: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.5)' }
})))
```

##### 5. Duplicate Removal (lines 46-58)
```javascript
function removeDuplicates(phrases) {
  phrases.sort((a, b) => b.text.length - a.text.length) // Longest first
  const kept = []

  for (const phrase of phrases) {
    const overlaps = kept.some(existing =>
      phrase.text.includes(existing.text) || existing.text.includes(phrase.text)
    )
    if (!overlaps) kept.push(phrase)
  }

  return kept
}
```

**Logic:** Keeps longer phrases, discards shorter overlapping ones
- "golden hour" vs "hour" → keeps "golden hour"
- "camera dollies forward" vs "camera dollies" → keeps longer version

#### Structural Element Detection
**Location:** `PromptCanvas.jsx` (lines 65-91)

The system intelligently **skips highlighting** for:

1. **Headers (ALL CAPS, 5+ chars)**
   ```javascript
   if (/^[A-Z\s\-&/]{5,}$/.test(trimmed)) return true;
   ```

2. **Emoji headers**
   ```javascript
   if (firstChar >= 0xD83C || firstChar >= 0xD83D) return true;
   ```

3. **Section labels**
   ```
   WHO - SUBJECT/CHARACTER
   ```

4. **Category labels**
   ```
   **Technical Specs**:
   ```

5. **Standalone labels ending with colon**
   ```
   Positioning:
   ```

**Why?** Prevents cluttering headers with unnecessary highlights.

#### Highlight Application
**Location:** `PromptCanvas.jsx` (lines 109-136)

```javascript
const highlightValueWords = (input) => {
  const phrases = extractVideoPromptPhrases(input);
  phrases.sort((a, b) => input.indexOf(a.text) - input.indexOf(b.text));

  let result = '';
  let lastIndex = 0;

  phrases.forEach(phrase => {
    const start = input.indexOf(phrase.text, lastIndex);
    // Add text before phrase
    result += escapeHtml(input.slice(lastIndex, start));

    // Add highlighted phrase
    result += `<span class="value-word value-word-${phrase.category}"
                     data-category="${phrase.category}"
                     style="background-color: ${phrase.color.bg};
                            border-bottom: 2px solid ${phrase.color.border};">
                ${escapeHtml(phrase.text)}
              </span>`;

    lastIndex = start + phrase.text.length;
  });

  // Add remaining text
  result += escapeHtml(input.slice(lastIndex));
  return result;
}
```

**Output:** HTML with inline-styled `<span>` elements for each phrase.

---

## Component Breakdown

### 1. PromptOptimizerContainer.jsx
**Role:** Main orchestrator
**Responsibilities:**
- Route management (`/`, `/prompt/:uuid`)
- State coordination between child components
- User authentication (Firebase)
- History management
- Keyboard shortcuts
- Modal management (brainstorm, improvement forms)

**Key State:**
```javascript
const [selectedMode, setSelectedMode] = useState('optimize');
const [showResults, setShowResults] = useState(false);
const [suggestionsData, setSuggestionsData] = useState(null);
```

**Key Functions:**
- `handleOptimize()` - Triggers optimization flow
- `fetchEnhancementSuggestions()` - Gets AI alternatives for highlighted text
- `loadFromHistory()` - Restores previous prompt from history

### 2. PromptInput.jsx
**Role:** Input interface
**Features:**
- Textarea with auto-resize
- Mode selector integration
- Quick action templates
- Keyboard shortcuts (Enter/Cmd+Enter)
- "Build Concept" button (video mode only)

**Key Props:**
```javascript
{
  inputPrompt,
  onInputChange,
  selectedMode,
  onModeChange,
  onOptimize,
  isProcessing
}
```

### 3. PromptCanvas.jsx
**Role:** Interactive editor/canvas
**Features:**
- ContentEditable HTML editor
- Floating toolbar (copy, share, export, legend)
- Three-pane layout:
  1. **Left:** Original input (narrow sidebar)
  2. **Center:** Optimized prompt (main editor)
  3. **Right:** AI suggestions panel
- Click-to-suggest on highlights
- Text selection for manual suggestions
- Copy/paste handling

**Key State:**
```javascript
const [copied, setCopied] = useState(false);
const [showLegend, setShowLegend] = useState(false);
const [isAnimationComplete, setIsAnimationComplete] = useState(false);
```

**Editor Reference:**
```javascript
const editorRef = useRef(null);

// ContentEditable editor
<div
  ref={editorRef}
  contentEditable
  onInput={handleInput}
  onClick={handleHighlightClick}
  onMouseDown={handleHighlightMouseDown}
  onMouseUp={handleTextSelection}
/>
```

### 4. usePromptOptimizer.js
**Role:** Core optimization hook
**State Management:**
```javascript
{
  inputPrompt,
  optimizedPrompt,
  displayedPrompt,       // For typewriter animation
  qualityScore,
  isProcessing,
  skipAnimation,
  improvementContext
}
```

**Key Functions:**
- `optimize(prompt, context)` - Main API call
- `calculateQualityScore(input, output)` - Scores optimization quality
- `resetPrompt()` - Clears all state

### 5. phraseExtractor.js
**Role:** NLP-powered text analysis
**Dependencies:** compromise.js

**Exports:**
```javascript
export function extractVideoPromptPhrases(text) {
  // Returns array of { text, category, color }
}
```

**Categories Detected:**
- `descriptive` - Adjective + Noun phrases
- `camera` - Camera movements
- `subject` - Compound nouns
- `technical` - Specs (35mm, 24fps, etc.)

---

## Data Flow

### Complete Request-Response Cycle

```
┌─────────────────┐
│  User Types     │
│  "robot on Mars"│
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  PromptInput            │
│  - Captures input       │
│  - Selects mode: video  │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  usePromptOptimizer Hook     │
│  - optimize(prompt, mode)    │
│  - setIsProcessing(true)     │
└────────┬─────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  API Call: POST /api/optimize      │
│  {                                 │
│    prompt: "robot on Mars",        │
│    mode: "video",                  │
│    context: null                   │
│  }                                 │
└────────┬───────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Backend: PromptOptimizationService │
│  - buildSystemPrompt(mode='video') │
│  - claudeClient.complete()         │
└────────┬────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Claude API Response                 │
│  Returns: 150-word cinematic prompt  │
│  with technical specs, lighting, etc.│
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  usePromptOptimizer Hook       │
│  - setOptimizedPrompt(result)  │
│  - calculateQualityScore()     │
│  - setIsProcessing(false)      │
└────────┬───────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  PromptOptimizerContainer       │
│  - Typewriter animation starts  │
│  - Displays char-by-char (5ms)  │
└────────┬────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Animation Complete Event          │
│  - displayedPrompt === optimized   │
│  - setIsAnimationComplete(true)    │
└────────┬───────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  PromptCanvas.jsx                    │
│  - formatTextToHTML(enableML=true)   │
│  - Triggers phraseExtractor.js       │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  phraseExtractor.js                  │
│  - compromise.js NLP processing      │
│  - Extract: camera, technical, etc.  │
│  - Returns: [{ text, category, ... }]│
└────────┬─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  highlightValueWords()              │
│  - Injects <span> with styling     │
│  - Skips structural elements        │
│  - Removes duplicates               │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  ContentEditable Editor             │
│  - Displays formatted HTML          │
│  - Clickable highlights             │
│  - Tooltip on hover                 │
└─────────────────────────────────────┘
```

### User Interaction Flow (After Display)

```
User clicks highlight "golden hour"
         │
         ▼
┌────────────────────────────────┐
│  handleHighlightClick()        │
│  - Get clicked word            │
│  - Create selection range      │
└────────┬───────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  fetchEnhancementSuggestions()       │
│  - Extract context before/after      │
│  - POST /api/get-enhancement-        │
│    suggestions                       │
└────────┬─────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Backend: EnhancementService       │
│  - Analyzes phrase in context      │
│  - Returns alternatives            │
└────────┬───────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  SuggestionsPanel                │
│  - Shows alternatives:           │
│    • "blue hour"                 │
│    • "magic hour"                │
│    • "twilight glow"             │
└────────┬─────────────────────────┘
         │
         ▼
User clicks "blue hour"
         │
         ▼
┌────────────────────────────────┐
│  onSuggestionClick()           │
│  - Replace text                │
│  - Update optimizedPrompt      │
│  - Close panel                 │
└────────────────────────────────┘
```

---

## Key Features

### 1. Intelligent Highlighting
- **Pattern-based:** Uses NLP (compromise.js) not regex
- **Context-aware:** Skips headers and labels
- **De-duplicated:** Keeps longest matching phrases
- **Conditional:** Only in video mode, post-animation

### 2. Interactive Editing
- **ContentEditable:** Full text editing capabilities
- **Click-to-suggest:** Click any highlight for alternatives
- **Manual selection:** Select any text for custom suggestions
- **Real-time updates:** Changes sync to state immediately

### 3. Multi-Mode Support
Modes with different prompting strategies:
- **Standard:** General optimization
- **Reasoning:** For o1/o3 models (deep thinking)
- **Research:** Comprehensive research plans
- **Socratic:** Question-based learning
- **Video:** Cinematic prompt generation

### 4. Typewriter Animation
- **Smooth:** 3 chars every 5ms
- **Skippable:** Can click to complete instantly
- **State-aware:** Triggers post-processing on completion

### 5. AI-Powered Suggestions
- **Contextual:** Sends 300 chars before/after
- **Relevant:** Tailored to video terminology
- **Fast:** Cached for repeated requests
- **Interactive:** One-click application

### 6. History Management
- **Firebase storage:** Persists across sessions
- **UUID tracking:** Shareable links (`/prompt/:uuid`)
- **Search:** Filter by content or mode
- **Reload:** Click to restore previous work

---

## Performance Optimizations

### 1. Conditional Highlighting
```javascript
// ONLY highlight when both conditions true
const enableMLHighlighting = selectedMode === 'video' && isAnimationComplete;
```
**Why?** Prevents expensive NLP processing during animation.

### 2. Memoization
```javascript
const { html: formattedHTML } = useMemo(
  () => formatTextToHTML(displayedPrompt, enableMLHighlighting),
  [displayedPrompt, enableMLHighlighting]
);
```
**Why?** Only re-formats when inputs change.

### 3. Debounced Suggestions
```javascript
// Wait 300ms before fetching suggestions
debounceTimerRef.current = setTimeout(performFetch, 300);
```
**Why?** Prevents API spam during text selection.

### 4. Request Deduplication
```javascript
const requestId = Symbol('suggestions');
lastRequestRef.current = requestId;
// Later...
if (lastRequestRef.current !== requestId) {
  return; // Ignore stale response
}
```
**Why?** Ignores outdated API responses.

### 5. CSS-based Hover Effects
```css
.value-word:hover {
  filter: brightness(0.95);
  transform: translateY(-0.5px);
  cursor: pointer !important;
}
```
**Why?** Native CSS is faster than JavaScript hover handlers.

---

## Security Considerations

### 1. XSS Prevention
```javascript
const escapeHtml = (str) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
```
**Applied:** Before any text is inserted into HTML.

### 2. ContentEditable Safety
```javascript
suppressContentEditableWarning  // React-controlled content
onCopy={handleCopyEvent}        // Custom copy handler
onInput={handleInput}           // Sanitized input
```

### 3. API Authentication
```javascript
headers: {
  'X-API-Key': 'dev-key-12345',
}
```
**Note:** Production should use environment variables.

---

## Browser Compatibility

### Tested Features
- ✅ ContentEditable (all modern browsers)
- ✅ getSelection() API
- ✅ Range manipulation
- ✅ CSS Grid/Flexbox
- ✅ ES6+ features (via Vite transpilation)

### Known Limitations
- Safari: Occasional focus issues with contentEditable
- Firefox: Slight rendering differences in tooltips

---

## Future Enhancement Opportunities

### 1. Offline Support
- Cache responses for offline editing
- IndexedDB for local history storage

### 2. Collaborative Editing
- WebSocket-based real-time collaboration
- Conflict resolution for simultaneous edits

### 3. Extended NLP
- Custom phrase training
- User-defined categories
- Sentiment analysis for tone

### 4. Export Formats
- PDF with formatting preserved
- Direct export to video tools (Runway, Pika)
- Notion/Obsidian integration

### 5. Analytics
- Track which suggestions are used most
- Optimize templates based on user preferences
- A/B testing for prompt templates

---

## Debugging Tips

### Enable Highlight Debugging
```javascript
// In PromptCanvas.jsx, add console logs:
console.log('Highlighting enabled?', enableMLHighlighting);
console.log('Phrases extracted:', phrases);
```

### View Raw HTML
```javascript
// In browser console:
console.log(editorRef.current.innerHTML);
```

### Test Phrase Extraction
```javascript
import { extractVideoPromptPhrases } from './phraseExtractor.js';

const text = "A camera slowly dollies forward capturing golden hour lighting";
const phrases = extractVideoPromptPhrases(text);
console.log(phrases);
```

### Monitor API Calls
```javascript
// In Network tab, filter by:
// - /api/optimize
// - /api/get-enhancement-suggestions
```

---

## Conclusion

The Prompt Builder uses a sophisticated multi-stage text processing pipeline:

1. **User input** → Mode-specific optimization
2. **AI response** → Typewriter animation
3. **Animation complete** → NLP phrase extraction (video mode)
4. **Phrase highlighting** → Interactive suggestions
5. **User edits** → ContentEditable with state sync

The system balances **performance** (conditional processing, memoization) with **user experience** (smooth animations, instant interactions) while maintaining **security** (XSS prevention, input sanitization).

The text parsing implementation is **intelligent** (skips headers, removes duplicates) and **extensible** (easy to add new phrase categories or NLP patterns).

---

**Questions or Issues?**
Check the codebase comments or reference line numbers provided throughout this document.