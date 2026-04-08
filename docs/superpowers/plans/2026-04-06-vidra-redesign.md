# Vidra UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Vidra from a generic dark-mode tool into a cinematic creative studio with warm charcoal theme, violet accent, glassmorphism, adaptive layout, and intentional visual hierarchy.

**Architecture:** All color/spacing/radius changes propagate through CSS custom properties in `tokens.css` and `client/src/index.css`. Font loading via Google Fonts CDN in `index.html`. Component changes are isolated to specific React files. The design system's token → Tailwind preset → utility class pipeline means most visual changes only require token updates.

**Tech Stack:** CSS custom properties, Tailwind CSS 3.3, React 18, Phosphor Icons (already installed), Google Fonts (Plus Jakarta Sans, Geist Sans)

---

## File Map

| File                                                                  | Action | Responsibility                                                             |
| --------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| `client/index.html`                                                   | Modify | Add Google Fonts preconnect + stylesheet links                             |
| `packages/promptstudio-system/src/tokens.css`                         | Modify | Update color, font-family, radius, motion tokens                           |
| `client/src/index.css`                                                | Modify | Update tool-\* color tokens, body font-family, add glassmorphism utilities |
| `client/src/features/prompt-optimizer/config/categoryColors.ts`       | Modify | Warm/cool semantic color mapping                                           |
| `client/src/components/ToolSidebar/components/ToolRail.tsx`           | Modify | Convert from labeled sidebar to thin icon rail                             |
| `client/src/components/ToolSidebar/ToolSidebar.tsx`                   | Modify | Adjust rail width, panel overlay behavior                                  |
| `client/src/features/workspace-shell/components/CanvasHeroViewer.tsx` | Modify | Ambient atmospheric progress indicator                                     |
| `config/build/tailwind.config.js`                                     | Modify | Add glassmorphism + glow utilities                                         |

---

### Task 1: Install Fonts (Plus Jakarta Sans + Geist Sans)

**Files:**

- Modify: `client/index.html`
- Modify: `packages/promptstudio-system/src/tokens.css` (lines 7-12)
- Modify: `client/src/index.css` (lines 78-86)

- [ ] **Step 1: Add Google Fonts to index.html**

Add preconnect hints and font stylesheet links inside `<head>`, before the existing `<style>` block:

```html
<!-- Fonts: Plus Jakarta Sans (prompt text) + Geist Sans (UI chrome) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
<link
  href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap"
  rel="stylesheet"
/>
```

Place these BEFORE the `<style>` tag at line 24.

- [ ] **Step 2: Update font tokens in tokens.css**

In `packages/promptstudio-system/src/tokens.css`, replace lines 7-12:

```css
--ps-font-sans:
  "Geist", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "SF Pro Text", "Segoe UI", sans-serif;
--ps-font-display:
  "Plus Jakarta Sans", "Geist", ui-sans-serif, -apple-system,
  BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
```

The `--ps-font-sans` becomes Geist-first (UI chrome). The `--ps-font-display` becomes Plus Jakarta Sans-first (prompt text, headings).

- [ ] **Step 3: Update body font-family in index.css**

In `client/src/index.css`, replace lines 78-86:

```css
body {
  background-color: #131316;
  font-family:
    "Geist",
    ui-sans-serif,
    system-ui,
    -apple-system,
    "Segoe UI",
    sans-serif;
}
```

- [ ] **Step 4: Verify fonts load correctly**

Run: `npm run dev`

Open browser DevTools → Network tab → filter by "font". Verify:

- Plus Jakarta Sans woff2 files load (200 status)
- Geist woff2 files load (200 status)

Inspect body text — should render in Geist. Inspect any element using `font-display` class — should render in Plus Jakarta Sans.

- [ ] **Step 5: Commit**

```bash
git add client/index.html packages/promptstudio-system/src/tokens.css client/src/index.css
git commit -m "style: add Plus Jakarta Sans and Geist Sans fonts"
```

---

### Task 2: Update Color Tokens (Warm Charcoal + Violet Accent)

**Files:**

- Modify: `packages/promptstudio-system/src/tokens.css` (lines 155-177)
- Modify: `client/src/index.css` (lines 27-68, 99)

- [ ] **Step 1: Update core color tokens in tokens.css**

In `packages/promptstudio-system/src/tokens.css`, replace the color section (lines 155-177):

