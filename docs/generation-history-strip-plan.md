# Generation History Strip & Suggestion Pills — Implementation Plan

## Problem Statement

The canvas-first layout has five interconnected gaps:

1. **No generation output navigation.** The left strip (`CanvasVersionStrip`) shows prompt versions, not generation outputs. There's no way to switch between multiple videos or review previous storyboard previews.

2. **Storyboard frames are too small and ephemeral.** The floating `StoryboardStrip` overlay uses 72×44px thumbnails — too small to evaluate prompt quality. Frames are permanently lost on dismiss. Only the latest storyboard is shown; all previous preview runs are inaccessible.

3. **No multi-video navigation.** If a user generates multiple videos (drafts + renders), only the latest non-storyboard generation appears in the hero canvas. Previous videos are invisible.

4. **Span suggestion pills are missing.** `CanvasWorkspace` doesn't receive or render inline suggestion data. When a user clicks a highlighted semantic span, nothing happens — the click-to-enhance flow that works in the traditional layout is completely absent.

5. **Prompt version history lost.** When the left strip is repurposed for generations, prompt version navigation needs a new home.

## Architecture Decision

**Left strip becomes generation output history.** Each generation (video, storyboard set, pending) gets a thumbnail entry. Clicking selects it and the hero canvas renders that generation's content. Storyboard sets render as a frame grid in the hero canvas at full size, replacing the tiny floating overlay.

**Suggestion pills render below the prompt editor** inside `CanvasPromptBar`, in a collapsible suggestions tray that appears when a span is selected and has suggestions loaded.

---

## Fix 1: Rewire Left Strip to Generation Outputs

### Data source change

**Current:** `CanvasVersionStrip` takes `PromptVersionEntry[]` from `versionsPanelProps`
**Target:** New `CanvasGenerationStrip` takes `Generation[]` from `GenerationsPanelStateSnapshot`

