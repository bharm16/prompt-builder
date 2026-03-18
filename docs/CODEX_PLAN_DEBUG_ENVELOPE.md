# Codex Task: Enhancement Debug Response Envelope

## Goal
Add a dev-only debug mode to the enhancement suggestions endpoint that returns the full pipeline context (prompt text, selected span, category, system prompt sent to LLM, raw AI output, final processed suggestions) in the API response. This enables copy-pasting the full context into an analysis prompt for suggestion quality evaluation.

## Trigger Mechanism
- Server: Accept `x-debug: true` request header (not query param — cleaner for POST requests)
- Client: Automatically send this header when `import.meta.env.DEV` is true
- Server: Gate on `NODE_ENV !== 'production'` — never include debug data in production even if the header is sent

## Architecture Overview

The data flows through this chain:
```
Client click → useSuggestionFetch → useSuggestionApi → feature API (enhancementSuggestionsApi.ts)
  → shared API (api/enhancementSuggestionsApi.ts) → POST /api/get-enhancement-suggestions
  → enhancementSuggestionsRoute.ts → EnhancementService.getEnhancementSuggestions()
  → response back through the same chain
```

Debug context needs to be:
1. Collected in `EnhancementService.getEnhancementSuggestions()` (where all data is available)
2. Attached to the response in the route handler
3. Passed through the client API layer
4. Stored in component state
5. Rendered as a "Copy Debug" button in the suggestions panel

---

## File Changes (7 files)

### 1. `server/src/services/enhancement/services/types.ts`

**Add `EnhancementDebugContext` interface:**
```typescript
export interface EnhancementDebugContext {
  fullPrompt: string;
  selectedSpan: string;
  category: string | null;
  categoryConfidence: number | null;
  systemPromptSent: string;
  design: string;           // 'orthogonal' | 'visual' | 'narrative'
  slot: string;             // resolved slot label
  isVideoPrompt: boolean;
  isPlaceholder: boolean;
  modelTarget: string | null;
  promptSection: string | null;
  phraseRole: string | null;
  rawAiSuggestions: Suggestion[];
  finalSuggestions: Suggestion[];
  processingNotes: {
    contrastiveDecoding: boolean;
    diversityEnforced: boolean;
    alignmentFallback: boolean;
    usedFallback: boolean;
    fallbackSourceCount: number;
  };
  spanContext: {
    spanAnchors: string;
    nearbySpanHints: string;
  };
  videoConstraints: VideoConstraints | null;
  temperature: number;
  metrics: EnhancementMetrics;
}
```

**Add `debug?: boolean` to `EnhancementRequestParams`:**
```typescript
export interface EnhancementRequestParams {
  // ... existing fields ...
  debug?: boolean;  // NEW
}
```

**Add `_debug` to `EnhancementResult`:**
```typescript
export interface EnhancementResult {
  // ... existing fields ...
  _debug?: EnhancementDebugContext;  // NEW - dev only
}
```

### 2. `server/src/services/enhancement/EnhancementService.ts`

**In `getEnhancementSuggestions` method:**