```css
/* =========================
   Color (warm charcoal + violet accent)
   ========================= */
--ps-bg: #131316; /* Warm charcoal base */
--ps-surface-1: #1a1a1f; /* Card/panel surface */
--ps-surface-2: #222228; /* Elevated surface */
--ps-surface-3: #2a2a32; /* Tertiary surface */
--ps-border: rgba(255, 255, 255, 0.08); /* Subtle separation */
--ps-border-strong: rgba(255, 255, 255, 0.14); /* Emphasized border */
--ps-text: #f0f0f3; /* Primary text */
--ps-text-muted: #b0b0be; /* Secondary text */
--ps-text-faint: #8b8b9e; /* Tertiary text */
--ps-text-ghost: #6b6b7e; /* Ghost/placeholder text */
--ps-text-warm: rgba(255, 255, 255, 0.95);
--ps-accent: #7c3aed; /* Violet accent */
--ps-accent-2: #a78bfa; /* Violet light variant */
--ps-accent-runway: #7c3aed; /* Map runway accent to violet */
--ps-accent-mj: #f2330d; /* Keep MJ orange */
--ps-success: #4ec7a2;
--ps-warning: #f5c05c;
--ps-danger: #fa6e7c;
--ps-info: var(--ps-accent);
--ps-overlay: rgba(10, 10, 14, 0.72);
```

- [ ] **Step 2: Update tool-specific tokens in index.css**

In `client/src/index.css`, replace the ToolSidebar Colors block (lines 27-68):

```css
/* ToolSidebar Colors — warm charcoal + violet */
--tool-rail-bg: #111114;
--tool-panel-bg: #131316;
--tool-panel-inner-bg: #111114;
--tool-rail-border: rgba(255, 255, 255, 0.06);
--tool-nav-active-bg: rgba(124, 58, 237, 0.12);
--tool-tab-active-bg: #222228;
--tool-border-primary: rgba(255, 255, 255, 0.08);
--tool-border-dark: rgba(255, 255, 255, 0.05);
--tool-border-dashed: rgba(255, 255, 255, 0.1);
--tool-text-primary: #f0f0f3;
--tool-text-secondary: #b0b0be;
--tool-text-muted: #8b8b9e;
--tool-text-placeholder: #6b6b7e;
--tool-accent-purple: #a78bfa;

/* Nav active indicator (violet accent) */
--tool-nav-indicator: #7c3aed;
--tool-nav-hover-bg: rgba(255, 255, 255, 0.04);
--tool-text-subdued: #4a4a5e;
--tool-surface-inset: #0e0e12;
--tool-surface-deep: #0c0c10;

/* Phase-0 tokens (updated for warm charcoal) */
--tool-text-dim: #6b6b7e;
--tool-text-label: #3a3a4a;
--tool-text-disabled: #2e2e3a;
--tool-surface-card: #16161a;
--tool-surface-prompt: #14141a;
--tool-surface-prompt-compact: #131318;
--tool-accent-selection: #7c3aed;
```

- [ ] **Step 3: Update #root background in index.css**

In `client/src/index.css`, update line 99:

```css
#root {
  background-color: #131316;
}
```

- [ ] **Step 4: Run type check and visual verification**

