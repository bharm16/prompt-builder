# Unified Workspace — Design Spec

**Date:** 2026-05-04
**Source handoff:** `~/Desktop/handoff/` (sketch components) + `~/Downloads/handoff.html` (authoritative design)
**Owner:** Workspace pod
**Estimate:** ~3 sprints, 1 FE
**Branch:** off `refactor/prelaunch-stability-v2`
**Feature flag:** `VITE_FEATURE_UNIFIED_WORKSPACE`

---

## 0. Why

The existing `features/workspace-shell/CanvasWorkspace.tsx` treats Empty / Drafting / Rendering / Ready as four distinct screens. Each transition reflows the layout. The user loses context every time a generation completes. The unified workspace treats them as **one canvas, four moments in time**: the composer never moves, the gallery never empties, new generations stream in as tiles next to old ones, and the "result" is the most recent tile being promoted to a featured player.

This spec adapts the handoff to this codebase's actual shape (Tailwind + DaisyUI, React Context, real prop signatures, real token system). The handoff sketch components in `~/Desktop/handoff/components/` are reference only — they import from stores that don't exist (`useEditorStore`, `useProjectStore`, `useUserStore`), use vanilla BEM CSS (vs. Tailwind), and reference paths that don't match this repo. The authoritative design lives in `handoff.html`; this spec translates it into things that compile here.

## 1. Locked architectural decisions

| Decision                | Choice                                                                                                            | Reason                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Feature flag location   | Drop-in `UnifiedCanvasWorkspace` with same `CanvasWorkspaceProps`, swapped at `features/workspace-shell/index.ts` | Cleanest contract; lets us delete the old file in one move when the flag is removed |
| State pattern           | React Context + existing `useGenerationControlsStore*` hooks                                                      | Codebase reality; no Zustand stores added                                           |
| Styling                 | Tailwind + DaisyUI; three new CSS custom properties in `client/src/index.css`                                     | CLAUDE.md rule; matches existing `--tool-*` token system                            |
| `useGenerationsRuntime` | Untouched                                                                                                         | handoff §06 mandate                                                                 |
| `heroGeneration`        | Semantics preserved verbatim; failed-hero retry dance kept                                                        | handoff §07 + regression test contract                                              |
| Mode tabs               | `aria-disabled` with "Coming soon" tooltip                                                                        | Signals roadmap; PM can iterate later                                               |
| Continue Scene          | Opens `StartFramePopover` with last frame pre-selected                                                            | Designer recommendation per handoff §10                                             |
| Pin shot                | Deferred, not in any phase                                                                                        | Open Q with no clear value yet                                                      |
| Mobile                  | Deferred past Phase 3                                                                                             | Desktop ships clean first per handoff §08                                           |
| Tune drawer mobile      | Bottom sheet (when shipped)                                                                                       | Designer recommendation per handoff §10                                             |

## 2. Component map (handoff intent → this codebase)

| Handoff sketch concept                   | Translation                                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useEditorStore((s) => s.promptDraft)`   | The `prompt` prop already passed into `CanvasWorkspace` via `generationsPanelProps.prompt`                                                                                        |
| `useEditorStore((s) => s.modelParams)`   | `useGenerationControlsStoreState().domain.generationParams`                                                                                                                       |
| `useEditorStore((s) => s.setStartFrame)` | `useGenerationControlsStoreActions().setStartFrame` (or whichever is the existing setter — verify in writing-plans)                                                               |
| `useProjectStore`                        | New thin hook `useWorkspaceProject()` — wraps the existing project source for `{ name, rename }`                                                                                  |
| `useUserStore`                           | New thin hook `useWorkspaceCredits()` — wraps `useUserCreditBalance` + `useAuthUser` for `{ credits, avatarUrl }`                                                                 |
| `appEventBus` (mitt)                     | Existing `features/workspace-shell/events.ts`, extended with one new `CONTINUE_SCENE` event                                                                                       |
| `useModelParamSchema`                    | Existing model registry under `components/ToolSidebar/config/modelConfig`                                                                                                         |
| Vanilla `tokens.css` + `workspace.css`   | Three custom properties added to `client/src/index.css`; everything else Tailwind utility classes                                                                                 |
| `Generation` shape from sketch           | Existing `Generation` type from `features/generations/types` (do not invent new fields; if the sketch references a field the existing type lacks, derive it from existing fields) |

## 3. The state machine

A single derived value, not stored:

```ts
// features/workspace-shell/utils/computeWorkspaceMoment.ts
export type WorkspaceMoment = "empty" | "drafting" | "rendering" | "ready";

