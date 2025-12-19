# Overview of span system implementation
_Exported on 11/22/2025 at 10:09:11 CST from Cursor (2.0.77)_

---

**User**

give me a detailed overview of the implementation and workflow of the span system and how each files is used in the system. 



first give me an explanation using natural langauge, then give me a technical explanation 

---

**Cursor**


Exploring the codebase to map the span system's implementation and workflow.



Searching for additional span-related files to understand the complete workflow:



Reading a few more key files to complete the picture:



## Natural Language Explanation

The span system analyzes video prompt text and highlights semantic elements (shot types, subjects, actions, environments, lighting, camera movements, etc.) with color-coded highlights.

### The User Experience

When a user types or edits a video prompt:
1. The text is sent to the backend for analysis (debounced to avoid excessive requests).
2. An LLM identifies meaningful parts and assigns categories (e.g., "wide shot" → `shot.type`, "cowboy" → `subject.identity`).
3. The backend validates and corrects the results.
4. The frontend receives labeled spans and highlights the text with category-specific colors.
5. Users can see which parts map to which video elements.

### The Workflow

1. User types → Frontend debounces → API request
2. Backend checks cache → If miss, calls LLM → Validates results
3. Frontend receives spans → Processes them → Renders highlights in the editor
4. Highlights update as the user edits

The system uses caching (client and server) to reduce API calls and improve responsiveness.

---

## Technical Explanation

### Architecture Overview

The span system has three layers:
1. Frontend: React hooks, rendering, caching
2. Backend API: Express route, LLM service, validation
3. Shared: Taxonomy definitions

### File-by-File Breakdown

#### **Shared Layer**

**`shared/taxonomy.js`** (559 lines)
- Single source of truth for categories
- Defines parent categories (`shot`, `subject`, `action`, `environment`, `lighting`, `camera`, `style`, `technical`, `audio`) and their attributes (`subject.identity`, `camera.movement`, etc.)
- Provides validation sets, legacy ID mapping, and helper functions
- Used by both frontend and backend to ensure consistency

#### **Backend Layer**

**`server/src/routes/labelSpansRoute.js`** (121 lines)
- Express route handler for `POST /llm/label-spans`
- Validates request parameters (`text`, `maxSpans`, `minConfidence`, `policy`, `templateVersion`)
- Implements cache-aside: checks cache first, falls back to LLM service
- Returns spans with cache hit/miss headers for monitoring

**`server/src/llm/span-labeling/SpanLabelingService.js`** (388 lines)
- Main orchestrator for span labeling
- Builds system prompt dynamically from `taxonomy.js` at runtime
- Handles chunking for large texts (>1000 words)
- Flow:
  1. Sanitizes input and policy
  2. Calls LLM via `AIModelService`
  3. Parses JSON response
  4. Validates schema
  5. Validates spans (strict mode)
  6. On failure: repair attempt or lenient mode
- Returns `{spans: Array, meta: Object}`

**`server/src/llm/span-labeling/validation/SpanValidator.js`**
- Core validation orchestrator
- 6-phase pipeline:
  1. Individual span validation & auto-correction (uses `SubstringPositionCache` to fix indices)
  2. Sorting by position
  3. Deduplication (`SpanDeduplicator`)
  4. Overlap resolution (`OverlapResolver`)
  5. Confidence filtering (`ConfidenceFilter`)
  6. Truncation to max spans (`SpanTruncator`)
- Supports strict and lenient modes

**`server/src/llm/span-labeling/processing/`**
- `SpanNormalizer.js`: Normalizes roles, generates IDs, handles legacy mappings
- `SpanDeduplicator.js`: Removes duplicate spans
- `OverlapResolver.js`: Resolves overlapping spans based on policy
- `ConfidenceFilter.js`: Filters spans below confidence threshold
- `SpanTruncator.js`: Limits to `maxSpans`

**`server/src/llm/span-labeling/cache/SubstringPositionCache.js`**
- Performance cache for substring position lookups
- Used during validation to auto-correct span indices
- Caches text → position mappings to avoid repeated searches

**`server/src/llm/span-labeling/utils/`**
- `chunkingUtils.js`: Splits large texts into processable chunks
- `jsonUtils.js`: Parses LLM JSON responses with error handling
- `policyUtils.js`: Sanitizes and validates policy objects
- `textUtils.js`: Text utilities (word count, formatting)

**`server/src/llm/span-labeling/validation/SchemaValidator.js`**
- Validates LLM response against JSON schema (`schemas/spanResponseSchema.json`)
- Ensures required fields (`spans`, `meta`) are present

**`server/src/services/cache/SpanLabelingCacheService.js`** (401 lines)
- Server-side caching (Redis + in-memory fallback)
- Cache key: `span:{textHash}:{policyHash}`
- TTL: 1 hour default, 5 min for large texts
- LRU eviction for in-memory cache
- Tracks metrics (hits, misses, hit rate)