Run: `npx tsc --noEmit`
Expected: 0 errors (CSS-only changes shouldn't break types)

Run: `npm run dev`
Visual check: App should have warm charcoal tones instead of cold gray. Borders should be subtler (using rgba). Active nav items should have violet tint.

- [ ] **Step 5: Commit**

```bash
git add packages/promptstudio-system/src/tokens.css client/src/index.css
git commit -m "style: update color palette to warm charcoal with violet accent"
```

---

### Task 3: Update Span Label Colors (Warm/Cool Semantic Mapping)

**Files:**

- Modify: `client/src/features/prompt-optimizer/config/categoryColors.ts`

- [ ] **Step 1: Write a verification test for the new color mapping**

Create `client/src/features/prompt-optimizer/config/__tests__/categoryColors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { categoryColors } from "../categoryColors";

describe("categoryColors", () => {
  it("has entries for all expected categories", () => {
    const expected = [
      "shot",
      "subject",
      "action",
      "environment",
      "lighting",
      "camera",
      "style",
      "technical",
      "audio",
    ];
    for (const key of expected) {
      expect(categoryColors).toHaveProperty(key);
    }
  });

  it("warm categories use warm hues (red/orange/amber RGB channels)", () => {
    // Subject, action, style should have R channel > B channel in their base hex
    const warmCategories = ["subject", "action", "style"];
    for (const cat of warmCategories) {
      const entry = categoryColors[cat as keyof typeof categoryColors];
      // Extract RGB from the bg rgba string
      const match = entry.bg.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      expect(match).not.toBeNull();
      if (match) {
        const r = Number(match[1]);
        const b = Number(match[3]);
        expect(r).toBeGreaterThan(b);
      }
    }
  });

  it("cool categories use cool hues (blue/teal RGB channels)", () => {
    const coolCategories = ["camera", "lighting", "shot"];
    for (const cat of coolCategories) {
      const entry = categoryColors[cat as keyof typeof categoryColors];
      const match = entry.bg.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
      expect(match).not.toBeNull();
      if (match) {
        const b = Number(match[3]);
        const r = Number(match[1]);
        expect(b).toBeGreaterThanOrEqual(r);
      }
    }
  });

  it("each entry has bg, border, and ring properties", () => {
    for (const entry of Object.values(categoryColors)) {
      expect(entry).toHaveProperty("bg");
      expect(entry).toHaveProperty("border");
      expect(entry).toHaveProperty("ring");
      expect(entry.bg).toMatch(/^rgba\(/);
      expect(entry.border).toMatch(/^rgba\(/);
      expect(entry.ring).toMatch(/^rgba\(/);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails on current colors**

Run: `npx vitest run client/src/features/prompt-optimizer/config/__tests__/categoryColors.test.ts`

Expected: The "warm categories" test should FAIL because current `subject` uses `#ea580c` (warm, passes) but `style` uses `#7c3aed` (violet, R < B, fails). The "cool categories" test should FAIL because current `lighting` uses `#ca8a04` (warm yellow, R > B).

- [ ] **Step 3: Update category colors with warm/cool semantic mapping**

Replace the contents of `client/src/features/prompt-optimizer/config/categoryColors.ts`:

```typescript
export type CategoryHighlightColor = {
  bg: string;
  border: string;
  ring: string;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const build = (hex: string): CategoryHighlightColor => ({
  bg: hexToRgba(hex, 0.15),
  border: hexToRgba(hex, 0.35),
  ring: hexToRgba(hex, 0.18),
});

/**
 * Semantic warm/cool color mapping:
 * - WARM tones (amber, coral, rose) → human/creative categories
 * - COOL tones (steel blue, teal, indigo) → technical categories
 * - NEUTRAL tones (sage, lavender) → contextual categories
 */
export const categoryColors = {
  // Cool — technical
  shot: build("#3b82f6"), // Steel blue — framing is technical
  camera: build("#0ea5e9"), // Sky blue — optics, precision
  lighting: build("#06b6d4"), // Cyan/teal — light = cool spectrum

  // Warm — human/creative
  subject: build("#f59e0b"), // Amber/gold — human element, warm
  action: build("#f97316"), // Orange/coral — energy, movement
  style: build("#ec4899"), // Pink/rose — aesthetic, emotional

  // Neutral — contextual
  environment: build("#6b8a6b"), // Sage/olive — earth tones, grounding
  technical: build("#8b8baa"), // Muted lavender — technical metadata
  audio: build("#a78bfa"), // Soft violet — atmospheric, ambient
} as const;

export const DEFAULT_CATEGORY_COLOR = build("#94a3b8");
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run client/src/features/prompt-optimizer/config/__tests__/categoryColors.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Run full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add client/src/features/prompt-optimizer/config/categoryColors.ts client/src/features/prompt-optimizer/config/__tests__/categoryColors.test.ts
git commit -m "style: update span label colors to warm/cool semantic mapping"
```

---

### Task 4: Convert Sidebar to Thin Icon Rail

**Files:**

- Modify: `client/src/components/ToolSidebar/components/ToolRail.tsx`
- Modify: `client/src/components/ToolSidebar/ToolSidebar.tsx`
- Modify: `client/src/index.css` (line 18, `--tool-rail-width`)

**Context:** The current ToolRail renders at `w-60` (240px) with icon + text label for each nav item. We need to convert it to a 52px icon-only rail with tooltips. The ToolPanel (400px) should overlay when a nav item is clicked, rather than being side-by-side.

- [ ] **Step 1: Update rail width token**

In `client/src/index.css`, change line 18:

```css
--tool-rail-width: 52px;
```

- [ ] **Step 2: Convert ToolRail to icon-only layout**

In `client/src/components/ToolSidebar/components/ToolRail.tsx`, make these changes:

1. Change the root `<aside>` className from:

```
flex h-full w-60 flex-none flex-col items-stretch border-r border-tool-rail-border bg-black px-2.5 py-2.5
```

To:

```
flex h-full w-[52px] flex-none flex-col items-center border-r border-tool-rail-border bg-tool-rail-bg px-1.5 py-3
```

2. Change the Vidra logo from full text to initial:

```tsx
<div className="flex h-8 w-8 items-center justify-center">
  <span className="text-[15px] font-bold text-foreground">V</span>
</div>
```

3. Change nav item rendering. Each `ToolNavButton` should become icon-only with a tooltip. Remove the text label `<span>` elements. The button should be:

```tsx
<button
  className={cn(
    "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200",
    isActive
      ? "bg-tool-nav-active-bg text-white"
      : "text-tool-text-muted hover:bg-tool-nav-hover-bg hover:text-tool-text-primary",
  )}
  title={label} /* Native tooltip as minimal approach */
  onClick={onClick}
>
  <Icon size={20} weight={isActive ? "fill" : "regular"} />
</button>
```

4. Change the footer section. Profile should be avatar-only:

```tsx
<div className="flex flex-col items-center gap-1 pb-2">
  <Link
    to="/home"
    className="flex h-10 w-10 items-center justify-center rounded-xl text-tool-text-muted transition-colors hover:bg-tool-nav-hover-bg hover:text-tool-text-primary"
    title="Home"
  >
    <Home size={20} weight="regular" />
  </Link>
  <Link
    to={userActionLink}
    className="flex h-8 w-8 items-center justify-center"
    title={displayName}
  >
    {photoURL ? (
      <img src={photoURL} className="h-8 w-8 rounded-lg" alt={displayName} />
    ) : (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-body-sm font-bold text-foreground">
        {initial}
      </div>
    )}
  </Link>
</div>
```

- [ ] **Step 3: Update ToolSidebar container width**

In `client/src/components/ToolSidebar/ToolSidebar.tsx`, the outer container should use the narrower rail width. The ToolPanel should render as an absolute overlay from the rail's right edge (this may already be the behavior in `isCanvasFirstLayout` mode — verify and ensure it's used consistently):

