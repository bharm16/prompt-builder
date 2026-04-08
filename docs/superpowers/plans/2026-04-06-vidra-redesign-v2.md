# Vidra Redesign v2 — Borderless Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Vidra from a container-heavy dark mode tool into a borderless creative canvas where content floats on a single dark surface with no visual containers.

**Architecture:** Changes span CSS tokens, component markup (removing wrapper divs), and span highlight rendering. The center canvas becomes borderless while the left rail and right gallery retain their bordered structural chrome.

**Tech Stack:** CSS custom properties, Tailwind CSS 3.3, React 18

---

## Key Principles

1. **No containers in the center canvas** — remove all card/box wrappers around prompt and preview
2. **No purple anywhere** — replace all violet accent usage with neutral white
3. **Collapse preview when idle** — prompt is the full-page hero
4. **Colored text only for spans** — remove all pill/chip background and border styling
5. **Adaptive layout** — prompt centered when idle, split when generating

---

### Task 1: Remove All Purple — Neutralize Accent Color

**Files:**
- Modify: `packages/promptstudio-system/src/tokens.css`
- Modify: `client/src/index.css`

Replace all violet/purple accent tokens with neutral white/gray equivalents.

- [ ] **Step 1: Update accent tokens in tokens.css**

Find and replace these values:
```
--ps-accent: #7c3aed → --ps-accent: #e0e0e4
--ps-accent-2: #a78bfa → --ps-accent-2: #c8c8d0
--ps-accent-runway: #7c3aed → --ps-accent-runway: #e0e0e4
--ps-info: var(--ps-accent) → (keep as-is, it inherits)
```

Update button tokens:
```
--ps-btn-primary-bg: #7c3aed → --ps-btn-primary-bg: #e0e0e4
--ps-btn-primary-hover: #6d28d9 → --ps-btn-primary-hover: #ffffff
--ps-btn-primary-text: #ffffff → --ps-btn-primary-text: #111116
--ps-btn-primary-shadow: ... → --ps-btn-primary-shadow: 0 2px 8px rgba(0, 0, 0, 0.3)
```

- [ ] **Step 2: Update tool tokens in index.css**

```
--tool-nav-active-bg: rgba(124, 58, 237, 0.12) → --tool-nav-active-bg: rgba(255, 255, 255, 0.05)
--tool-accent-purple: #a78bfa → --tool-accent-purple: #c8c8d0
--tool-nav-indicator: #7c3aed → --tool-nav-indicator: #c8c8d0
--tool-accent-selection: #7c3aed → --tool-accent-selection: #c8c8d0
```

- [ ] **Step 3: Update glow utility in index.css**