#### **Frontend Layer**

**`client/src/features/span-highlighting/hooks/useSpanLabeling.js`** (447 lines)
- Main React hook for span labeling
- Features:
  - Debouncing (smart debounce based on text length)
  - Request cancellation (AbortController)
  - Race condition prevention (request versioning)
  - Cache checking (client-side cache before API call)
  - Fallback to cached results on network errors
- Returns: `{spans, meta, status, error, refresh}`
- Status: `'idle' | 'loading' | 'refreshing' | 'success' | 'error' | 'stale'`

**`client/src/features/span-highlighting/api/spanLabelingApi.js`** (83 lines)
- API client for `/llm/label-spans`
- Handles fetch, error parsing, response normalization
- Supports AbortSignal for cancellation

**`client/src/features/span-highlighting/hooks/useHighlightRendering.js`**
- Renders highlights in the DOM
- Diff-based rendering: only updates changed spans
- Process:
  1. Validates spans and text
  2. Processes and sorts spans
  3. Removes deleted spans
  4. Updates modified spans
  5. Adds new spans
- Uses `createHighlightWrapper()` to wrap text nodes with `<span>` elements

**`client/src/features/span-highlighting/utils/domManipulation.js`**
- `createHighlightWrapper()`: Creates `<span>` wrapper with:
  - CSS class based on category
  - Dataset attributes (`data-category`, `data-start`, `data-end`, etc.)
  - Color styles from taxonomy
- `enhanceWrapperWithMetadata()`: Adds additional metadata

**`client/src/features/span-highlighting/utils/categoryValidators.js`**
- Validates spans on the frontend (structural checks only)
- Checks taxonomy IDs, text presence, basic structure
- Trusts backend for semantic categorization

**`client/src/features/span-highlighting/services/SpanLabelingCache.js`**
- Client-side cache (in-memory Map + localStorage)
- Cache key includes: text hash + policy + templateVersion + maxSpans + minConfidence
- Provides fast lookup before API calls

**`client/src/features/span-highlighting/hooks/useHighlightSourceSelection.js`**
- Determines which span source to use (priority):
  1. Draft spans (from parallel draft execution)
  2. Refined spans (after refinement completes)
  3. Persisted spans (from history/storage)

**`client/src/features/span-highlighting/config/highlightStyles.js`**
- Maps category IDs to CSS classes and colors
- Uses taxonomy colors for visual consistency

### Data Flow

```
User Types Text
    ↓
useSpanLabeling Hook (debounced)
    ↓
Check Client Cache → Cache Hit? Return immediately
    ↓ (Cache Miss)
SpanLabelingApi.labelSpans()
    ↓
POST /llm/label-spans
    ↓
labelSpansRoute Handler
    ↓
Check Server Cache (Redis/Memory) → Cache Hit? Return (<5ms)
    ↓ (Cache Miss)
SpanLabelingService.labelSpans()
    ↓
Build System Prompt (from taxonomy.js)
    ↓
Call LLM via AIModelService
    ↓
Parse JSON Response
    ↓
Schema Validation
    ↓
Span Validation (6-phase pipeline)
    ↓
Return {spans, meta}
    ↓
Store in Server Cache
    ↓
Return to Frontend
    ↓
Store in Client Cache
    ↓
useHighlightRendering Hook
    ↓
Render Highlights in DOM
```

### Key Design Patterns

1. Cache-aside: Check cache before LLM call
2. Progressive enhancement: Fallback to cached results on errors
3. Diff-based rendering: Only update changed DOM nodes
4. Request cancellation: Cancel in-flight requests on new input
5. Race condition prevention: Version tracking for requests
6. Dynamic taxonomy: System prompt generated from `taxonomy.js` at runtime

### Performance Optimizations

- Server-side caching: 70-90% cache hit rate, <5ms response time
- Client-side caching: Instant results for previously seen text
- Debouncing: Reduces API calls during typing
- Chunking: Processes large texts in parallel chunks
- Position caching: Fast substring lookups during validation
- Diff rendering: Minimal DOM updates

This architecture separates concerns, uses caching, and provides a responsive user experience.

```plaintext
User Types Text
    ↓
useSpanLabeling Hook (debounced)
    ↓
Check Client Cache → Cache Hit? Return immediately
    ↓ (Cache Miss)
SpanLabelingApi.labelSpans()
    ↓
POST /llm/label-spans
    ↓
labelSpansRoute Handler
    ↓
Check Server Cache (Redis/Memory) → Cache Hit? Return (<5ms)
    ↓ (Cache Miss)
SpanLabelingService.labelSpans()
    ↓
Build System Prompt (from taxonomy.js)
    ↓
Call LLM via AIModelService
    ↓
Parse JSON Response
    ↓
Schema Validation
    ↓
Span Validation (6-phase pipeline)
    ↓
Return {spans, meta}
    ↓
Store in Server Cache
    ↓
Return to Frontend
    ↓
Store in Client Cache
    ↓
useHighlightRendering Hook
    ↓
Render Highlights in DOM
```