Add `debug` to the destructured params (it's already in `EnhancementRequestParams` after step 1).

The key hook point is between the generation and the final return. All the variables needed are already in scope at that point. Here's what to collect:

After `promptResult` is built (~line where `const promptResult = isPlaceholder ? ...`):
- Capture `promptResult` as `systemPromptSent` (it's a string — the actual system prompt)

After `generationResult` comes back:
- Capture `generationResult.suggestions` as `rawAiSuggestions` (clone it — it gets mutated later)

After `processingResult` comes back:
- Capture `processingResult.suggestionsToUse` as `finalSuggestions`
- Capture `processingResult.alignmentFallbackApplied`, `processingResult.usedFallback`, `processingResult.fallbackSourceCount`

The design/slot info isn't directly available since `CleanPromptBuilder._buildSpanPrompt` is private. Two options:
- **Option A (recommended):** Skip `design` and `slot` in the debug output for now. They're derivable from `highlightedCategory` + `phraseRole` anyway.
- **Option B:** Make `CleanPromptBuilder` also return the resolved slot/design. This is a bigger refactor — don't do this.

**Implementation pattern:**
```typescript
// After the final result is built, before caching:
if (debug && process.env.NODE_ENV !== 'production') {
  result._debug = {
    fullPrompt,
    selectedSpan: highlightedText,
    category: highlightedCategory ?? null,
    categoryConfidence: highlightedCategoryConfidence ?? null,
    systemPromptSent: typeof promptResult === 'string' ? promptResult : promptResult.systemPrompt,
    design: '', // skip for now
    slot: '',   // skip for now
    isVideoPrompt,
    isPlaceholder,
    modelTarget,
    promptSection,
    phraseRole,
    rawAiSuggestions: [...(suggestions ?? [])],  // clone before processing mutates
    finalSuggestions: [...processingResult.suggestionsToUse],
    processingNotes: {
      contrastiveDecoding: generationResult.usedContrastiveDecoding,
      diversityEnforced: processingResult.suggestionsToUse.length !== (suggestions?.length ?? 0),
      alignmentFallback: processingResult.alignmentFallbackApplied,
      usedFallback: processingResult.usedFallback,
      fallbackSourceCount: processingResult.fallbackSourceCount,
    },
    spanContext: {
      spanAnchors: spanContext.spanAnchors,
      nearbySpanHints: spanContext.nearbySpanHints,
    },
    videoConstraints: videoConstraints ?? null,
    temperature,
    metrics: { ...metrics },
  };
}
```

**IMPORTANT:** The `rawAiSuggestions` clone MUST happen right after `generationResult` returns, BEFORE `processingResult` runs. Store it in a local variable like `const rawSuggestionsSnapshot = [...(suggestions ?? [])];` immediately after `const suggestions = generationResult.suggestions;`. Then reference `rawSuggestionsSnapshot` in the debug block.

**Cache consideration:** Do NOT cache the `_debug` field. The debug data should be stripped before caching, or (simpler) just skip adding `_debug` when the result comes from cache. The current code already returns early on cache hit before the debug block would run, so this is handled naturally.

### 3. `server/src/routes/enhancement/enhancementSuggestionsRoute.ts`

**Pass debug flag through to the service:**

In the route handler, extract the debug header and pass it to the service:

```typescript
const debug = req.headers['x-debug'] === 'true' && process.env.NODE_ENV !== 'production';

const result = await enhancementService.getEnhancementSuggestions({
  // ... existing fields ...
  debug,  // NEW
});
```

No other changes needed — the `_debug` field on the result will be serialized by `res.json(result)` automatically.

### 4. `client/src/api/enhancementSuggestionsApi.ts`

**Update `EnhancementSuggestionsResponse` type:**
```typescript
export interface EnhancementSuggestionsResponse<TSuggestion = string> {
  suggestions: TSuggestion[];
  isPlaceholder: boolean;
  metadata?: Record<string, unknown> | null;
  _debug?: Record<string, unknown> | null;  // NEW
}
```

**In `requestEnhancementSuggestions`, add the debug header in dev mode:**
```typescript
const authHeaders = await buildFirebaseAuthHeaders();
const debugHeaders = import.meta.env.DEV ? { 'x-debug': 'true' } : {};

const response = await fetchFn('/api/get-enhancement-suggestions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...debugHeaders,  // NEW
  },
  // ...
});
```

**In `parseEnhancementSuggestionsResponse`, preserve `_debug`:**
```typescript
return {
  suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
  isPlaceholder: data?.isPlaceholder ?? false,
  ...(data?.metadata ? { metadata: data.metadata } : {}),
  ...(data?._debug ? { _debug: data._debug } : {}),  // NEW
};
```

### 5. `client/src/features/prompt-optimizer/api/enhancementSuggestionsApi.ts`

**Preserve `_debug` in the return value:**

In `fetchEnhancementSuggestions`, the return block currently strips to `suggestions`, `isPlaceholder`, `metadata`. Add `_debug`:

```typescript
return {
  suggestions: data.suggestions || [],
  isPlaceholder: data.isPlaceholder || false,
  ...(data.metadata ? { metadata: data.metadata } : {}),
  ...(data._debug ? { _debug: data._debug } : {}),  // NEW
};
```

### 6. `client/src/features/prompt-optimizer/PromptOptimizerContainer/hooks/useSuggestionFetch.ts`

**Store `_debug` in suggestions data state:**

In the success handler where `setSuggestionsData` is called after fetch completes, add `_debug` to the `responseMetadata` (which already exists as a `Record<string, unknown> | null`):

```typescript
setSuggestionsData((prev) => {
  if (!prev) return prev;
  return {
    ...prev,
    suggestions: cachedResult.suggestions ?? [],
    isLoading: false,
    isError: false,
    errorMessage: null,
    isPlaceholder: cachedResult.isPlaceholder,
    responseMetadata: {
      ...(cachedResult.metadata ?? {}),
      ...(cachedResult._debug ? { _debug: cachedResult._debug } : {}),  // NEW
    },
    onRetry: retryFn,
  };
});
```

Also check `useSuggestionCache.ts` — the `RawEnhancementSuggestionsResponse` type there may need `_debug` added so it passes through the cache layer properly. The cache stores the raw response and replays it, so `_debug` should be included in the cached type.

### 7. `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasSuggestionsPanel.tsx`

**Add a "Copy Debug" button (dev-only):**

This is a small addition to the suggestions panel header. It should:
- Only render when `import.meta.env.DEV` is true
- Only render when `responseMetadata?._debug` exists
- Copy the `_debug` object as formatted JSON to clipboard on click
- Show brief visual feedback ("Copied!")

Add `responseMetadata` to the component's props type (it may need to be threaded from the parent — check `PromptCanvasView.types.ts`).

```tsx
{import.meta.env.DEV && responseMetadata?._debug && (
  <button
    type="button"
    className="text-label-xs text-muted hover:text-foreground transition-colors"
    onClick={() => {
      navigator.clipboard.writeText(
        JSON.stringify(responseMetadata._debug, null, 2)
      );
      // Optional: brief toast or text swap to "Copied!"
    }}
  >
    Copy Debug
  </button>
)}
```

Place this in the panel header, next to the existing suggestion count badge.

---

## Prop Threading Note

The `responseMetadata` needs to flow from `SuggestionsData` (in the container) down to `PromptCanvasSuggestionsPanel`. Check the intermediate components:
- `PromptCanvasView.types.ts` — may need `responseMetadata` added to `PromptCanvasViewProps`
- `PromptCanvasView.tsx` — may need to pass it through

If the threading is complex, an alternative is to just use `window.__VIDRA_DEBUG__` as a dev-only global that gets set in `useSuggestionFetch` and read in the panel. Simpler but less clean.

---

## Testing

1. Start dev server (`npm start`)
2. Type/paste a video prompt in the editor
3. Click any highlighted span
4. Wait for suggestions to load
5. Verify "Copy Debug" button appears in the suggestions panel header
6. Click it, paste into a text editor, verify the JSON contains:
   - `fullPrompt` — the complete user prompt
   - `selectedSpan` — the clicked text
   - `category` — e.g., "environment.location"
   - `systemPromptSent` — the actual prompt sent to the LLM (long string)
   - `rawAiSuggestions` — array of suggestions before processing
   - `finalSuggestions` — array after processing
   - `processingNotes` — which pipeline stages fired
7. Verify the button does NOT appear in production builds

## Non-Goals
- No changes to the prompt generation logic itself
- No changes to suggestion quality or processing
- No new dependencies
- No new env vars needed (uses existing `NODE_ENV` and `import.meta.env.DEV`)