Replace `.glow-violet` with a neutral glow:
```css
.glow-violet {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.glow-violet:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 4: Run tsc, commit**

```bash
npx tsc --noEmit
git add packages/promptstudio-system/src/tokens.css client/src/index.css
git commit -m "style(v2): remove all purple — neutralize accent to white"
```

---

### Task 2: Span Labels — Colored Text Only

**Files:**
- Modify: `client/src/features/span-highlighting/config/highlightStyles.ts`

Currently span highlights apply background color, border, and ring via CSS custom properties. Change the rendering to apply ONLY text color — no background, no border, no ring.

- [ ] **Step 1: Read highlightStyles.ts to understand current implementation**

Read the file fully. Find the `applyHighlightStyles` function and `getHighlightClassName` function.

- [ ] **Step 2: Update getHighlightClassName to remove pill styling**

Remove the border, background, and pill-related classes. The highlight should only have the value-word class and category class for text coloring:

Remove these classes from the returned string:
- `border`
- `border-[var(--highlight-border)]`
- `bg-[var(--highlight-bg)]`
- `ps-highlight-pill`
- `rounded-md`

Keep:
- `value-word`
- `relative`
- `value-word-${category}`

- [ ] **Step 3: Update applyHighlightStyles to set text color**

Instead of setting `--highlight-bg`, `--highlight-border`, `--highlight-ring`, set the text color directly. Use the border color (which is the most saturated) as the text color:

```typescript
export function applyHighlightStyles(element: HTMLElement, color: HighlightColor): void {
  element.style.color = color.border.replace(/,\s*[\d.]+\)$/, ', 0.9)');
}
```

This takes the border color's RGB (which has the highest alpha/saturation) and applies it as text color at 0.9 opacity.

- [ ] **Step 4: Update categoryColors.ts if needed**

The `categoryColors` currently builds `bg`, `border`, and `ring` properties. We now only use `border` for text color. The `build` function can stay as-is — we just use a different property from it.

- [ ] **Step 5: Run tsc, run unit tests for categoryColors, commit**

```bash
npx tsc --noEmit
npx vitest run client/src/features/prompt-optimizer/config/__tests__/categoryColors.test.ts
git add client/src/features/span-highlighting/
git commit -m "style(v2): span labels as colored text only — remove pill styling"
```

---

### Task 3: Remove Container Wrappers — Borderless Canvas

**Files:**
- Modify: `client/src/features/workspace-shell/components/CanvasHeroViewer.tsx`
- Modify: `client/src/features/workspace-shell/CanvasWorkspace.tsx`

Remove the outer `<div className="relative overflow-hidden rounded-2xl bg-tool-surface-deep">` wrappers from all preview states in CanvasHeroViewer. The video/progress/error content should float directly on the canvas background.

- [ ] **Step 1: Remove container wrappers from CanvasHeroViewer**

For EACH state (generating, failed, no-media, completed), the current pattern is:
```tsx
<div className="relative overflow-hidden rounded-2xl bg-tool-surface-deep">
  <div key={generation.id} className="... bg-gradient-to-br from-tool-rail-border to-tool-surface-deep" style={{ aspectRatio }}>
    {/* content */}
  </div>