---

**User**

what files contain any prompts being sent to the llm for anything span related?

---

**Cursor**


Searching for files that contain LLM prompts for span-related operations.



Checking the user payload builder to see what's sent to the LLM:



Files that contain prompts sent to the LLM for span-related operations:

## Primary Prompt Files

### 1. **`server/src/llm/span-labeling/templates/span-labeling-prompt.md`** (361 lines)
   - Main template file with instructions
   - Contains:
     - Taxonomy structure definitions
     - Role definitions with detection patterns
     - Categorization priority rules
     - Critical instructions
     - Example output format
     - Validation requirements
   - Used as the base template for the system prompt

### 2. **`server/src/llm/span-labeling/SpanLabelingService.js`** (lines 60-102, 189-193, 268-272)
   - **`buildSystemPrompt()` function** (lines 60-102):
     - Dynamically generates the system prompt at runtime
     - Combines taxonomy structure from `shared/taxonomy.js` with detection patterns from the template
     - Extracts sections from the template file
     - Builds the complete system prompt string
   - **`callModel()` function** (lines 111-121):
     - Sends `systemPrompt` and `userMessage` to the LLM
   - **Primary call** (lines 189-193):
     - Uses `BASE_SYSTEM_PROMPT` (generated at initialization)
     - Uses `buildUserPayload()` for the user message
   - **Repair attempt** (lines 268-272):
     - Adds validation feedback to the system prompt
     - Includes repair instructions

### 3. **`server/src/llm/span-labeling/utils/jsonUtils.js`** (lines 65-78)
   - **`buildUserPayload()` function**:
     - Constructs the user message payload
     - Includes: `task`, `policy`, `text`, `templateVersion`, and optional `validation` feedback
     - Returns JSON stringified payload

### 4. **`server/src/llm/span-labeling/utils/policyUtils.js`** (lines 86-88)
   - **`buildTaskDescription()` function**:
     - Creates the task instruction: `"Identify up to ${maxSpans} spans and assign roles."`
     - Included in the user payload

## How Prompts Are Constructed

**System Prompt** (sent as `systemPrompt`):
```
= Taxonomy structure (from taxonomy.js)
+ Detection patterns (from template file)
+ Rules section (from template file)
```

**User Message** (sent as `userMessage`):
```json
{
  "task": "Identify up to X spans and assign roles.",
  "policy": {...},
  "text": "The actual prompt text to analyze",
  "templateVersion": "v1",
  "validation": {...} // Only included for repair attempts
}
```

## Summary

- **Template**: `server/src/llm/span-labeling/templates/span-labeling-prompt.md`
- **System prompt builder**: `server/src/llm/span-labeling/SpanLabelingService.js` (`buildSystemPrompt()`)
- **User payload builder**: `server/src/llm/span-labeling/utils/jsonUtils.js` (`buildUserPayload()`)
- **Task description**: `server/src/llm/span-labeling/utils/policyUtils.js` (`buildTaskDescription()`)

The system prompt is generated at service initialization by combining the taxonomy with the template. The user message is built per request with the task, policy, text, and optional validation feedback.

```plaintext
= Taxonomy structure (from taxonomy.js)
+ Detection patterns (from template file)
+ Rules section (from template file)
```

```json
{
  "task": "Identify up to X spans and assign roles.",
  "policy": {...},
  "text": "The actual prompt text to analyze",
  "templateVersion": "v1",
  "validation": {...} // Only included for repair attempts
}
```

---

**User**

so how many different templates are sent to the llm throughout this process?

---

**Cursor**


Tracing the code to identify all prompt variations sent to the LLM:



Checking chunked processing to confirm it uses the same prompt:



There are 2 different system prompts sent to the LLM:

## System Prompts (2 variations)

### 1. **Base System Prompt** (`BASE_SYSTEM_PROMPT`)
   - Built once at service initialization (line 105)
   - Used for:
     - Initial span labeling (line 190)
     - Chunked processing (via `labelSpansSingle`, line 323)
   - Content:
     - Taxonomy structure (from `taxonomy.js`)
     - Detection patterns (from template file)
     - Rules section (from template file)

### 2. **Repair System Prompt** (`BASE_SYSTEM_PROMPT + repair instruction`)
   - Used only when `enableRepair === true` and validation fails (lines 268-271)
   - Content:
     - Same as base prompt
     - Plus: `"If validation feedback is provided, correct the issues without altering span text."`
   - Example:
     ```javascript
     systemPrompt: `${BASE_SYSTEM_PROMPT}

     If validation feedback is provided, correct the issues without altering span text.`
     ```

## User Messages (same structure, varying content)

The user message structure is consistent, but content varies:

**Standard user payload:**
```json
{
  "task": "Identify up to X spans and assign roles.",
  "policy": {...},
  "text": "The prompt text to analyze",
  "templateVersion": "v1"
}
```

**Repair user payload** (includes validation feedback):
```json
{
  "task": "Identify up to X spans and assign roles.",
  "policy": {...},
  "text": "The prompt text to analyze",
  "templateVersion": "v1",
  "validation": {
    "errors": [...],
    "originalResponse": {...},
    "instructions": "Fix the indices and roles described above without changing span text. Do not invent new spans."
  }
}
```

## Summary

- 2 system prompt variations:
  1. Base prompt (initial labeling)
  2. Base prompt + repair instruction (repair attempts)
- 1 user message structure (with optional validation field)
- Chunked processing uses the same prompts as single-pass processing

The repair prompt is the base prompt with one additional instruction appended.

```javascript
     systemPrompt: `${BASE_SYSTEM_PROMPT}

     If validation feedback is provided, correct the issues without altering span text.`
```

```json
{
  "task": "Identify up to X spans and assign roles.",
  "policy": {...},
  "text": "The prompt text to analyze",
  "templateVersion": "v1"
}
```

```json
{
  "task": "Identify up to X spans and assign roles.",
  "policy": {...},
  "text": "The prompt text to analyze",
  "templateVersion": "v1",
  "validation": {
    "errors": [...],
    "originalResponse": {...},
    "instructions": "Fix the indices and roles described above without changing span text. Do not invent new spans."
  }
}
```

---

**User**

which files explicity send those prompts?

---

**Cursor**


Finding files that explicitly send prompts to the LLM:



Checking where `labelSpans` is called with `aiService`:



Checking how PromptOptimizationService calls labelSpans:



Checking if PromptOptimizationService passes aiService to labelSpans:



Files that explicitly send prompts to the LLM:

## Primary file that sends prompts

### **`server/src/llm/span-labeling/SpanLabelingService.js`**

This file contains the function that sends prompts:

**`callModel()` function** (lines 111-121):
```javascript
async function callModel({ systemPrompt, userPayload, aiService, maxTokens }) {
  const response = await aiService.execute('span_labeling', {
    systemPrompt,
    userMessage: userPayload,
    maxTokens,
  });
  return response.content[0]?.text || '';
}
```

Called from two places in the same file:

1. Primary labeling call (line 189-193):
   ```javascript
   const primaryResponse = await callModel({
     systemPrompt: BASE_SYSTEM_PROMPT,
     userPayload: buildUserPayload(basePayload),
     aiService,
   });
   ```

2. Repair attempt call (line 268-273):
   ```javascript
   const repairResponse = await callModel({
     systemPrompt: `${BASE_SYSTEM_PROMPT}\n\nIf validation feedback is provided...`,
     userPayload: buildUserPayload(repairPayload),
     aiService,
   });
   ```

## Files that trigger prompt sending (indirectly)

These files call `labelSpans()`, which internally calls `callModel()`:

1. **`server/src/routes/labelSpansRoute.js`** (line 85)
   - HTTP route handler that calls `labelSpans(payload, aiService)`

2. **`server/src/services/prompt-optimization/PromptOptimizationService.js`** (line 114)
   - Calls `labelSpans()` for parallel span labeling during prompt optimization
   - Note: This call appears to be missing the `aiService` parameter, which may be a bug

## Summary

Only one file explicitly sends prompts: `server/src/llm/span-labeling/SpanLabelingService.js` via `callModel()`. It sends prompts in two scenarios:
- Initial labeling (base prompt)
- Repair attempt (base prompt + repair instruction)

The actual LLM API call happens through `aiService.execute('span_labeling', {...})`, which routes to the configured LLM client (Groq, OpenAI, etc.) based on `modelConfig.js`.

```javascript
async function callModel({ systemPrompt, userPayload, aiService, maxTokens }) {
  const response = await aiService.execute('span_labeling', {
    systemPrompt,
    userMessage: userPayload,
    maxTokens,
  });
  return response.content[0]?.text || '';
}
```

```javascript
   const primaryResponse = await callModel({
     systemPrompt: BASE_SYSTEM_PROMPT,
     userPayload: buildUserPayload(basePayload),
     aiService,
   });
```

```javascript
   const repairResponse = await callModel({
     systemPrompt: `${BASE_SYSTEM_PROMPT}\n\nIf validation feedback is provided...`,
     userPayload: buildUserPayload(repairPayload),
     aiService,
   });
```

---

**User**

ok then which files contain the prompts that are sent

---

**Cursor**


Identifying files that contain the prompt text sent to the LLM:



Files that contain the prompt text sent to the LLM:

## Files containing prompt content

### 1. **`server/src/llm/span-labeling/templates/span-labeling-prompt.md`** (361 lines)
   - Base template file
   - Contains:
     - Role definitions with detection patterns (lines 31-155)
     - Critical instructions (lines 212-243)
     - Rules section (lines 247-260)
     - Example output format (lines 258-352)
   - Extracted and used in the system prompt