export function computeWorkspaceMoment(s: {
  galleryEntries: GalleryEntry[];
  activeShotTiles: GalleryEntry[]; // tiles in the most recent shot
  promptIsEmpty: boolean;
  tuneOpen: boolean;
  promptFocused: boolean;
}): WorkspaceMoment {
  const hasAnyShots = s.galleryEntries.length > 0;
  const activeRendering = s.activeShotTiles.some(
    (t) => t.status === "rendering" || t.status === "queued",
  );
  const activeReady = s.activeShotTiles.some((t) => t.status === "ready");

  if (activeRendering) return "rendering";
  if (!hasAnyShots && s.promptIsEmpty && !s.tuneOpen) return "empty";
  if (!hasAnyShots && (s.promptFocused || !s.promptIsEmpty || s.tuneOpen))
    return "drafting";
  if (activeReady) return "ready";
  return "drafting";
}
```

The moment is purely a hint for visual treatment. Nothing about navigation, mounting, or unmounting depends on it. This replaces today's `computeIsEmptySession` and removes the `justify-center` / `!displayHeroGeneration` branch from `CanvasWorkspace`.

## 4. Layout regions

Four fixed regions, no reflow between moments:

| Region     | Size                             | Owner                                   | Behavior                                                                                              |
| ---------- | -------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Top chrome | 44px h, full w                   | new `WorkspaceTopBar`                   | Project rename, mode tabs, credits, Share, avatar                                                     |
| Left rail  | 56px w, full h                   | existing `ToolSidebar` (slimmed)        | Icon-only; bump `--tool-rail-width` 52→56                                                             |
| Canvas     | fluid                            | refactored `CanvasWorkspace` (new path) | Vertical scroll of shots; empty state shows centered hero inside the same scroll region               |
| Composer   | 720px max, centered, bottom 20px | new `UnifiedCanvasPromptBar`            | Floating glass card, `position: absolute` within canvas region; expands upward when Tune drawer opens |

## 5. Data shapes

```ts
// features/workspace-shell/utils/groupShots.ts (Phase 2)
export interface Shot {
  id: string; // promptVersionId; "__legacy:<id>" for un-grouped
  promptSummary: string; // first 80ch of sanitized prompt
  modelId: string;
  createdAt: number;
  tiles: GalleryEntry[]; // length === variant count
  status: "rendering" | "ready" | "mixed" | "failed";
}

export function groupShots(entries: GalleryEntry[]): Shot[] {
  // bucket by promptVersionId, sort buckets by max(createdAt) desc
}
```

The active shot is `shots[0]`. The featured tile within it is the user-selected variant (today's `heroGeneration`) or, lacking one, the first ready tile. `useFeaturedTile(shots, heroGeneration)` encapsulates this rule plus the existing failed-hero / retry semantics.

## 6. New event

```ts
// features/workspace-shell/events.ts — extension
export const CONTINUE_SCENE = "workspace:continue-scene";
// payload: { fromGenerationId: string }
// Emitted by GenTile.
// Listener (in UnifiedCanvasPromptBar) opens StartFramePopover with the
// prior tile's last frame pre-selected (resolved from generation media metadata).
// No backend changes; reuses existing StartFramePopover plumbing.
```

## 7. Token deltas (additive)

All added to `client/src/index.css` next to existing `--tool-*` definitions:

| Token                               | Today     | Proposed                                                                   | Why                                                 |
| ----------------------------------- | --------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| `--tool-rail-width`                 | 52px      | 56px                                                                       | Match design hit area                               |
| `--tool-surface-prompt`             | `#14141a` | `rgba(22,22,28,.72)` + `backdrop-blur(18px)` (Tailwind)                    | Composer is glass-on-canvas                         |
| `--tool-canvas-bg` (new)            | —         | `radial-gradient(1600px 900px at 50% -10%, #15151d, #0a0a0e 50%, #050507)` | Ambient backdrop the composer floats over           |
| `--tool-status-rendering` (new)     | —         | `#d4b486` (muted amber)                                                    | Rendering badge dot                                 |
| `--tool-status-ready` (new)         | —         | `#9ec4a8` (muted sage)                                                     | Ready dot; replaces `bg-emerald-400` in credit pill |
| `--workspace-topbar-h` (new)        | —         | `44px`                                                                     | Top chrome height                                   |
| `--workspace-composer-max-w` (new)  | —         | `720px`                                                                    | Composer max width                                  |
| `--workspace-composer-bottom` (new) | —         | `20px`                                                                     | Composer bottom offset                              |