</div>
```

Remove the outer wrapper. The inner div becomes the root element for each state. Remove `bg-gradient-to-br from-tool-rail-border to-tool-surface-deep` background — let the canvas background show through. Keep `rounded-2xl` on the completed video state (rounded corners on the video itself).

For the **generating** state specifically: Replace the aurora gradient with the outline-that-fills approach:
```tsx
<div
  key={generation.id}
  className="relative mx-auto flex w-full max-w-[780px] flex-col items-center justify-center"
  style={{ aspectRatio, border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px' }}
>
  {/* Fill gradient from bottom */}
  <div
    className="pointer-events-none absolute bottom-0 left-0 right-0 transition-[height] duration-1000 ease-out"
    style={{
      height: `${clampedProgress}%`,
      background: 'linear-gradient(to top, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)',
      borderRadius: '0 0 13px 13px',
    }}
    aria-hidden="true"
  />
  {/* No text, no percentage, no cancel button visible by default */}
</div>
```

For the **failed** state: Replace with dim inline text, no icon:
```tsx
<div className="mx-auto flex max-w-[780px] items-center justify-center py-16">
  <p className="text-sm text-[#2a2a36]">
    Generation failed{generation.error ? ` · ${generation.error}` : ''}
  </p>
</div>
```

For the **completed** state: Keep the video but remove container wrapper:
```tsx
<div key={generation.id} className="relative mx-auto w-full max-w-[780px] overflow-hidden rounded-[14px]" style={{ aspectRatio }}>
  {/* video/image + metadata overlay — unchanged */}
</div>
```

- [ ] **Step 2: Remove CanvasTopBar from CanvasWorkspace**

In `CanvasWorkspace.tsx`, find `<CanvasTopBar />` and remove it. Also remove the import.

- [ ] **Step 3: Adjust spacing in CanvasWorkspace**

Update the gap between hero viewer and prompt bar to 12px. Find the `mb-5` class on the hero viewer wrapper div and change to `mb-3` (12px).

- [ ] **Step 4: Run tsc, commit**

```bash
npx tsc --noEmit
git add client/src/features/workspace-shell/
git commit -m "style(v2): remove container wrappers — borderless canvas"
```

---

### Task 4: Generate Button — White/Light

**Files:**
- Modify: `client/src/features/workspace-shell/components/CanvasSettingsRow.tsx`

- [ ] **Step 1: Update generate button styling**

Find the generate button (data-testid="canvas-generate-button"). Change its classes:

FROM: `bg-muted text-tool-surface-deep`
TO: `bg-[#e0e0e4] text-[#111116]`

The button should be a clean white/off-white with dark text/icon. Remove any glow or shadow classes if present.

- [ ] **Step 2: Run tsc, commit**

```bash
npx tsc --noEmit
git add client/src/features/workspace-shell/components/CanvasSettingsRow.tsx
git commit -m "style(v2): white generate button"
```

---

### Task 5: Gallery Thumbnails — Scale on Hover

**Files:**
- Modify: `client/src/features/prompt-optimizer/components/GalleryPanel/GalleryThumbnail.tsx` (or wherever thumbnail hover styles are defined)

- [ ] **Step 1: Find the gallery thumbnail component**

Search for GalleryThumbnail or the thumbnail rendering in the gallery panel.

- [ ] **Step 2: Add scale transition on hover**

Add `transition-transform duration-150` and `hover:scale-[1.03]` to the thumbnail container. Ensure active state uses neutral white border (not purple).

- [ ] **Step 3: Run tsc, commit**

```bash
npx tsc --noEmit
git add client/src/features/prompt-optimizer/components/GalleryPanel/
git commit -m "style(v2): gallery thumbnail scale on hover"
```

---

### Task 6: Prompt Font Size + Sessions Panel Restyle

**Files:**
- Modify: `packages/promptstudio-system/src/tokens.css` (reduce prompt display font size)
- Modify: `client/src/components/ToolSidebar/ToolSidebar.tsx` (sessions panel overlay styling)

- [ ] **Step 1: Reduce prompt font size**

The prompt text uses `font-display` which maps to Plus Jakarta Sans. The font size for the prompt editor is set via component classes. Find where the prompt editor font size is set and reduce to 15-16px. This may be in `CanvasPromptBar.tsx` or `PromptEditor.tsx` or via the `--ps-fs-16` token.

If it's controlled by a class like `text-body` or `text-lg`, check what that maps to and adjust.

- [ ] **Step 2: Restyle sessions panel overlay**

In `ToolSidebar.tsx`, the overlay panel div currently has:
```
bg-tool-panel-bg ... shadow-[24px_0_80px_rgba(0,0,0,0.45)]
```

Remove the gradient background. Use a flat dark bg matching the canvas. Reduce the shadow. Remove inner bg wrapper if it has one:

```tsx
className="absolute left-full top-0 z-20 h-full w-[400px] border-r border-tool-rail-border bg-[#0a0a0e]"
```

- [ ] **Step 3: Run tsc, commit**

```bash
npx tsc --noEmit
git add packages/promptstudio-system/src/tokens.css client/src/components/ToolSidebar/ToolSidebar.tsx
git commit -m "style(v2): reduce prompt font size, restyle sessions panel"
```

---

### Task 7: Final Validation

- [ ] **Step 1: Run full checks**

```bash
npx tsc --noEmit
npx eslint --config config/lint/eslint.config.js . --quiet
npm run test:unit
```

- [ ] **Step 2: Visual smoke test across all states**

1. New session (idle): Prompt centered, no preview area, no top bar, no purple
2. Type a prompt: Span labels are colored text only (no pills)
3. Start generation: Faint outline appears, fills from bottom
4. Generation complete: Video floats with rounded corners, no container
5. Generation failed: Dim text only
6. Sidebar: Thin icon rail, neutral active states
7. Sessions panel: Clean, borderless overlay
8. Generate button: White, inside floating toolbar