### 2. **`server/src/llm/span-labeling/SpanLabelingService.js`**
   - Contains prompt assembly code:
   
   **`buildSystemPrompt()` function** (lines 60-102):
   - Assembles the system prompt
   - Contains hardcoded prompt text:
     ```javascript
     return `# Span Labeling System Prompt

     Label spans for AI video prompt elements using our unified taxonomy system.

     **IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanatory text, just pure JSON.**

     ## Taxonomy Structure
     ...
     `.trim();
     ```
   
   **Repair instruction** (lines 269-271):
   - Additional text appended for repair attempts:
     ```javascript
     systemPrompt: `${BASE_SYSTEM_PROMPT}

     If validation feedback is provided, correct the issues without altering span text.`
     ```

### 3. **`shared/taxonomy.js`** (559 lines)
   - Contains taxonomy structure
   - Contributes to the prompt via `buildSystemPrompt()`:
     - Parent category descriptions (lines 28-236)
     - Attribute IDs and labels
   - Dynamically injected into the system prompt

### 4. **`server/src/llm/span-labeling/utils/policyUtils.js`** (line 87)
   - Contains the task description template:
     ```javascript
     return `Identify up to ${maxSpans} spans and assign roles.`;
     ```
   - Included in the user message payload

### 5. **`server/src/llm/span-labeling/utils/jsonUtils.js`** (lines 65-78)
   - Contains `buildUserPayload()` function
   - Structures the user message payload
   - The actual text content comes from parameters passed in (not hardcoded here)

## Summary

Prompt content is located in:
1. `server/src/llm/span-labeling/templates/span-labeling-prompt.md` — Main template (detection patterns, rules, examples)
2. `server/src/llm/span-labeling/SpanLabelingService.js` — System prompt assembly + repair instruction
3. `shared/taxonomy.js` — Taxonomy structure (dynamically injected)
4. `server/src/llm/span-labeling/utils/policyUtils.js` — Task description template

The final prompts are assembled at runtime by combining these sources.

```javascript
     return `# Span Labeling System Prompt

     Label spans for AI video prompt elements using our unified taxonomy system.

     **IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanatory text, just pure JSON.**

     ## Taxonomy Structure
     ...
     `.trim();
```

```javascript
     systemPrompt: `${BASE_SYSTEM_PROMPT}

     If validation feedback is provided, correct the issues without altering span text.`
```

```javascript
     return `Identify up to ${maxSpans} spans and assign roles.`;
```

---

**User**

show me the final built prompt sent at runtime

---

**Cursor**


Tracing the code to show the final prompt sent at runtime:



Final prompt sent at runtime:

## **SYSTEM PROMPT** (sent as `systemPrompt`)

