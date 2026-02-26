# Canvas-First Redesign — Implementation Plan

## Reference Mockup
`canvas-redesign-v1.jsx` (in project files) — interactive React prototype showing final target state.

## Summary of Changes
Remove the 400px sidebar panel. Keep the 56px ToolRail. Move all generation controls (prompt, model, settings, generate) into the canvas area as a bottom prompt bar. Model selector becomes a floating corner element. Motion attaches to the start frame popover. Preview and Generate become explicit cost-labeled buttons.

---

## Architecture Overview (Current → Target)

### Current Layout
```
[ToolRail 56px] [ToolPanel 400px] [Canvas flex-1]
```
- `AppShell.tsx` renders `<ToolSidebar>` (rail + panel) + children
- `ToolSidebar.tsx` renders `<ToolRail>` + `<ToolPanel>` side by side
- `GenerationControlsPanel` inside ToolPanel owns: PanelHeader, prompt card, VideoPromptToolbar, VideoSettingsRow, ReferencesOnboardingCard, GenerationFooter
- Canvas (`PromptCanvasView`) renders video output, SpanBentoGrid, GenerationsPanel, VersionsPanel

### Target Layout
```
[ToolRail 56px] [CanvasWorkspace flex-1]
                 ├── TopBar (session name, credits)
                 ├── VideoCanvas (flex-1, video output)
                 ├── StoryboardStrip (conditional, after Preview)
                 └── CanvasPromptBar (prompt text + settings row + buttons)

[ModelSelector]  ← absolute bottom-left corner
```

---

## Phase 0: Feature Flag + Scaffold

### 0.1 Add feature flag
**File:** `client/src/config/featureFlags.ts` (or equivalent)
```ts
export const CANVAS_FIRST_LAYOUT = true; // toggle during development
```
This flag gates the new layout so existing layout continues working until migration is complete.

### 0.2 Create new component directory
```
client/src/features/prompt-optimizer/CanvasWorkspace/
  CanvasWorkspace.tsx          — orchestrator
  components/
    CanvasPromptBar.tsx        — prompt text + settings row + action buttons
    CanvasSettingsRow.tsx       — start frame, assets, aspect, duration, enhance, preview, generate
    StartFramePopover.tsx       — thumbnail + motion selector popover
    StoryboardStrip.tsx         — 4-frame filmstrip after preview
    ModelCornerSelector.tsx     — floating model picker (bottom-left)
    CanvasTopBar.tsx            — session name, credits, minimal chrome
  hooks/
    useCanvasPromptBar.ts       — state coordination for the prompt bar
```

---

## Phase 1: Extract Reusable Logic from Panel Components

Before building the new layout, extract business logic out of panel-specific components so both layouts can share it.

### 1.1 Extract model selection logic
**Source:** `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter.tsx` (lines 1-50)
**Source:** `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation.ts`
**Source:** `client/src/components/ToolSidebar/config/modelConfig.ts`

**Action:** These are already clean. `modelConfig.ts` exports `VIDEO_DRAFT_MODEL`, `VIDEO_RENDER_MODELS`, `STORYBOARD_COST`. `useModelSelectionRecommendation` is a standalone hook. No extraction needed — just import them in the new components.

### 1.2 Extract generation trigger logic
**Source:** `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useGenerationControlsPanel.ts`

**Action:** Identify the `handleGenerate` callback and its dependencies. This hook likely coordinates `generationParams`, model selection, and the actual generation API call. The new `CanvasPromptBar` needs access to the same `onGenerate` callback. Trace through `GenerationControlsPanel.tsx` to confirm how it passes `onGenerate` to `GenerationFooter`. The new layout needs the same callback — it should come from the same store/context (`GenerationControlsStore` + `useGenerationControlsStoreActions`).

### 1.3 Extract camera motion flow
**Source:** `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCameraMotionModalFlow.ts`
**Source:** `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/CameraMotionSelector.tsx`

**Action:** The current flow opens a full modal. The new design uses an inline popover with pill-selection instead. Create a simpler hook:
```ts
// useMotionSelection.ts
// Reads: store.domain.cameraMotion, store.domain.startFrame
// Writes: store.actions.setCameraMotion
// No modal — just a list of motion IDs and a setter
```
The motion options list currently lives in `CameraMotionSelector.tsx`. Extract the motion ID list as a constant (e.g. `CAMERA_MOTION_OPTIONS`) so both the old modal and the new popover can use it.

### 1.4 Extract start frame upload logic
**Source:** `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx` (lines ~290-320, `handleStartFrameUpload` callback)
**Source:** Store actions: `useGenerationControlsStoreActions().setStartFrame`, `clearStartFrame`

