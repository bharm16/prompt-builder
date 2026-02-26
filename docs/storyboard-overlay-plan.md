# Storyboard Strip: Canvas-Bottom Overlay + Hero Filtering

## Problem

Two bugs in the canvas-first layout:

1. **Hero canvas shows storyboard frames instead of video.** When a storyboard preview runs, `useGenerationsState` sets `activeGenerationId` to the new image-sequence generation. In hero mode, `GenerationsPanel` renders `activeGeneration` via `GenerationCard`, which dispatches to `KontextFrameStrip` for image-sequences — rendering 4 large storyboard frames as the hero content. This displaces whatever video was previously showing.

2. **StoryboardStrip is in document flow.** It currently renders between the action row and prompt bar, shifting layout when it appears/disappears. It should be a floating overlay at the bottom of the hero canvas container.

## Fix 1: Hero Mode Filters to Video Generations Only

### File: `/Users/bryceharmon/Desktop/prompt-builder/client/src/features/prompt-optimizer/GenerationsPanel/GenerationsPanel.tsx`

In the hero rendering branch (around line 538), the current code uses `activeGeneration` directly:

```tsx
// CURRENT (broken)
{activeGeneration ? (
  <GenerationCard generation={activeGeneration} ... />
) : null}
```

Add a derived `heroGeneration` that excludes image-sequence types:

```tsx
// NEW
const heroGeneration = useMemo(() => {
  // If current active generation is a video, use it
  if (activeGeneration && activeGeneration.mediaType !== 'image-sequence') {
    return activeGeneration;
  }
  // Otherwise, fall back to the latest non-image-sequence generation
  const videoGenerations = generations.filter(
    (gen) => gen.mediaType !== 'image-sequence'
  );
  return videoGenerations.length > 0
    ? videoGenerations[videoGenerations.length - 1]!
    : null;
}, [activeGeneration, generations]);
```

Place this `useMemo` **before** the `if (presentation === 'hero')` check (it must be unconditional to satisfy React's rules of hooks — it runs in both branches but is only consumed in hero mode).

Then in the hero JSX, replace `activeGeneration` with `heroGeneration`:

```tsx
{heroGeneration ? (
  <GenerationCard
    generation={heroGeneration}
    ...existing props...
    isActive
    className="h-full"
  />
) : (
  <EmptyState
    onRunDraft={() => handleDraft(defaultDraftModel)}
    isRunDraftDisabled={!prompt.trim() || isGenerating}
  />
)}
```

**Key behavior**: When a storyboard preview runs, the hero canvas continues showing the previous video generation (or empty state if no video exists yet). The storyboard frames appear only in the `StoryboardStrip` overlay.

**Do NOT change `activeGenerationId` logic in `useGenerationsState`.** The reducer's `ADD_GENERATION` should still set `activeGenerationId` to the newest generation regardless of type — this is correct for the timeline view and for the snapshot emission that feeds `StoryboardStrip`. The filtering is presentation-layer only, inside the hero branch.

## Fix 2: Move StoryboardStrip to Canvas-Bottom Overlay

### File: `/Users/bryceharmon/Desktop/prompt-builder/client/src/features/prompt-optimizer/CanvasWorkspace/components/StoryboardStrip.tsx`

Restyle the strip as an absolute-positioned overlay with frosted glass backdrop. The outer wrapper changes from a static flex row to a floating overlay.

Current outer div:
```tsx
<div className="flex items-center gap-2 px-4 py-2" data-testid="storyboard-strip">
```

Replace with:
```tsx
<div
  className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[#22252C] bg-[#16181E]/85 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
  data-testid="storyboard-strip"
>
```

Design properties (matching model selector treatment from the mockup):
- `position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%)` — centered at bottom of canvas
- `background: #16181E` at 85% opacity (`bg-[#16181E]/85`) — matches `C.cardBg` from mockup token `cardBg: "#16181E"`
- `backdrop-filter: blur(24px)` (`backdrop-blur-xl`) — frosted glass, consistent with `ModelCornerSelector`
- `border: 1px solid #22252C` — matches `C.cardBorder` from mockup
- `border-radius: 12px` (`rounded-xl`)
- `box-shadow: 0 8px 32px rgba(0,0,0,0.5)` — matches `StartFramePopover` shadow from mockup
- `z-index: 30` — above canvas content, below popovers (model picker is z-50)
- `padding: 10px 16px` (`px-4 py-2.5`)

Add an entrance animation. Either use a Tailwind `animate-` class if the project has `fadeUp` defined, or add inline:
```tsx
style={{ animation: 'fadeUp 0.2s ease' }}
```

Check if `@keyframes fadeUp` exists in the project's global CSS or tailwind config. If not, add it to the component file or use `animate-fade-in` if available. The mockup defines `fadeUp` as:
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px) translateX(-50%); }
  to { opacity: 1; transform: translateY(0) translateX(-50%); }
}
```

Note: since the element uses `translate-x-1/2` via Tailwind, the animation keyframes must preserve that translateX so the strip doesn't jump. Safest approach: use `opacity` animation only and let Tailwind handle positioning:
```css
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
```
Or use `animate-in fade-in` from shadcn/ui if available.

### File: `/Users/bryceharmon/Desktop/prompt-builder/client/src/features/prompt-optimizer/CanvasWorkspace/CanvasWorkspace.tsx`

Move the `StoryboardStrip` render from its current position (between action row and prompt bar) into the canvas container — the `<div className="relative overflow-hidden rounded-2xl">` that wraps `GenerationsPanel`.

Current layout structure (simplified):
```tsx
{/* Video canvas */}
<div className="relative overflow-hidden rounded-2xl">
  <div className="relative mx-auto w-[55%]">
    <GenerationsPanel ... presentation="hero" ... />
  </div>