```
# Span Labeling System Prompt

Label spans for AI video prompt elements using our unified taxonomy system.

**IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanatory text, just pure JSON.**

## Taxonomy Structure

Our taxonomy has **8 parent categories**, each with specific attributes:

**PARENT CATEGORIES (use when general):**
- `shot` - Framing and vantage of the camera
- `subject` - The focal point of the shot
- `action` - What the subject is doing (one continuous action)
- `environment` - Where the scene takes place
- `lighting` - Illumination and atmosphere
- `camera` - Cinematography and framing
- `style` - Visual treatment and medium
- `technical` - Video technical parameters
- `audio` - Sound and music elements

**ATTRIBUTES (use when specific):**
- Shot Type: `shot.type`
- Subject & Character: `subject.identity`, `subject.appearance`, `subject.wardrobe`, `action.movement`, `subject.emotion`
- Action & Motion: `action.movement`, `action.state`, `action.gesture`
- Environment: `environment.location`, `environment.weather`, `environment.context`
- Lighting: `lighting.source`, `lighting.quality`, `lighting.timeOfDay`
- Camera: `camera.movement`, `camera.lens`, `camera.angle`
- Style & Aesthetic: `style.aesthetic`, `style.filmStock`
- Technical Specs: `technical.aspectRatio`, `technical.frameRate`, `technical.resolution`, `technical.duration`
- Audio: `audio.score`, `audio.soundEffect`

## Role Definitions with Detection Patterns

**shot.type**: Shot type / framing and vantage
- MUST specify: shot types, framing, or angle position
- Examples: "wide shot", "medium shot", "close-up", "bird's eye", "dutch angle"
- Pattern: shot/angle/framing terminology

**subject** or **subject.identity**: Main person/object/character being filmed (WHO or WHAT)
- MUST identify: person type, occupation, character, animal, or main object
- Examples: "young painter", "elderly historian", "siberian husky", "vintage car", "alien landscape"
- Pattern: Nouns with descriptors that identify the main focus
- Use `subject.identity` for specific identity, `subject` for general subject references

**subject.appearance**: Physical traits and characteristics of the subject
- MUST describe: facial features, body type, physical details, expressions
- Examples: "weathered hands", "focused expression", "athletic build", "piercing eyes", "gnarled hands", "weathered and calloused"
- Pattern: Physical descriptors, body parts, facial features, visible traits
- NOT: clothing (use subject.wardrobe) or held objects (use action.* context)

[... continues with all role definitions from template ...]

## Critical Instructions

**CATEGORIZATION PRIORITY - CHECK IN THIS ORDER:**
1. Check if text contains camera verbs (pan, dolly, track, zoom, crane) → `camera.movement`
2. Check if text contains shot types (close-up, wide, medium) or angles → `shot.type` (angles → `camera.angle` if explicitly angle)
3. Check if text contains FPS numbers, resolution (4k, 8k), aspect ratios (16:9) → use appropriate `technical.*` attribute
4. Check if text contains film stock references (35mm, 16mm) → `style.filmStock`
5. Check if text contains time of day (golden hour, dusk, dawn) → `lighting.timeOfDay`
6. Check if text contains -ing verbs describing subject action → `action.movement` (or `action.state`/`action.gesture`)
7. Check if text contains clothing/garments → `subject.wardrobe`
8. Check if text contains physical traits → `subject.appearance`
9. Check if text contains location/place descriptions → `environment.location`
10. Check all other specific attributes
11. Fall back to parent category if unsure which attribute to use

**PREFER SPECIFIC ATTRIBUTES OVER PARENT CATEGORIES:**
- Use `subject.wardrobe` instead of just `subject` for clothing
- Use `shot.type` instead of just `camera` for shot types
- Use `lighting.timeOfDay` instead of just `lighting` for time references
- Use parent categories only when the attribute is unclear or general

**MANDATORY FIELDS - ALL REQUIRED OR VALIDATION FAILS:**
1. Every span MUST include the "text" field with EXACT substring from input
2. Every span MUST include "role" field with valid taxonomy ID
3. Response MUST include "meta" object with "version" and "notes" fields
4. Never omit ANY required field - validation will reject incomplete responses

CRITICAL: **ANALYZE THE ENTIRE TEXT - DO NOT SKIP SECTIONS**
- Process EVERY section including **TECHNICAL SPECS** and **ALTERNATIVE APPROACHES**
- Extract ALL values from markdown lists: Duration, Aspect Ratio, Frame Rate, Audio
- Structured metadata sections contain the most important technical information
- Section headers like "**TECHNICAL SPECS**" are NOT spans - only extract the VALUES

MANDATORY: If you see a line like "- **Frame Rate:** 24fps", you MUST extract "24fps" as technical.frameRate

## Rules

- **REQUIRED: "text" field must contain exact substring (character-for-character match)**
- Use exact substrings from text (no paraphrasing)
- start/end = 0-based character offsets
- No overlaps unless explicitly allowed
- Descriptive spans ≤6 words (technical metadata like "24fps" or "16:9" can be shorter)
- Confidence in [0,1], use 0.7 if unsure
- Fewer meaningful spans > many trivial ones
- Use taxonomy IDs exactly as specified (e.g., "subject.wardrobe" not "wardrobe")

## Example Output
```json
{
  "spans": [
    {
      "text": "Close-up",
      "start": 0,
      "end": 8,
      "role": "shot.type",
      "confidence": 0.95
    },
    {
      "text": "gnarled hands",
      "start": 15,
      "end": 28,
      "role": "subject.appearance",
      "confidence": 0.9
    },
    ...
  ],
  "meta": {
    "version": "v2-taxonomy",
    "notes": "Labeled 11 spans using unified taxonomy IDs"
  }
}
```

**VALIDATION REQUIREMENTS - STRICTLY ENFORCED:**
- Response MUST have TWO top-level keys: "spans" and "meta"
- Every span MUST have: text, start, end, role, confidence
- The "role" field MUST be a valid taxonomy ID (parent or attribute)
- The "meta" object MUST have: version, notes
- Missing ANY required field = validation error = request fails
- Output ONLY valid JSON (no markdown, no explanatory text)
```

---

## **USER MESSAGE** (sent as `userMessage`)

**For Initial Labeling:**
```json
{
  "task": "Identify up to 60 spans and assign roles.",
  "policy": {
    "nonTechnicalWordLimit": 6,
    "allowOverlap": false
  },
  "text": "Close-up of weathered hands holding a vibrant brush, palette of bold colors. The camera slowly pans back, illuminated by the warm glow of a setting sun, reminiscent of a high-contrast urban documentary.\n\n**TECHNICAL SPECS**\n- **Duration:** 4-8s\n- **Aspect Ratio:** 16:9\n- **Frame Rate:** 24fps",
  "templateVersion": "v2"
}
```