### New component: `CanvasGenerationStrip.tsx`

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/components/CanvasGenerationStrip.tsx`

**Props:**
```ts
interface CanvasGenerationStripProps {
  generations: Generation[];
  selectedGenerationId: string | null;
  onSelectGeneration: (generationId: string) => void;
}
```

**Behavior:**
- Renders in same absolute position as current `CanvasVersionStrip` (`absolute left-5 top-1/2 z-20 -translate-y-[60%]`)
- Each generation gets a 57×57px thumbnail button
- Video generations: show `thumbnailUrl` or first `mediaUrls` entry as poster, with a small play icon overlay and tier badge ("D" for draft, "R" for render)
- Image-sequence generations: show first frame with a stacked-frames icon overlay (small grid icon or "4" badge)
- Pending/generating: show pulsing skeleton placeholder with a spinner
- Failed: show error icon overlay
- Newest generation at top
- Selected generation has `border-[#E2E6EF]` (same as current active version)
- Label: tier abbreviation + index (e.g., "D1", "R1", "P1" for preview/storyboard)

**Thumbnail resolution:**
```ts
const resolveThumbnail = (generation: Generation): string | null => {
  if (generation.thumbnailUrl) return generation.thumbnailUrl;
  if (generation.mediaUrls.length > 0) return generation.mediaUrls[0];
  return null;
};
```

### State management: `selectedGenerationId`

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/CanvasWorkspace.tsx`

Add local state in `CanvasWorkspace`:
```ts
const [selectedGenerationId, setSelectedGenerationId] = useState<string | null>(null);
```

**Auto-select logic:** When a new generation completes (detect via snapshot change), auto-select it:
```ts
useEffect(() => {
  if (!snapshot?.generations?.length) return;
  const completed = snapshot.generations
    .filter(g => g.status === 'completed')
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
  const latest = completed[0];
  if (latest && latest.id !== selectedGenerationId) {
    setSelectedGenerationId(latest.id);
  }
}, [snapshot?.generations]);
// Note: intentionally exclude selectedGenerationId from deps to only auto-select on new completions.
// eslint-disable-next-line react-hooks/exhaustive-deps — add suppression comment
```

**Manual select:** Clicking a strip thumbnail calls `setSelectedGenerationId(id)`.

### Replace in CanvasWorkspace

- Remove `<CanvasVersionStrip>` render
- Remove `versionsPanelProps` usage for the left strip (keep it in props for now; version nav moves in Fix 5)
- Add `<CanvasGenerationStrip>` in the same position, passing `snapshot.generations`, `selectedGenerationId`, `setSelectedGenerationId`

---

## Fix 2: Hero Canvas Renders Selected Generation

### Derive `selectedGeneration` in `CanvasWorkspace`

```ts
const selectedGeneration = useMemo(() => {
  if (!snapshot?.generations?.length) return null;
  if (selectedGenerationId) {
    const match = snapshot.generations.find(g => g.id === selectedGenerationId);
    if (match) return match;
  }
  // Fallback: latest completed non-storyboard, then latest completed anything
  const completed = snapshot.generations
    .filter(g => g.status === 'completed')
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
  return completed[0] ?? null;
}, [snapshot?.generations, selectedGenerationId]);
```

### Hero rendering modes

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/CanvasWorkspace.tsx`

Replace the current hero canvas section. Instead of always rendering `<GenerationsPanel presentation="hero">`, the hero area now branches based on selected generation type:

```tsx
{/* Hero canvas content */}
<div className="relative mx-auto w-[55%]">
  {selectedGeneration?.mediaType === 'image-sequence' ? (
    <StoryboardHeroView
      generation={selectedGeneration}
      onUseAsStartFrame={handleUseStoryboardFrame}
    />
  ) : (
    <GenerationsPanel
      {...generationsPanelProps}
      presentation="hero"
      onStateSnapshot={handleSnapshot}
      className="h-auto"
    />
  )}
</div>
```

**Important:** `GenerationsPanel` still needs to render for non-storyboard selections. Its internal `heroGeneration` memo already handles filtering. However, we need to sync which generation it shows with `selectedGenerationId`. Two approaches:

**Option A (recommended): Pass `selectedGenerationId` as a new prop to GenerationsPanel.**
Add optional `heroOverrideGenerationId?: string` to `GenerationsPanelProps`. In the hero branch of `GenerationsPanel`, if `heroOverrideGenerationId` is provided, use that instead of the `heroGeneration` memo. This keeps GenerationsPanel as the single source of truth for rendering generation cards while allowing external selection.

**Option B: Render GenerationCard directly in CanvasWorkspace.**
Skip GenerationsPanel for hero mode entirely and render `<GenerationCard generation={selectedGeneration} .../>` directly. Cleaner separation but requires CanvasWorkspace to own all the GenerationCard callback props (retry, delete, download, etc).

**Decision for Codex: Use Option A.** It's the smaller change — add one optional prop and a 3-line conditional in the existing hero branch. All existing callback wiring stays in GenerationsPanel.

### New prop on GenerationsPanelProps

**File:** `client/src/features/prompt-optimizer/GenerationsPanel/types.ts`

```ts
// Add to GenerationsPanelProps:
heroOverrideGenerationId?: string | null | undefined;
```

### Wire in GenerationsPanel hero branch

**File:** `client/src/features/prompt-optimizer/GenerationsPanel/GenerationsPanel.tsx`

Modify `heroGeneration` memo:
```ts
const heroGeneration = useMemo(() => {
  // If external selection provided, honor it (but still exclude image-sequences)
  if (heroOverrideGenerationId) {
    const override = generations.find(g => g.id === heroOverrideGenerationId);
    if (override && override.mediaType !== 'image-sequence') return override;
  }
  // Existing fallback logic
  if (activeGeneration && activeGeneration.mediaType !== 'image-sequence') {
    return activeGeneration;
  }
  const nonStoryboard = generations.filter(g => g.mediaType !== 'image-sequence');
  return nonStoryboard[nonStoryboard.length - 1] ?? null;
}, [activeGeneration, generations, heroOverrideGenerationId]);
```

### New component: `StoryboardHeroView.tsx`

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/components/StoryboardHeroView.tsx`

**Props:**
```ts
interface StoryboardHeroViewProps {
  generation: Generation;
  onUseAsStartFrame: (frame: KeyframeTile) => void;
}
```

**Renders:** A 2×2 grid of frames at full hero canvas size. Each frame is clickable to select it. Selected frame has accent border. "Use as start frame" button below the grid or in a toolbar overlay.

**Layout:**
```tsx
<div className="flex flex-col gap-3 rounded-2xl bg-[#0D0E12] p-3">
  {/* 2×2 grid */}
  <div className="grid grid-cols-2 gap-2">
    {generation.mediaUrls.map((url, index) => (
      <button
        key={`${generation.id}-frame-${index}`}
        type="button"
        onClick={() => setSelectedIndex(index)}
        className={cn(
          'aspect-video overflow-hidden rounded-lg border-2 transition-all',
          selectedIndex === index
            ? 'border-[#6C5CE7] shadow-[0_0_16px_#6C5CE744]'
            : 'border-transparent hover:border-[#22252C]'
        )}
      >
        <img src={url} alt={`Frame ${index + 1}`} className="h-full w-full object-cover" />
      </button>
    ))}
  </div>

  {/* Action bar */}
  <div className="flex items-center justify-between px-1">
    <span className="text-[10px] font-semibold tracking-[0.05em] text-[#3A3E4C]">
      PREVIEW · {generation.mediaUrls.length} FRAMES
    </span>
    <button
      type="button"
      className="rounded-md border border-[#6C5CE744] bg-[#6C5CE711] px-3 py-1.5 text-[11px] font-semibold text-[#6C5CE7] transition-colors hover:bg-[#6C5CE71A]"
      onClick={() => {
        const frame = generation.mediaUrls[selectedIndex];
        if (!frame) return;
        onUseAsStartFrame({
          id: `storyboard-${generation.id}-frame-${selectedIndex}`,
          url: frame,
          source: 'generation',
          ...(generation.prompt ? { sourcePrompt: generation.prompt } : {}),
          ...resolveFrameAssetMetadata(generation, selectedIndex),
        });
      }}
    >
      Use as start frame
    </button>
  </div>
</div>
```

---

## Fix 3: Remove Floating StoryboardStrip

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/CanvasWorkspace.tsx`

- Remove `<StoryboardStrip>` render from the hero canvas container
- Remove `isStoryboardDismissed` state
- Remove `latestStoryboardId` memo and its useEffect
- Remove `StoryboardStrip` import
- Keep `handleUseStoryboardFrame` callback (used by `StoryboardHeroView`)

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/components/StoryboardStrip.tsx`

- Do NOT delete the file yet. It may still be imported by tests or other code paths. Mark with a `@deprecated` JSDoc comment. Delete in a cleanup pass after verification.

---

## Fix 4: Wire Span Suggestion Pills into Canvas-First Layout

### The gap

`PromptCanvas.tsx` (orchestrator) calls `useInlineSuggestionState()` and gets back all suggestion data. It passes these as props to `PromptCanvasView`. When `FEATURES.CANVAS_FIRST_LAYOUT` is true, `PromptCanvasView` renders `<CanvasWorkspace>` — but `CanvasWorkspace` doesn't accept any of the ~20 suggestion-related props. The suggestion data dies at the `PromptCanvasView → CanvasWorkspace` boundary.

### Solution: Thread suggestion props through to CanvasPromptBar

**Step 1: Extend `CanvasWorkspaceProps`**

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/CanvasWorkspace.tsx`

Add suggestion props to `CanvasWorkspaceProps`:

```ts
// Add to CanvasWorkspaceProps interface:
selectedSpanId: string | null;
suggestionCount: number;
suggestionsListRef: React.RefObject<HTMLDivElement>;
inlineSuggestions: InlineSuggestion[];
activeSuggestionIndex: number;
onActiveSuggestionChange: (index: number) => void;
interactionSourceRef: React.MutableRefObject<'keyboard' | 'mouse' | 'auto'>;
onSuggestionClick: (suggestion: SuggestionItem | string) => void;
onCloseInlinePopover: () => void;
selectionLabel: string;
onApplyActiveSuggestion: () => void;
isInlineLoading: boolean;
isInlineError: boolean;
inlineErrorMessage: string;
isInlineEmpty: boolean;
// Custom request props
customRequest: string;
onCustomRequestChange: (value: string) => void;
customRequestError: string;
onCustomRequestErrorChange: (value: string) => void;
onCustomRequestSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
isCustomRequestDisabled: boolean;
isCustomLoading: boolean;
// I2V lock props
showI2VLockIndicator: boolean;
resolvedI2VReason: string | null;
i2vMotionAlternatives: SuggestionItem[];
onLockedAlternativeClick: (suggestion: SuggestionItem) => void;
```

Import types: `InlineSuggestion`, `SuggestionItem` from `PromptCanvas/types`.

**Step 2: Pass from PromptCanvasView**

**File:** `client/src/features/prompt-optimizer/PromptCanvas/components/PromptCanvasView.tsx`

In the `FEATURES.CANVAS_FIRST_LAYOUT` branch, add all suggestion props to `<CanvasWorkspace>`:

```tsx
<CanvasWorkspace
  {...existingProps}
  selectedSpanId={selectedSpanId}
  suggestionCount={suggestionCount}
  suggestionsListRef={suggestionsListRef}
  inlineSuggestions={inlineSuggestions}
  activeSuggestionIndex={activeSuggestionIndex}
  onActiveSuggestionChange={onActiveSuggestionChange}
  interactionSourceRef={interactionSourceRef}
  onSuggestionClick={onSuggestionClick}
  onCloseInlinePopover={onCloseInlinePopover}
  selectionLabel={selectionLabel}
  onApplyActiveSuggestion={onApplyActiveSuggestion}
  isInlineLoading={isInlineLoading}
  isInlineError={isInlineError}
  inlineErrorMessage={inlineErrorMessage}
  isInlineEmpty={isInlineEmpty}
  customRequest={customRequest}
  onCustomRequestChange={onCustomRequestChange}
  customRequestError={customRequestError}
  onCustomRequestErrorChange={onCustomRequestErrorChange}
  onCustomRequestSubmit={onCustomRequestSubmit}
  isCustomRequestDisabled={isCustomRequestDisabled}
  isCustomLoading={isCustomLoading}
  showI2VLockIndicator={showI2VLockIndicator}
  resolvedI2VReason={resolvedI2VReason}
  i2vMotionAlternatives={i2vMotionAlternatives}
  onLockedAlternativeClick={onLockedAlternativeClick}
/>
```

**Step 3: CanvasWorkspace passes to CanvasPromptBar**

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/CanvasWorkspace.tsx`

Pass all suggestion props down to `<CanvasPromptBar>`.

**Step 4: CanvasPromptBar renders suggestion tray**

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/components/CanvasPromptBar.tsx`

Add a collapsible suggestions tray below the prompt editor, inside the prompt card container. It appears when `selectedSpanId` is non-null:

```tsx
{/* Suggestion pills tray — appears when a span is selected */}
{selectedSpanId && (suggestionCount > 0 || isInlineLoading) ? (
  <div className="mt-2 border-t border-[#22252C] pt-2">
    {/* Selection label */}
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-[10px] font-semibold tracking-[0.05em] text-[#555B6E]">
        {selectionLabel}
      </span>
      <button
        type="button"
        className="text-[10px] text-[#3A3E4C] hover:text-[#555B6E]"
        onClick={onCloseInlinePopover}
      >
        ✕
      </button>
    </div>

    {/* Loading state */}
    {isInlineLoading ? (
      <div className="flex gap-2">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-[#1A1C22]" />
        <div className="h-8 w-32 animate-pulse rounded-lg bg-[#1A1C22]" />
        <div className="h-8 w-20 animate-pulse rounded-lg bg-[#1A1C22]" />
      </div>
    ) : null}

    {/* Error state */}
    {isInlineError ? (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
        {inlineErrorMessage}
      </div>
    ) : null}

    {/* Suggestion pills — horizontal scrollable row */}
    {!isInlineLoading && !isInlineError && suggestionCount > 0 ? (
      <div
        ref={suggestionsListRef}
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {inlineSuggestions.map((suggestion, index) => (
          <button
            key={suggestion.key}
            type="button"
            data-index={index}
            className={cn(
              'flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors',
              activeSuggestionIndex === index
                ? 'border-[#6C5CE7]/50 bg-[#6C5CE7]/10 text-[#E2E6EF]'
                : 'border-[#22252C] bg-[#141519] text-[#8B92A5] hover:border-[#3A3E4C] hover:text-[#E2E6EF]'
            )}
            onMouseEnter={() => {
              interactionSourceRef.current = 'mouse';
              onActiveSuggestionChange(index);
            }}
            onClick={() => {
              onSuggestionClick(suggestion.item);
              onCloseInlinePopover();
            }}
          >
            {suggestion.text}
            {index === 0 ? (
              <span className="ml-1.5 text-[9px] font-semibold text-[#6C5CE7]">Best</span>
            ) : null}
          </button>
        ))}
      </div>
    ) : null}
  </div>
) : null}
```

**Design note:** The traditional layout renders suggestions as a vertical list in a side popover. The canvas-first layout uses horizontal pills inside the prompt card because there's no side panel. This is a deliberate UX adaptation, not a 1:1 port.

---

## Fix 5: Relocate Prompt Version Navigation

### Approach: Add version indicator to CanvasTopBar

Prompt versions move from the left strip to the top bar as a dropdown next to the session name. This is lower priority and can be a follow-up task.

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/components/CanvasTopBar.tsx`

Add a version selector dropdown:
- Shows current version label (e.g., "v3")
- Dropdown lists all versions with timestamps
- Clicking a version calls `onSelectVersion(versionId)`

**File:** `client/src/features/prompt-optimizer/CanvasWorkspace/CanvasWorkspace.tsx`

- Pass `versionsPanelProps` to `CanvasTopBar` instead of `CanvasVersionStrip`
- Remove `CanvasVersionStrip` import and render

### Props change for CanvasTopBar

```ts
interface CanvasTopBarProps {
  versions?: PromptVersionEntry[];
  selectedVersionId?: string;
  onSelectVersion?: (versionId: string) => void;
}
```

---

## File Change Summary

| File | Action |
|------|--------|
| `CanvasWorkspace/components/CanvasGenerationStrip.tsx` | **CREATE** — generation output thumbnails |
| `CanvasWorkspace/components/StoryboardHeroView.tsx` | **CREATE** — full-size storyboard frame grid |
| `CanvasWorkspace/CanvasWorkspace.tsx` | **MODIFY** — add selectedGenerationId state, replace CanvasVersionStrip with CanvasGenerationStrip, add hero branching for storyboard, remove StoryboardStrip, wire suggestion props, pass heroOverrideGenerationId to GenerationsPanel |
| `CanvasWorkspace/components/CanvasPromptBar.tsx` | **MODIFY** — accept suggestion props, render suggestion pills tray |
| `CanvasWorkspace/components/CanvasVersionStrip.tsx` | **DEPRECATE** — add @deprecated JSDoc, keep file |
| `CanvasWorkspace/components/StoryboardStrip.tsx` | **DEPRECATE** — add @deprecated JSDoc, keep file |
| `CanvasWorkspace/components/CanvasTopBar.tsx` | **MODIFY** — add version dropdown (lower priority) |
| `GenerationsPanel/types.ts` | **MODIFY** — add `heroOverrideGenerationId` to `GenerationsPanelProps` |
| `GenerationsPanel/GenerationsPanel.tsx` | **MODIFY** — wire `heroOverrideGenerationId` into `heroGeneration` memo |
| `PromptCanvas/components/PromptCanvasView.tsx` | **MODIFY** — pass suggestion props to CanvasWorkspace in canvas-first branch |

## Test Plan

### Unit tests

**`CanvasGenerationStrip.test.tsx`**
- Renders thumbnail for each generation
- Selected generation has active border
- Pending generation shows skeleton
- Failed generation shows error overlay
- Click calls `onSelectGeneration` with correct ID
- Generations sorted newest-first

**`StoryboardHeroView.test.tsx`**
- Renders 2×2 grid from `generation.mediaUrls`
- Click selects frame (border changes)
- "Use as start frame" dispatches selected frame data
- Handles generations with < 4 frames gracefully

**`CanvasPromptBar.suggestion-pills.test.tsx`**
- Suggestion tray hidden when `selectedSpanId` is null
- Tray visible when `selectedSpanId` set and `suggestionCount > 0`
- Loading skeletons shown during `isInlineLoading`
- Error message shown during `isInlineError`
- Click on pill calls `onSuggestionClick` then `onCloseInlinePopover`
- Active pill has accent styling

**`GenerationsPanel.hero-override.test.tsx`**
- `heroOverrideGenerationId` selects correct generation
- Falls back to existing logic when override ID not found
- Override ID pointing to image-sequence is ignored (still excluded from hero)

### Integration verification

- `tsc --noEmit` — zero errors
- `eslint` — zero warnings in changed files
- `vitest run` — all unit tests pass
- `vite build` — successful production build

## Implementation Order

1. **GenerationsPanel types + hero override** — smallest change, unblocks everything
2. **CanvasGenerationStrip** — new component, no existing code changes
3. **StoryboardHeroView** — new component, no existing code changes
4. **CanvasWorkspace rewire** — swap strip, add state, add hero branching, remove StoryboardStrip
5. **Suggestion pills wiring** — thread props through PromptCanvasView → CanvasWorkspace → CanvasPromptBar
6. **CanvasTopBar version dropdown** — lowest priority, can follow up

Steps 1-3 can be done in parallel. Step 4 depends on 1-3. Step 5 is independent of 1-4. Step 6 is independent.

## Edge Cases

- **Zero generations:** Left strip is empty, hero shows existing empty state from GenerationsPanel
- **All generations are storyboards:** Hero falls back to null via `heroGeneration` memo → shows empty state. Strip still shows storyboard entries; clicking one renders `StoryboardHeroView`
- **Generation with 0 mediaUrls (pending):** Strip shows skeleton, hero shows GenerationCard's built-in pending/progress state
- **Storyboard with < 4 frames:** `StoryboardHeroView` grid adapts — 1 frame = single image, 2 frames = 1×2, 3 frames = 2×2 with empty slot hidden
- **Auto-select race:** If two generations complete simultaneously, the one with the later `completedAt` wins
- **selectedGenerationId points to deleted generation:** Fallback logic in `selectedGeneration` memo handles this (finds no match → falls back to latest completed)