Status hues never fill a surface — only a 5px dot or short label. The only saturated UI element in the workspace is the primary "Make it" button (off-white on near-black). Resist adding accent color elsewhere.

## 8. Phased rollout

Three phases, each independently shippable behind `VITE_FEATURE_UNIFIED_WORKSPACE`. Flag wraps `CanvasWorkspace` at the public entry (`features/workspace-shell/index.ts`); old and new coexist for one sprint after Phase 3 ships before the legacy path is deleted.

### Phase 1 — Layout shell & floating composer

**New files**

- `features/workspace-shell/UnifiedCanvasWorkspace.tsx` — orchestrator with same `CanvasWorkspaceProps`
- `features/workspace-shell/FlaggedCanvasWorkspace.tsx` — internal switch reading `VITE_FEATURE_UNIFIED_WORKSPACE`
- `features/workspace-shell/components/WorkspaceTopBar.tsx`
- `features/workspace-shell/components/UnifiedCanvasPromptBar.tsx` — floating glass shell wrapping `PromptEditorSurface`
- `features/workspace-shell/components/PromptEditorSurface.tsx` — layout-agnostic editor body shared by old + new composer
- `features/workspace-shell/utils/computeWorkspaceMoment.ts`
- `features/workspace-shell/hooks/useWorkspaceProject.ts` — `{ name, rename(next: string) }`
- `features/workspace-shell/hooks/useWorkspaceCredits.ts` — `{ credits: number, avatarUrl: string | null }`

**Refactored files**

- `features/workspace-shell/components/CanvasPromptBar.tsx` — extract `PromptEditorSurface`; legacy path keeps `layoutMode` prop and centered styling
- `features/workspace-shell/index.ts` — export `CanvasWorkspace` from `FlaggedCanvasWorkspace`

**Globals**

- `client/src/index.css` — add `--workspace-topbar-h`, `--workspace-composer-max-w`, `--workspace-composer-bottom`. Bump `--tool-rail-width` 52→56.
- `client/vite-env.d.ts` (or equivalent) — type `VITE_FEATURE_UNIFIED_WORKSPACE` as `"true" | "false" | undefined`

**Tests**

- `computeWorkspaceMoment.test.ts` — table-driven across all 4 moments + edge cases
- `WorkspaceTopBar.test.tsx` — inline rename, disabled tabs with tooltip, credits formatting
- `UnifiedCanvasWorkspace.layout.test.tsx` — single-grid, no reflow asserted via stable layout snapshot across moment transitions
- `PromptEditorSurface.regression.test.tsx` — extracted surface preserves autocomplete, span highlights, custom request, all editor handlers
- All three existing regression tests (`failed-hero-retry`, `enhance`, `gallery-selection`) — pass against legacy path; under flag, also pass against new path

**Definition of done**

- Flag off: zero behavior change
- Flag on: new shell renders; gallery still flat; composer floats; no layout shift between moments
- All regression tests green on both paths

### Phase 2 — Shot grouping & ShotRow

**New files**

- `features/workspace-shell/utils/groupShots.ts`
- `features/workspace-shell/components/ShotRow.tsx` — two layouts: `compact` (older shots) + `featured` (active shot)
- `features/workspace-shell/components/GenTile.tsx` — three states (queued / rendering / ready); poster-first; IntersectionObserver pauses offscreen video
- `features/workspace-shell/components/ShotDivider.tsx`
- `features/workspace-shell/hooks/useFeaturedTile.ts` — derives featured tile from active shot + `heroGeneration` with failed-hero rules preserved
- `features/workspace-shell/hooks/useShotProgress.ts` — per-shot aggregate progress for header

**Refactored files**

- `UnifiedCanvasWorkspace.tsx` — replace flat `GalleryPanel` with `<ShotRow>` map
- `features/workspace-shell/events.ts` — add `CONTINUE_SCENE` event type and helpers
- `UnifiedCanvasPromptBar.tsx` — `useEffect` listener for `CONTINUE_SCENE`; opens `StartFramePopover` with prior tile's last frame pre-selected

**Tests**