The root div should remain `relative flex h-full overflow-visible` — the panel overlays already use `absolute left-full`.

- [ ] **Step 4: Visual verification**

Run: `npm run dev`

Visual check:

- Sidebar should be ~52px wide with icon-only navigation
- "V" logo at top
- Icons should use Phosphor `regular` weight (inactive) and `fill` weight (active)
- Active item should have violet-tinted background (`--tool-nav-active-bg: rgba(124, 58, 237, 0.12)`)
- Hovering should show native tooltip with label text
- Clicking should open the panel as an overlay
- Profile avatar at bottom

- [ ] **Step 5: Run type check and lint**

Run: `npx tsc --noEmit && npx eslint --config config/lint/eslint.config.js client/src/components/ToolSidebar/ --quiet`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add client/src/index.css client/src/components/ToolSidebar/
git commit -m "style: convert sidebar to thin 52px icon rail"
```

---

### Task 5: Adaptive Prompt-Centered Layout

**Files:**

- Modify: `client/src/features/workspace-shell/CanvasWorkspace.tsx`

**Context:** Currently the prompt bar sits at the bottom with a large preview void above it. The new behavior:

- **Idle (no generation):** Prompt editor centered vertically and horizontally. No preview void.
- **Generating/Complete:** Prompt animates downward. Preview expands above.

- [ ] **Step 1: Read current CanvasWorkspace layout**

Read `client/src/features/workspace-shell/CanvasWorkspace.tsx` fully to understand the current flex layout between `CanvasHeroViewer` and `CanvasPromptBar`.

- [ ] **Step 2: Add adaptive layout logic**

The key change is in the section that renders `CanvasHeroViewer` and `CanvasPromptBar`. Currently they're in a vertical flex column where the hero viewer takes available space and the prompt bar is fixed at the bottom.

Change the layout to be conditional:

```tsx
{
  /* Adaptive layout: centered when idle, split when generating */
}
<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
  {shouldRenderHero ? (
    <>
      {/* Preview takes top portion */}
      <div className="flex min-h-0 flex-1 items-center justify-center transition-all duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
        <CanvasHeroViewer
          generation={activeGeneration}
          onCancel={handleCancel}
        />
      </div>
      {/* Prompt bar at bottom */}
      <div className="flex-none">
        <CanvasPromptBar {...promptBarProps} />
      </div>
    </>
  ) : (
    /* No generation: prompt centered with empty-state guidance */
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-[720px] space-y-4">
        <CanvasPromptBar {...promptBarProps} />
      </div>
    </div>
  )}