**For Repair Attempt** (when validation fails):
```json
{
  "task": "Identify up to 60 spans and assign roles.",
  "policy": {
    "nonTechnicalWordLimit": 6,
    "allowOverlap": false
  },
  "text": "Close-up of weathered hands holding a vibrant brush...",
  "templateVersion": "v2",
  "validation": {
    "errors": [
      "span[0] indices auto-adjusted from 0-7 to 0-8",
      "span[2] text \"holding a vibrant brush\" not found in source"
    ],
    "originalResponse": {
      "spans": [...],
      "meta": {...}
    },
    "instructions": "Fix the indices and roles described above without changing span text. Do not invent new spans."
  }
}
```

---

## **Repair System Prompt** (when repair is enabled)

Same as base system prompt, plus:

```
If validation feedback is provided, correct the issues without altering span text.
```

---

## **How It's Sent**

The final API call looks like:
```javascript
aiService.execute('span_labeling', {
  systemPrompt: BASE_SYSTEM_PROMPT,  // The full system prompt above
  userMessage: JSON.stringify(userPayload),  // The JSON payload above
  maxTokens: 4096,  // From modelConfig.js
  temperature: 0.2,  // From modelConfig.js
  responseFormat: 'json_object'  // From modelConfig.js
})
```

The taxonomy count (currently 8) and attribute lists are dynamically generated from `taxonomy.js` at service initialization, so they update automatically if the taxonomy changes.

```plaintext
# Span Labeling System Prompt

Label spans for AI video prompt elements using our unified taxonomy system.

**IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanatory text, just pure JSON.**

## Taxonomy Structure

Our taxonomy has **8 parent categories**, each with specific attributes:

**PARENT CATEGORIES (use when general):**
- `shot` - Framing and vantage of the camera
- `subject` - The focal point of the shot
- `action` - What the subject is doing (one continuous action)
- `environment` - Where the scene takes place
- `lighting` - Illumination and atmosphere
- `camera` - Cinematography and framing
- `style` - Visual treatment and medium
- `technical` - Video technical parameters
- `audio` - Sound and music elements

**ATTRIBUTES (use when specific):**
- Shot Type: `shot.type`
- Subject & Character: `subject.identity`, `subject.appearance`, `subject.wardrobe`, `action.movement`, `subject.emotion`
- Action & Motion: `action.movement`, `action.state`, `action.gesture`
- Environment: `environment.location`, `environment.weather`, `environment.context`
- Lighting: `lighting.source`, `lighting.quality`, `lighting.timeOfDay`
- Camera: `camera.movement`, `camera.lens`, `camera.angle`
- Style & Aesthetic: `style.aesthetic`, `style.filmStock`
- Technical Specs: `technical.aspectRatio`, `technical.frameRate`, `technical.resolution`, `technical.duration`
- Audio: `audio.score`, `audio.soundEffect`

## Role Definitions with Detection Patterns

**shot.type**: Shot type / framing and vantage
- MUST specify: shot types, framing, or angle position
- Examples: "wide shot", "medium shot", "close-up", "bird's eye", "dutch angle"
- Pattern: shot/angle/framing terminology

**subject** or **subject.identity**: Main person/object/character being filmed (WHO or WHAT)
- MUST identify: person type, occupation, character, animal, or main object
- Examples: "young painter", "elderly historian", "siberian husky", "vintage car", "alien landscape"
- Pattern: Nouns with descriptors that identify the main focus
- Use `subject.identity` for specific identity, `subject` for general subject references

**subject.appearance**: Physical traits and characteristics of the subject
- MUST describe: facial features, body type, physical details, expressions
- Examples: "weathered hands", "focused expression", "athletic build", "piercing eyes", "gnarled hands", "weathered and calloused"
- Pattern: Physical descriptors, body parts, facial features, visible traits
- NOT: clothing (use subject.wardrobe) or held objects (use action.* context)

[... continues with all role definitions from template ...]

## Critical Instructions

**CATEGORIZATION PRIORITY - CHECK IN THIS ORDER:**
1. Check if text contains camera verbs (pan, dolly, track, zoom, crane) → `camera.movement`
2. Check if text contains shot types (close-up, wide, medium) or angles → `shot.type` (angles → `camera.angle` if explicitly angle)
3. Check if text contains FPS numbers, resolution (4k, 8k), aspect ratios (16:9) → use appropriate `technical.*` attribute
4. Check if text contains film stock references (35mm, 16mm) → `style.filmStock`
5. Check if text contains time of day (golden hour, dusk, dawn) → `lighting.timeOfDay`
6. Check if text contains -ing verbs describing subject action → `action.movement` (or `action.state`/`action.gesture`)
7. Check if text contains clothing/garments → `subject.wardrobe`
8. Check if text contains physical traits → `subject.appearance`
9. Check if text contains location/place descriptions → `environment.location`
10. Check all other specific attributes
11. Fall back to parent category if unsure which attribute to use

**PREFER SPECIFIC ATTRIBUTES OVER PARENT CATEGORIES:**
- Use `subject.wardrobe` instead of just `subject` for clothing
- Use `shot.type` instead of just `camera` for shot types
- Use `lighting.timeOfDay` instead of just `lighting` for time references
- Use parent categories only when the attribute is unclear or general

**MANDATORY FIELDS - ALL REQUIRED OR VALIDATION FAILS:**
1. Every span MUST include the "text" field with EXACT substring from input
2. Every span MUST include "role" field with valid taxonomy ID
3. Response MUST include "meta" object with "version" and "notes" fields
4. Never omit ANY required field - validation will reject incomplete responses

CRITICAL: **ANALYZE THE ENTIRE TEXT - DO NOT SKIP SECTIONS**
- Process EVERY section including **TECHNICAL SPECS** and **ALTERNATIVE APPROACHES**
- Extract ALL values from markdown lists: Duration, Aspect Ratio, Frame Rate, Audio
- Structured metadata sections contain the most important technical information
- Section headers like "**TECHNICAL SPECS**" are NOT spans - only extract the VALUES

MANDATORY: If you see a line like "- **Frame Rate:** 24fps", you MUST extract "24fps" as technical.frameRate

## Rules

- **REQUIRED: "text" field must contain exact substring (character-for-character match)**
- Use exact substrings from text (no paraphrasing)
- start/end = 0-based character offsets
- No overlaps unless explicitly allowed
- Descriptive spans ≤6 words (technical metadata like "24fps" or "16:9" can be shorter)
- Confidence in [0,1], use 0.7 if unsure
- Fewer meaningful spans > many trivial ones
- Use taxonomy IDs exactly as specified (e.g., "subject.wardrobe" not "wardrobe")

## Example Outputson
{
  "spans": [
    {
      "text": "Close-up",
      "start": 0,
      "end": 8,
      "role": "shot.type",
      "confidence": 0.95
    },
    {
      "text": "gnarled hands",
      "start": 15,
      "end": 28,
      "role": "subject.appearance",
      "confidence": 0.9
    },
    ...
  ],
  "meta": {
    "version": "v2-taxonomy",
    "notes": "Labeled 11 spans using unified taxonomy IDs"
  }
}**VALIDATION REQUIREMENTS - STRICTLY ENFORCED:**
- Response MUST have TWO top-level keys: "spans" and "meta"
- Every span MUST have: text, start, end, role, confidence
- The "role" field MUST be a valid taxonomy ID (parent or attribute)
- The "meta" object MUST have: version, notes
- Missing ANY required field = validation error = request fails
- Output ONLY valid JSON (no markdown, no explanatory text)
```