- `groupShots.test.ts` — ordering, status aggregation, missing `promptVersionId` synthetic bucket
- `ShotRow.test.tsx` — compact vs featured rendering
- `GenTile.test.tsx` — three states, poster fallback, IntersectionObserver pause behavior
- `useFeaturedTile.test.ts` — featured selection rules; failed-hero retry interaction
- `gallery-selection.regression.test.tsx` — **updated** to assert featured-tile-of-active-shot semantics
- `failed-hero-retry.regression.test.tsx` — still untouched, must still pass against new path
- `continueScene.event.test.ts` — emit/listen contract + StartFramePopover seeding
- `tiles.perf.regression.test.tsx` — render 8 shots × 4 variants, assert ≤1 video element actively playing per handoff §10 risk #1

**Definition of done**

- Gallery groups by shot under flag-on
- Active shot has featured tile + variant stack
- Continue Scene seeds start-frame popover
- Perf test green: only featured tile preloads video; offscreen tiles paused

### Phase 3 — Tune drawer, polish, flag removal

**New files**

- `features/workspace-shell/components/TuneDrawer.tsx` — three rows (Motion / Mood / Style), chips toggle, count badges back to Tune button
- `features/workspace-shell/components/CostPreview.tsx`
- `features/workspace-shell/utils/estimateShotCost.ts` — sources from existing model pricing in `components/ToolSidebar/config/modelConfig`
- `features/workspace-shell/utils/tuneChips.ts` — chip → prompt-suffix mapping (Tune is text-append today per handoff §07; this stays)

**Refactored files**

- `features/workspace-shell/components/CanvasSettingsRow.tsx` — pull Tune chips out; keep aspect/duration/model dropdowns
- `UnifiedCanvasPromptBar.tsx` — Tune drawer mounts above editor; surface grows upward

**Globals**

- `client/src/index.css` — add `--tool-canvas-bg`, `--tool-status-rendering`, `--tool-status-ready`. Convert `--tool-surface-prompt` to `rgba(22,22,28,.72)` consumed via Tailwind `backdrop-blur-[18px]` utility.

**Phase 3 commit sequencing**

Phase 3 splits into three distinct commit groups, in order:

1. **Drawer add (new path only).** Add `TuneDrawer`, `CostPreview`, `estimateShotCost`, `tuneChips`. Wire them into `UnifiedCanvasPromptBar`. **Do not touch `CanvasSettingsRow`** yet — Tune chips remain in their current home for the legacy path so users on the unflipped flag don't lose Tune access.
2. **Token + visual polish.** Add the three new CSS custom properties to `index.css`; convert `--tool-surface-prompt` to glass.
3. **Flag removal (one mechanical commit).**
   - Delete `features/workspace-shell/components/NewSessionView.tsx`
   - Delete `features/workspace-shell/utils/computeIsEmptySession.ts` + its test
   - Delete legacy `features/workspace-shell/CanvasWorkspace.tsx`
   - Delete `FlaggedCanvasWorkspace.tsx`
   - Rename `UnifiedCanvasWorkspace.tsx` → `CanvasWorkspace.tsx` (preserves all import paths)
   - Drop `layoutMode` prop from `CanvasPromptBar`; if `UnifiedCanvasPromptBar` is now the only consumer of `PromptEditorSurface`, merge them into one file (decision deferred to writing-plans phase based on what's cleanest at the time)
   - Refactor `CanvasSettingsRow` to remove Tune chips (now sole consumer is the new path, where chips live in the drawer); keep aspect/duration/model dropdowns
   - Remove `VITE_FEATURE_UNIFIED_WORKSPACE` from env config and any `vite-env.d.ts` entry

**Survives flag removal — DO NOT DELETE**

- `features/workspace-shell/utils/galleryGeneration.ts` — consumed by `groupShots` in Phase 2
- `features/workspace-shell/components/CanvasHeroViewer.tsx` — becomes the featured-tile leaf rendered inside `ShotRow` (handoff §06: "Renamed conceptually to 'featured tile.' Becomes a leaf rendered inside the active shot row of the gallery, not a sibling")
- `features/workspace-shell/components/StoryboardHeroView.tsx` — orthogonal to this redesign per handoff §06

**Tests**

- `TuneDrawer.test.tsx`, `CostPreview.test.tsx`, `estimateShotCost.test.ts`, `tuneChips.test.ts`
- All Phase 1/2 tests still green
- `composer.layout.regression.test.tsx` — locks floating-composer position so future CSS changes can't regress it

**Definition of done**

- Only one canvas path
- Tune chrome live
- Cost preview wired to real model pricing
- All tokens active
- No dead exports

## 9. Accessibility & motion

(Per handoff §09; lifted verbatim into the implementation plan.)

**Keyboard**

- `⌘↵` submits from anywhere in composer (existing)
- `⌘K` focuses composer (new — replaces "click empty hero")
- `J / K` navigates between shots; `H / L` between variants in a shot
- Featured tile gets focus on load with `role="region"`, label "Active shot, variant 3 of 4"
- Tune chips are buttons with `aria-pressed`

**Screen reader**

- Each shot row: `<section>` with `aria-labelledby` → header
- Tile state changes announce via single `aria-live="polite"` region at composer level (not per-tile, to avoid spam)
- Mode tabs: `tablist`; only Video is real, others `aria-disabled`

**Motion**

- Tile skeleton sweep: 3s linear loop, paused under `prefers-reduced-motion`
- Tile entry: 200ms fade + 6px lift; none under reduced motion
- Tune drawer expand: 220ms ease, height-only
- Featured promotion (rendering → ready): 280ms cross-fade, no scale

**Focus**

- Submitting a shot does not move focus — composer keeps it
- Continue Scene moves focus into composer with seeded text selected
- Tune drawer toggle preserves caret position

## 10. Risks (carried from handoff §10)

| Severity         | Risk                                                          | Mitigation in this spec                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High · perf      | 8+ shots × 4 variants = 32+ poster videos potentially playing | `GenTile` defaults to poster image; only featured tile preloads video; `IntersectionObserver` pauses offscreen. Validated by `tiles.perf.regression.test.tsx` in Phase 2. |
| Med · data       | Legacy entries missing `promptVersionId`                      | `groupShots` falls back to synthetic `__legacy:<id>` bucket; design empty-state copy so it doesn't look broken                                                            |
| Med · scope      | Mode tabs are visual stubs                                    | Locked: `aria-disabled` with "Coming soon" tooltip                                                                                                                        |
| Low · regression | Failed-hero retry edge case                                   | `normalizePromptForComparison` dance preserved verbatim in `useFeaturedTile`; existing regression test passes unmodified                                                  |
| Low · ux         | Composer occlusion on short windows                           | Canvas bottom padding = composer height + 40px; tested down to 720px viewport                                                                                             |

## 11. Test contract summary

| Test                                    | Path                                  | Phase touched | Allowed to change?                                                                                                                   |
| --------------------------------------- | ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `failed-hero-retry.regression.test.tsx` | `features/workspace-shell/__tests__/` | none          | **No** — must pass unmodified                                                                                                        |
| `enhance.regression.test.tsx`           | `features/workspace-shell/__tests__/` | none\*        | **No** (\*if Phase 3 `CanvasSettingsRow` refactor changes the test's mounted DOM, fixture-only updates are allowed; assertions stay) |
| `gallery-selection.regression.test.tsx` | `features/workspace-shell/__tests__/` | Phase 2       | Yes — assertions update for featured-tile semantics                                                                                  |
| `events.test.ts`                        | `features/workspace-shell/__tests__/` | Phase 2       | Yes — extend with `CONTINUE_SCENE`                                                                                                   |

## 12. Out of scope (explicit)

- Pin shot affordance
- Mobile (any phase)
- Image / Audio / 3D pipelines (only their tab stubs ship)
- Tune as structured generation params (stays prompt-suffix per handoff §07)
- Backend changes (Continue Scene reuses existing media metadata)
- Editor itself (`PromptEditor`, `TriggerAutocomplete`, span highlighting unchanged)
- `useGenerationsRuntime` and `GenerationsPanelProps` shape

## 13. Commit-protocol notes

Every commit follows root `CLAUDE.md` §"Commit Protocol":

1. `npx tsc --noEmit` exits 0
2. `npx eslint --config config/lint/eslint.config.js . --quiet` reports 0 errors
3. `npm run test:unit` passes
4. Pre-commit hook enforces 1–2 plus regression-test rule for `fix:` commits

Phase 1 lands in ~6 commits (one per major file/concept), Phase 2 in ~8, Phase 3 in ~6 plus the flag-removal mechanical commit. Each phase ships behind the flag without coupling to the next.

---

**End of spec.** Implementation plan to follow via writing-plans skill once this spec is reviewed.