**Action:** `handleStartFrameUpload` is already a standalone callback in the workspace. It's passed down through `SidebarDataProvider`. The new `StartFramePopover` needs access to:
- `store.domain.startFrame` (read)
- `store.actions.setStartFrame` (write)
- `store.actions.clearStartFrame` (write)
- `handleStartFrameUpload` from `SidebarDataProvider`

No extraction needed — consume from existing context/store.

### 1.5 Extract preview (storyboard) generation logic
**Source:** `client/src/features/prompt-optimizer/GenerationsPanel/hooks/useKeyframeWorkflow.ts` (lines 131-147, `handleSelectFrame`)
**Source:** `client/src/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationActions.ts`

**Action:** The storyboard generation flow calls the Kontext image model to produce 4 preview frames. The current `VideoPromptToolbar` triggers this via `onPreviewGenerate`. Trace this callback through `GenerationControlsPanel` to find the actual API call. The new `CanvasSettingsRow` Preview button needs the same trigger. The `handleSelectFrame` → `setStartFrame` pipeline in `useKeyframeWorkflow` is already wired and can be reused as-is.

---

## Phase 2: Build New Canvas Components

### 2.1 `CanvasTopBar.tsx`
Simple bar at top of canvas area. Contains:
- App name / logo (left)
- Session name + dropdown (center-right)
- Credits display (right)

Pull session name from `useWorkspaceSession()`. Pull credits from auth/billing context.

### 2.2 `ModelCornerSelector.tsx`
Floating `position: absolute; bottom: 16px; left: 16px` button.

**Data:**
- Read `store.domain.selectedModel` for current selection
- Read `VIDEO_RENDER_MODELS` and `VIDEO_DRAFT_MODELS` from `modelConfig.ts`
- Write via `useGenerationControlsStoreActions().setSelectedModel` (exists, traced from `usePromptState().setSelectedModel`)
- Read model recommendation from `useModelSelectionRecommendation` hook

**Behavior:**
- Click opens popover above the button
- Each model row shows: name, cost tag, capability tags (Start Frame, End Frame, etc.), optional "New" badge
- Selecting a model calls `setSelectedModel(modelId)` and closes popover
- Active model shows checkmark

**Props:** None (reads everything from store/hooks).

### 2.3 `StartFramePopover.tsx`
Triggered by a button in `CanvasSettingsRow`. Opens upward from the button position.

**Two states:**
1. **No start frame** (`store.domain.startFrame === null`):
   - Dashed upload zone with "Drop image or click to upload"
   - Text: "Or select from storyboard previews"
   - Uses `handleStartFrameUpload` from `SidebarDataProvider` on file drop/select

2. **Has start frame** (`store.domain.startFrame !== null`):
   - Thumbnail preview of the frame URL
   - Remove button → calls `clearStartFrame()`
   - Camera motion pill selector:
     - Reads `store.domain.cameraMotion`
     - Writes via `setCameraMotion(cameraPath)`
     - Options: extracted `CAMERA_MOTION_OPTIONS` constant
     - When start frame is cleared, also clear camera motion

**Key behavioral rule:** Motion selector ONLY appears when a start frame exists. This replaces the perpetually-disabled Motion button in the old `VideoSettingsRow`.

### 2.4 `StoryboardStrip.tsx`
Horizontal filmstrip that appears between the video canvas and prompt bar after Preview is clicked.

**Data:**
- Reads generation results from `useGenerationsState` (the Kontext preview outputs)
- Selected index is local state

**Behavior:**
- Shows 4 thumbnail frames from the preview generation
- Click to select (visual ring)
- "Use as start frame" button calls `setStartFrame` with the selected frame's data
- Dismiss (✕) hides the strip

**Wiring:** The existing pipeline `GenerationCard` → `KontextFrameStrip` → `onFrameClick` → `onSelectFrame` → `useKeyframeWorkflow.handleSelectFrame` → `setStartFrame` already works. The new strip needs to replicate just the `setStartFrame` call with the frame data — it doesn't need the full `GenerationsPanel` machinery.

### 2.5 `CanvasSettingsRow.tsx`
Single row inside the prompt container, below the prompt text, separated by a subtle border.

**Layout (left to right):**
```
[Start frame] [Assets] [16:9] [5s] [✦ Enhance]  ←spacer→  [char count] [Preview · ~4cr] [Generate · 80cr]
```

**Start frame button:**
- No frame: ghost icon + "Start frame" label
- Has frame: mini thumbnail (20×14) + "Start frame" + motion badge if set (e.g. purple "Dolly in")
- Click toggles `StartFramePopover`