```plaintext
{
  "task": "Identify up to 60 spans and assign roles.",
  "policy": {
    "nonTechnicalWordLimit": 6,
    "allowOverlap": false
  },
  "text": "Close-up of weathered hands holding a vibrant brush, palette of bold colors. The camera slowly pans back, illuminated by the warm glow of a setting sun, reminiscent of a high-contrast urban documentary.\n\n**TECHNICAL SPECS**\n- **Duration:** 4-8s\n- **Aspect Ratio:** 16:9\n- **Frame Rate:** 24fps",
  "templateVersion": "v2"
}lateVersion": "v2"
}

```

```json
{
  "task": "Identify up to 60 spans and assign roles.",
  "policy": {
    "nonTechnicalWordLimit": 6,
    "allowOverlap": false
  },
  "text": "Close-up of weathered hands holding a vibrant brush, palette of bold colors. The camera slowly pans back, illuminated by the warm glow of a setting sun, reminiscent of a high-contrast urban documentary.\n\n**TECHNICAL SPECS**\n- **Duration:** 4-8s\n- **Aspect Ratio:** 16:9\n- **Frame Rate:** 24fps",
  "templateVersion": "v2"
}lateVersion": "v2"
}

```

```json
{
  "task": "Identify up to 60 spans and assign roles.",
  "policy": {
    "nonTechnicalWordLimit": 6,
    "allowOverlap": false
  },
  "text": "Close-up of weathered hands holding a vibrant brush...",
  "templateVersion": "v2",
  "validation": {
    "errors": [
      "span[0] indices auto-adjusted from 0-7 to 0-8",
      "span[2] text \"holding a vibrant brush\" not found in source"
    ],
    "originalResponse": {
      "spans": [...],
      "meta": {...}
    },
    "instructions": "Fix the indices and roles described above without changing span text. Do not invent new spans."
  }
}
```

```plaintext
If validation feedback is provided, correct the issues without altering span text.
```

```javascript
aiService.execute('span_labeling', {
  systemPrompt: BASE_SYSTEM_PROMPT,  // The full system prompt above
  userMessage: JSON.stringify(userPayload),  // The JSON payload above
  maxTokens: 4096,  // From modelConfig.js
  temperature: 0.2,  // From modelConfig.js
  responseFormat: 'json_object'  // From modelConfig.js
})
```