</div>;
```

- [ ] **Step 3: Visual verification of both states**

Run: `npm run dev`

1. Open a new session (no generation): Prompt should be centered vertically and horizontally
2. Trigger a generation: Prompt should shift downward, preview expands above
3. Generation complete: Video stays as hero, prompt below

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add client/src/features/workspace-shell/CanvasWorkspace.tsx
git commit -m "style: adaptive prompt-centered layout (centered idle, split on generation)"
```

---

### Task 6: Atmospheric Progress Indicator

**Files:**

- Modify: `client/src/features/workspace-shell/components/CanvasHeroViewer.tsx`
- Modify: `client/src/index.css` (add aurora keyframe animation)

**Context:** Replace the plain circular progress indicator with an ambient atmospheric effect — a slowly rotating/pulsing violet-to-blue gradient behind the progress text.

- [ ] **Step 1: Add aurora animation keyframes to index.css**

In `client/src/index.css`, add before the `@media (prefers-reduced-motion)` block:

```css
@keyframes aurora-pulse {
  0% {
    background-position: 0% 50%;
    opacity: 0.6;
  }
  50% {
    background-position: 100% 50%;
    opacity: 0.8;
  }
  100% {
    background-position: 0% 50%;
    opacity: 0.6;
  }
}

@keyframes aurora-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

Also add to the `prefers-reduced-motion` block:

```css
.motion-aurora {
  animation: none !important;
}
```

- [ ] **Step 2: Update the generating state in CanvasHeroViewer**

In `client/src/features/workspace-shell/components/CanvasHeroViewer.tsx`, replace the generating state render (the `if (generation.status === "pending" || generation.status === "generating")` block).

Replace the inner content of the aspect-ratio container:

```tsx
{
  /* Atmospheric aurora background */
}
<div
  className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
  aria-hidden="true"
>
  <div
    className="motion-aurora absolute inset-[-50%] h-[200%] w-[200%]"
    style={{
      background:
        "conic-gradient(from 0deg, #7c3aed22, #3b82f622, #06b6d422, #7c3aed22)",
      animation: "aurora-rotate 12s linear infinite",
      filter: "blur(60px)",
    }}
  />
</div>;

{
  /* Cancel button */
}
{
  onCancel && (
    <button
      className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
      onClick={() => onCancel(generation)}
    >
      Cancel
    </button>
  );
}

{
  /* Progress content (center) */
}
<div className="relative z-10 flex flex-col items-center gap-5">
  {/* Progress percentage — large, clean */}
  <span className="text-2xl font-semibold tabular-nums text-foreground/90">
    {clampedProgress}%
  </span>

  {/* Status text */}
  <div className="space-y-1.5 text-center">
    <p className="text-sm font-medium tracking-wide text-foreground/80">
      {stageLabel}
    </p>
    <p className="text-xs tabular-nums text-tool-text-dim">
      {modelLabel} &middot; {elapsed}
      {eta ? ` \u00B7 est. ${eta}` : ""}
    </p>
  </div>
</div>;

{
  /* Bottom progress bar */
}
<div className="absolute inset-x-0 bottom-0 z-10 h-[2px] bg-white/5">
  <div
    className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-[width] duration-700 ease-out"
    style={{ width: `${clampedProgress}%` }}
  />