**Assets button:**
- Ghost icon + "Assets" label
- Click opens a popover with the same content as current `ReferencesOnboardingCard` (upload + assets library)
- Reads assets from `useSidebarAssetsDomain()`

**Aspect ratio / Duration:**
- Read from `store.domain.generationParams` (or `useCapabilitiesClamping` hook)
- Write via `setGenerationParams` (same actions as `VideoSettingsRow`)
- Click opens small dropdown with options
- Options come from `useCapabilitiesClamping` which returns `aspectRatioOptions`, `durationOptions`

**Enhance button:**
- Purple accent style
- Triggers the existing optimize flow: `handleOptimize()` from `usePromptOptimization`
- Same callback currently wired to "AI Enhance" in `VideoPromptToolbar`

**Preview button:**
- Secondary/bordered style
- Label: "Preview · ~4 cr" (cost from `STORYBOARD_COST` in `modelConfig.ts`)
- Loading state: spinner + "Generating…"
- On click: triggers the Kontext storyboard generation (same as current split button's `onPreviewGenerate(4)`)
- On completion: shows `StoryboardStrip`

**Generate button:**
- **When model is Wan (draft tier):** Outlined style, label "Draft · 5 cr"
- **When model is render tier:** Filled white style, label "Generate · 80 cr"
- Determine tier: `renderModelId === VIDEO_DRAFT_MODEL.id` or check `store.domain.videoTier`
- Cost: read from `VIDEO_RENDER_MODELS` / `VIDEO_DRAFT_MODEL` via `modelConfig.ts`
- On click: same `onGenerate` callback as current `GenerationFooter`

### 2.6 `CanvasPromptBar.tsx`
The prompt text area + settings row combined into a single container.

**Structure:**
```tsx
<div className="prompt-container"> {/* border, rounded, surface bg */}
  <PromptEditor ... />           {/* existing semantic span editor */}
  <CanvasSettingsRow />          {/* Phase 2.5 */}
</div>
```

**Key integration:** The `PromptEditor` component already exists at `client/src/features/prompt-optimizer/components/PromptEditor.tsx`. It handles contenteditable, span highlighting, trigger autocomplete, inline suggestions. It currently lives inside `PromptCanvasView`. Reuse it directly — don't rebuild it.

### 2.7 `CanvasWorkspace.tsx` (orchestrator)
Replaces the current panel + canvas split. This is the main content area after the ToolRail.

```tsx
<div className="flex flex-col h-full">
  <CanvasTopBar />
  <div className="flex-1 relative"> {/* canvas area */}
    <VersionThumbnails />   {/* left edge, absolute */}
    <VideoCanvas />          {/* the video player / output */}
    <ModelCornerSelector />  {/* absolute bottom-left */}
  </div>
  <ActionRow />              {/* Reuse, Extend, Copy, Share, Download */}
  {showStoryboard && <StoryboardStrip />}
  <CanvasPromptBar />
</div>
```

**Context requirements:** Needs access to all the same providers currently wrapping `PromptOptimizerWorkspaceView`:
- `PromptStateContext` (prompt text, optimization, suggestions)
- `GenerationControlsStore` (model, params, start frame, camera motion)
- `PromptResultsActionsContext` (suggestion clicks, coherence)
- `SidebarDataProvider` (assets, uploads)
- `WorkspaceSessionContext` (session, continuity shots)

These providers already wrap at the `PromptOptimizerWorkspace` level, so the new component just needs to be rendered inside the same tree.

---

## Phase 3: Integrate into App Shell

### 3.1 Modify `AppShell.tsx`
**File:** `client/src/components/navigation/AppShell/AppShell.tsx`

Current sidebar variant:
```tsx
<div className="flex h-full min-h-0 overflow-hidden bg-app">
  <ToolSidebar {...toolSidebarProps} user={user} />
  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
    {children}
  </div>
</div>
```

**Change to (behind flag):**
```tsx
<div className="flex h-full min-h-0 overflow-hidden bg-app">
  {CANVAS_FIRST_LAYOUT ? (
    <>
      <ToolRail activePanel={activePanel} onPanelChange={setActivePanel} user={user} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
        {children}
      </div>
    </>
  ) : (
    <>
      <ToolSidebar {...toolSidebarProps} user={user} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
        {children}
      </div>
    </>
  )}
</div>
```

The `ToolRail` component already exists standalone at `client/src/components/ToolSidebar/components/ToolRail.tsx`. It doesn't depend on the panel — it just emits `onPanelChange` events.

**ToolRail panel actions in canvas-first mode:**
- "Tool" (studio): No-op or focuses the prompt bar
- "Chars": Opens a floating panel or sheet for character assets
- "Styles": Opens a floating panel or sheet for styles
- "Sessions": Opens sessions in a sheet/drawer

For Phase 3, the tool rail buttons can open overlay sheets (`Sheet` from the UI library) instead of the old inline panel. This is a follow-up concern — the critical path is removing the panel from the main layout flow.

### 3.2 Modify `PromptOptimizerWorkspaceView.tsx`
**File:** `client/src/features/prompt-optimizer/PromptOptimizerContainer/components/PromptOptimizerWorkspaceView.tsx`

Currently renders `<PromptResultsLayout />` which renders `<PromptResultsSection />` which renders `<PromptCanvas />`.

**Behind flag, replace with:**
```tsx
{CANVAS_FIRST_LAYOUT ? (
  <CanvasWorkspace />
) : (
  <PromptResultsLayout />
)}
```

`CanvasWorkspace` composes the video canvas (from existing `PromptCanvasView` internals) + `CanvasPromptBar` + `ModelCornerSelector` + `StoryboardStrip`.

### 3.3 Wire the video canvas
The actual video player / generation output display currently lives deep in `PromptCanvasView.tsx`. It renders `<GenerationsPanel>` which shows generation cards with video players.

**In the new layout**, `GenerationsPanel` moves from being a section within the canvas to being the primary canvas content. The latest generation should render as a full-canvas video player (hero view), with the generation history accessible through the version thumbnails on the left edge.

**Existing file:** `client/src/features/prompt-optimizer/GenerationsPanel/GenerationsPanel.tsx`
**Existing file:** `client/src/features/prompt-optimizer/GenerationsPanel/components/GenerationCard.tsx`

The `GenerationsPanel` already handles video display, progress overlays, and generation status. In canvas-first mode, configure it to show a single hero generation instead of a scrollable list.

---

## Phase 4: Remove Panel Dependencies

### 4.1 Components that become unused (panel-only)
Once the flag is permanently on, these panel-specific components can be deleted:

| Component | File | Replacement |
|-----------|------|-------------|
| `GenerationControlsPanel` | `ToolSidebar/components/panels/GenerationControlsPanel/GenerationControlsPanel.tsx` | `CanvasWorkspace` orchestrator |
| `PanelHeader` | `GenerationControlsPanel/components/PanelHeader.tsx` | `CanvasTopBar` (video/image pill moves here or is removed) |
| `VideoTabContent` | `GenerationControlsPanel/components/VideoTabContent.tsx` | Content split across `CanvasPromptBar` + `CanvasSettingsRow` |
| `VideoPromptToolbar` | `GenerationControlsPanel/components/VideoPromptToolbar.tsx` | Replaced by `CanvasSettingsRow` |
| `VideoSettingsRow` | `GenerationControlsPanel/components/VideoSettingsRow.tsx` | Settings inline in `CanvasSettingsRow`; motion in `StartFramePopover` |
| `GenerationFooter` | `GenerationControlsPanel/components/GenerationFooter.tsx` | Generate button in `CanvasSettingsRow`; model in `ModelCornerSelector` |
| `ReferencesOnboardingCard` | `GenerationControlsPanel/components/ReferencesOnboardingCard.tsx` | Assets popover from `CanvasSettingsRow` Assets button |
| `StartFrameControl` | `ToolSidebar/components/panels/StartFrameControl.tsx` | `StartFramePopover` |
| `ToolPanel` | `ToolSidebar/components/ToolPanel.tsx` | Removed (rail stays) |
| `ModelRecommendationDropdown` | `GenerationControlsPanel/components/ModelRecommendationDropdown.tsx` | `ModelCornerSelector` popover |

### 4.2 Components that survive as-is
| Component | Why |
|-----------|-----|
| `ToolRail.tsx` | Stays — it's the 56px icon rail |
| `SessionsPanel.tsx` | Moves to an overlay/sheet, but component internals unchanged |
| `CharactersPanel.tsx` | Same — opens as sheet overlay |
| `StylesPanel.tsx` | Same |
| `PromptEditor.tsx` | Core editor — reused inside `CanvasPromptBar` |
| `SpanBentoGrid` | Suggestion grid — still appears on span click |
| `GenerationsPanel` | Video output display — becomes hero canvas content |
| `CameraMotionSelector.tsx` | Motion list may be reused in `StartFramePopover` (extract options) |
| All hooks in `GenerationControlsPanel/hooks/` | Business logic stays, UI changes |

### 4.3 Store changes
**File:** `client/src/features/prompt-optimizer/context/generationControlsStoreTypes.ts`

No schema changes needed. The store already has:
- `selectedModel: string`
- `startFrame: KeyframeTile | null`
- `cameraMotion: CameraPath | null`
- `generationParams: CapabilityValues`
- `videoTier: VideoTier`

All the new components read/write the same fields. The only new state is local UI state in the new components (popover open/closed, storyboard selection index, preview loading).

---

## Phase 5: Polish + Cleanup

### 5.1 SpanBentoGrid positioning
Currently the suggestion grid appears within the panel. In canvas-first mode, it should appear as a floating popover anchored below the active span in the prompt bar, or as a row above the prompt (as shown in the mockup's "ALT" suggestion strip).

### 5.2 Image mode
The current `PanelHeader` has a video/image pill switcher. In canvas-first mode, this can move to the `CanvasTopBar` or become a keyboard shortcut. The image-specific components (`ImageTabContent`, `ImageSubTabSelector`, etc.) need equivalent canvas-first treatment — but this is a fast follow, not part of the initial refactor.

### 5.3 Continuity/sequence mode
The `PromptResultsLayout` renders sequence-specific UI (`ShotVisualStrip`, `ContinuityIntentPicker`, etc.). These need to work within `CanvasWorkspace`. They're positioned above/below the canvas and should slot in naturally.

### 5.4 Delete feature flag
Once stable, remove `CANVAS_FIRST_LAYOUT` flag and delete all Phase 4.1 components + the old `ToolPanel`.

---

## Execution Order (Recommended)

```
Phase 0  →  Flag + directory scaffold                          [~1 hour]
Phase 1  →  Extract shared logic (motion options, etc.)        [~2 hours]
Phase 2  →  Build new components                               [~6-8 hours]
  2.1  CanvasTopBar                                            (simple)
  2.2  ModelCornerSelector                                     (medium)
  2.3  StartFramePopover                                       (medium)
  2.4  StoryboardStrip                                         (medium)
  2.5  CanvasSettingsRow                                       (complex — most wiring)
  2.6  CanvasPromptBar                                         (simple — wraps editor + settings)
  2.7  CanvasWorkspace orchestrator                            (medium)
Phase 3  →  Integrate into AppShell + WorkspaceView            [~2 hours]
Phase 4  →  Deprecate old components                           [~1 hour]
Phase 5  →  Polish (suggestions, image mode, sequences)        [~3-4 hours]
```

Total estimated effort: **15-18 hours of focused implementation**.

---

## Critical Wiring Reference

These are the exact import paths for the data the new components need:

```ts
// Store state
import { useGenerationControlsStoreState, useGenerationControlsStoreActions } from '@/features/prompt-optimizer/context/GenerationControlsStore';
// → .domain.selectedModel, .domain.startFrame, .domain.cameraMotion, .domain.generationParams
// → .setStartFrame(), .clearStartFrame(), .setCameraMotion(), .setSelectedModel()

// Model config
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS, VIDEO_DRAFT_MODELS, STORYBOARD_COST } from '@components/ToolSidebar/config/modelConfig';

// Capabilities (aspect ratio, duration options)
import { useCapabilitiesClamping } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCapabilitiesClamping';

// Model recommendation
import { useModelSelectionRecommendation } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useModelSelectionRecommendation';

// Assets
import { useSidebarAssetsDomain } from '@components/ToolSidebar/context';

// Upload
import { useSidebarData } from '@components/ToolSidebar/context';
// → .assets.onStartFrameUpload, .assets.onImageUpload

// Prompt state
import { usePromptState, usePromptActions, usePromptServices } from '@/features/prompt-optimizer/context/PromptStateContext';

// Generation actions (for Preview trigger)
import { useGenerationActions } from '@/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationActions';

// Keyframe workflow (for storyboard → start frame)
import { useKeyframeWorkflow } from '@/features/prompt-optimizer/GenerationsPanel/hooks/useKeyframeWorkflow';

// Camera motion modal (existing, for reference)
import { useCameraMotionModalFlow } from '@components/ToolSidebar/components/panels/GenerationControlsPanel/hooks/useCameraMotionModalFlow';
```

---

## Testing Notes

- **Existing tests:** 87+ test files exist across the project. The new components should have unit tests, but the old component tests should NOT be deleted until the flag is removed.
- **Key interaction tests:** Preview → StoryboardStrip → "Use as start frame" → store.startFrame populated → Motion appears in popover → Generate button shows correct cost
- **Regression:** Ensure the old layout still works when flag is off
- **E2E:** The generate flow (prompt → optimize → generate → video output) must produce identical API calls regardless of layout