</div>

{/* Action row below canvas */}
<div className="relative mx-auto -top-4 w-[55%] ...">
  ...action buttons...
</div>

{/* Storyboard strip — CURRENTLY HERE (wrong) */}
{!isStoryboardDismissed ? (
  <StoryboardStrip ... />
) : null}

{/* Prompt bar */}
<CanvasPromptBar ... />
```

Move to:
```tsx
{/* Video canvas */}
<div className="relative overflow-hidden rounded-2xl">
  <div className="relative mx-auto w-[55%]">
    <GenerationsPanel ... presentation="hero" ... />
  </div>

  {/* Storyboard strip overlay — NOW INSIDE CANVAS CONTAINER */}
  {!isStoryboardDismissed ? (
    <StoryboardStrip
      snapshot={snapshot}
      onUseAsStartFrame={handleUseStoryboardFrame}
      onDismiss={() => setIsStoryboardDismissed(true)}
    />
  ) : null}
</div>

{/* Action row below canvas */}
<div className="relative mx-auto -top-4 w-[55%] ...">
  ...action buttons...
</div>

{/* Prompt bar */}
<CanvasPromptBar ... />
```

The canvas container already has `position: relative`, so the strip's `position: absolute; bottom: 16px` anchors correctly inside it.

## Test Updates

### File: `/Users/bryceharmon/Desktop/prompt-builder/client/src/features/prompt-optimizer/CanvasWorkspace/components/__tests__/StoryboardStrip.test.tsx`

Add or update tests:
1. **Renders with overlay positioning classes** — assert `backdrop-blur-xl`, `absolute`, `bottom-4` classes present on root element.
2. **Does not affect parent layout** — the strip should not change the rendered height of its parent container (it's absolutely positioned).

### File: `/Users/bryceharmon/Desktop/prompt-builder/client/src/features/prompt-optimizer/GenerationsPanel/__tests__/GenerationsPanel.hero.test.tsx`

Add tests:
1. **Hero mode shows video generation when image-sequence is active.** Set up generations array with one completed video and one completed image-sequence. Set `activeGenerationId` to the image-sequence. Assert that the rendered `GenerationCard` receives the video generation, not the image-sequence.
2. **Hero mode shows empty state when only image-sequences exist.** Set up generations with only image-sequence types. Assert empty state renders.
3. **Hero mode shows video generation normally when no image-sequences present.** Baseline test — active video generation renders as hero.

## Validation Commands

1. `npx tsc --noEmit`
2. `npx eslint --config config/lint/eslint.config.js . --quiet`
3. `npm run test:unit`
4. `npm run build`

## Files Modified

| File | Change |
|------|--------|
| `.../GenerationsPanel/GenerationsPanel.tsx` | Add `heroGeneration` memo, use in hero branch, add `EmptyState` fallback |
| `.../CanvasWorkspace/components/StoryboardStrip.tsx` | Restyle outer div as absolute overlay with frosted glass |
| `.../CanvasWorkspace/CanvasWorkspace.tsx` | Move `StoryboardStrip` render inside canvas container div |
| `.../GenerationsPanel/__tests__/GenerationsPanel.hero.test.tsx` | Add hero filtering tests |
| `.../CanvasWorkspace/components/__tests__/StoryboardStrip.test.tsx` | Add overlay positioning assertions |

## What NOT to Change

- `useGenerationsState` reducer logic — `ADD_GENERATION` still sets `activeGenerationId` to newest generation regardless of type.
- `onStateSnapshot` emission — continues to include all generations (needed by `StoryboardStrip`).
- Timeline presentation mode — no changes to the legacy `presentation="timeline"` branch.
- `CanvasVersionStrip` — operates on prompt versions, not generation outputs. No change needed.
- `ModelCornerSelector` positioning — unrelated, already correct.