</div>;
```

This replaces the SVG circle with:

- A rotating conic gradient aurora background (violet → blue → cyan → violet)
- Blurred 60px to create soft atmospheric glow
- Clean percentage text as the focal point
- Gradient progress bar at the bottom (violet → blue)

- [ ] **Step 3: Visual verification**

Run: `npm run dev`

Trigger a generation. Verify:

- Soft rotating aurora gradient visible behind the progress area
- Percentage text is legible
- Progress bar at bottom fills with violet-to-blue gradient
- Cancel button has backdrop blur
- `prefers-reduced-motion` media query disables the animation

- [ ] **Step 4: Commit**

```bash
git add client/src/features/workspace-shell/components/CanvasHeroViewer.tsx client/src/index.css
git commit -m "style: atmospheric aurora progress indicator for generation"
```

---

### Task 7: Floating Toolbar with Glassmorphism

**Files:**

- Modify: `config/build/tailwind.config.js` (add glassmorphism utility)
- Modify: The component that renders the bottom toolbar controls (Start frame, Assets, 16:9, duration, scissors)

**Context:** The bottom settings controls (aspect ratio, duration, assets, etc.) currently sit inline at the bottom of the prompt area. Convert them to a floating pill bar with backdrop blur.

- [ ] **Step 1: Identify the bottom toolbar component**

Read the component that renders `Start frame | Assets | 16:9 | 5s | ✂` controls. Based on the screenshots, this is rendered inside `CanvasPromptBar` or `CanvasSettingsRow`. Read the component and identify exact rendering location.

The file is likely: `client/src/features/workspace-shell/components/CanvasSettingsRow.tsx`

- [ ] **Step 2: Style the toolbar as a floating glassmorphism pill**

Wrap the settings controls in a floating container:

```tsx
<div className="flex justify-center py-3">
  <div
    className="inline-flex items-center gap-1.5 rounded-2xl border border-white/[0.08] px-3 py-1.5"
    style={{
      backgroundColor: "rgba(26, 26, 31, 0.75)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    }}
  >
    {/* existing controls: Start frame, Assets, 16:9, 5s, scissors */}
  </div>
</div>
```

Key visual properties:

- `rounded-2xl` (16px) — pill shape
- `border border-white/[0.08]` — subtle glass edge
- Semi-transparent background with backdrop blur
- Centered horizontally with `justify-center`

- [ ] **Step 3: Visual verification**

Run: `npm run dev`

Verify:

- Toolbar floats as a pill below the prompt
- Backdrop blur visible (content behind shows through slightly)
- Subtle border visible
- Controls remain functional (aspect ratio dropdown, duration, etc.)

- [ ] **Step 4: Commit**

```bash
git add client/src/features/workspace-shell/components/CanvasSettingsRow.tsx
git commit -m "style: floating glassmorphism toolbar pill"
```

---

### Task 8: Button Styling + Component Polish

**Files:**

- Modify: `packages/promptstudio-system/src/tokens.css` (button tokens, radius)
- Modify: `client/src/index.css` (add glow utility)

**Context:** Update primary buttons to use violet fill with subtle glow. Update corner radius to soft modern (8-12px). Add glassmorphism support for dropdowns and popovers.

- [ ] **Step 1: Update button tokens in tokens.css**

Find the button/component token section in `tokens.css` and update:

```css
--ps-btn-primary-bg: #7c3aed;
--ps-btn-primary-hover: #6d28d9;
--ps-btn-primary-text: #ffffff;
--ps-btn-primary-shadow:
  0 0 20px rgba(124, 58, 237, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3);
```

- [ ] **Step 2: Add glow utility to index.css**

In `client/src/index.css`, add to the `@layer utilities` block:

```css
.glow-violet {
  box-shadow:
    0 0 20px rgba(124, 58, 237, 0.3),
    0 4px 12px rgba(0, 0, 0, 0.3);
}

.glow-violet:hover {
  box-shadow:
    0 0 28px rgba(124, 58, 237, 0.4),
    0 6px 16px rgba(0, 0, 0, 0.35);
}

.glass {
  background: rgba(26, 26, 31, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 3: Update the Generate button**

Find the Generate button component (likely in `GenerationFooter.tsx`). Update its classes to use the violet accent with glow:

Replace the existing gradient styling with:

```tsx
className =
  "... bg-[#7c3aed] hover:bg-[#6d28d9] glow-violet transition-all duration-200 ...";
```

Remove any existing `linear-gradient` or `background-image` inline styles on the Generate button and replace with the solid violet + glow approach.

- [ ] **Step 4: Update radius tokens**

In `tokens.css`, verify the radius values match the spec:

```css
--ps-r-xs: 2px;
--ps-r-sm: 4px;
--ps-r-md: 6px;
--ps-r-lg: 8px; /* Buttons, chips */
--ps-r-xl: 12px; /* Cards, containers */
--ps-r-2xl: 14px;
--ps-r-3xl: 16px; /* Floating toolbar */
--ps-r-pill: 9999px;
```

These already match the target values (confirmed from reading tokens.css). No change needed.

- [ ] **Step 5: Visual verification**

Run: `npm run dev`

Verify:

- Generate button is violet with a soft outer glow
- Glow intensifies on hover
- Corner radius feels consistent (8px on buttons, 12px on cards)

- [ ] **Step 6: Run all checks**

```bash
npx tsc --noEmit
npx eslint --config config/lint/eslint.config.js . --quiet
npm run test:unit
```

Expected: All pass with 0 errors.

- [ ] **Step 7: Commit**

```bash
git add packages/promptstudio-system/src/tokens.css client/src/index.css client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter.tsx
git commit -m "style: violet glow buttons, glassmorphism utilities, component polish"
```

---

### Task 9: Motion Timing Updates

**Files:**

- Modify: `packages/promptstudio-system/src/tokens.css` (motion section)
- Modify: `client/src/index.css` (motion variables)

**Context:** Update default motion timing to match the "smooth cinematic" spec: 200-300ms ease-out for standard transitions.

- [ ] **Step 1: Update motion tokens**

In `packages/promptstudio-system/src/tokens.css`, update the motion section (lines ~142-153):

```css
--ps-dur-1: 100ms;
--ps-dur-2: 200ms; /* Standard transition */
--ps-dur-3: 300ms; /* Emphasized transition */
--ps-dur-4: 400ms; /* Layout shifts */
--ps-motion-fast: 150ms;
--ps-motion-base: 200ms; /* Default */
--ps-motion-slow: 300ms; /* Emphasized */
--ps-ease-out: cubic-bezier(0.22, 1, 0.36, 1); /* Smooth cinematic ease-out */
--ps-ease-in: cubic-bezier(0.7, 0, 0.84, 0);
--ps-ease-inout: cubic-bezier(0.65, 0, 0.35, 1);
--ps-ease-linear: linear;
```

- [ ] **Step 2: Update index.css motion variables**

In `client/src/index.css`, update the motion variables:

```css
:root {
  --motion-ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
  --motion-ease-emphasized: cubic-bezier(0.22, 1, 0.36, 1);
  --motion-dur-press: 150ms;
  --motion-dur-focus: 200ms;
  --motion-dur-panel: 250ms;
  --motion-dur-media: 300ms;
  --motion-dur-emphasis: 400ms;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/promptstudio-system/src/tokens.css client/src/index.css
git commit -m "style: update motion timing to smooth cinematic (200-300ms ease-out)"
```

---

### Task 10: Final Validation

- [ ] **Step 1: Run full validation suite**

```bash
npx tsc --noEmit
npx eslint --config config/lint/eslint.config.js . --quiet
npm run test:unit
npm run build
```

All must pass with 0 errors.

- [ ] **Step 2: Visual smoke test**

Run: `npm run dev`

Walk through these states:

1. **New session (empty):** Prompt should be centered, warm charcoal background, violet accents
2. **Type a prompt:** Span labels should use warm/cool semantic colors
3. **Start generation:** Atmospheric aurora progress, prompt shifts down
4. **Generation complete:** Video as hero, prompt below
5. **Sidebar:** Thin icon rail, overlay panel on click
6. **Generate button:** Violet with glow effect
7. **Bottom toolbar:** Floating pill with backdrop blur

- [ ] **Step 3: Commit any final adjustments**

If visual issues are found, fix and commit individually.

---

## Summary of Changes

| Area         | Before                      | After                                        |
| ------------ | --------------------------- | -------------------------------------------- |
| **Theme**    | Cold gray (#16181d)         | Warm charcoal (#131316)                      |
| **Accent**   | Blue (#2c22fa) / White      | Violet (#7c3aed) with glow                   |
| **Fonts**    | Inter (system)              | Geist Sans (UI) + Plus Jakarta Sans (prompt) |
| **Sidebar**  | 240px with labels           | 52px icon rail                               |
| **Layout**   | Fixed split (void + prompt) | Adaptive (centered idle, split on generate)  |
| **Toolbar**  | Inline flat bar             | Floating glassmorphism pill                  |
| **Progress** | SVG circle + percentage     | Atmospheric aurora + percentage              |
| **Spans**    | Random colors               | Warm/cool semantic mapping                   |
| **Borders**  | Solid hex colors            | Subtle rgba(255,255,255,0.08)                |
| **Motion**   | 75-200ms                    | 150-400ms cinematic ease-out                 |
| **Radius**   | Already 2-16px scale        | No change needed                             |
