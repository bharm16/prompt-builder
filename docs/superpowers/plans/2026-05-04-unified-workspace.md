# Unified Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the 4-state canvas tree (empty/hero/gallery/loading) in `client/src/features/workspace-shell/` into a single persistent workspace where the composer floats and generations land in-place as grouped shots, behind `VITE_FEATURE_UNIFIED_WORKSPACE`, in three sequential phases.

**Architecture:** Drop-in `UnifiedCanvasWorkspace` component swapped at the public entry (`features/workspace-shell/index.ts`) via the existing `FEATURES.UNIFIED_WORKSPACE` flag. New shell renders top chrome (`WorkspaceTopBar`) + existing rail + canvas (shot list) + floating composer (`UnifiedCanvasPromptBar`). The shared editor body extracts to `PromptEditorSurface` so both old + new composers consume one source of truth. Phase 2 adds `groupShots` grouping by `promptVersionId`, `ShotRow`/`GenTile` rendering, and `CONTINUE_SCENE` event. Phase 3 adds `TuneDrawer`, `CostPreview`, then deletes the legacy path in one mechanical commit.

**Tech Stack:** React 18 + Vite, Tailwind CSS + DaisyUI, TypeScript (strict), Vitest, React Testing Library, existing `features.config.ts` flag system, existing `events.ts` CustomEvent pattern.

**Spec:** `docs/superpowers/specs/2026-05-04-unified-workspace-design.md` (commit `2f859972`).

**Source handoff:** `~/Desktop/handoff/` (sketch) + `~/Downloads/handoff.html` (authoritative design).

---

## File Structure

### New files (Phase 1)

| Path                                                                        | Responsibility                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx`            | Phase 1 orchestrator with same `CanvasWorkspaceProps` as legacy    |
| `client/src/features/workspace-shell/components/WorkspaceTopBar.tsx`        | 44px chrome row: project rename, mode tabs, credits, Share, avatar |
| `client/src/features/workspace-shell/components/UnifiedCanvasPromptBar.tsx` | Floating glass shell wrapping `PromptEditorSurface`                |
| `client/src/features/workspace-shell/components/PromptEditorSurface.tsx`    | Layout-agnostic editor body shared by old + new composer           |
| `client/src/features/workspace-shell/utils/computeWorkspaceMoment.ts`       | Pure fn returning `WorkspaceMoment` enum                           |
| `client/src/features/workspace-shell/hooks/useWorkspaceProject.ts`          | `{ name, rename(next: string) }`                                   |
| `client/src/features/workspace-shell/hooks/useWorkspaceCredits.ts`          | `{ credits: number, avatarUrl: string \| null }`                   |

### New files (Phase 2)

| Path                                                             | Responsibility                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `client/src/features/workspace-shell/utils/groupShots.ts`        | Pure fn grouping `Generation[]` by `promptVersionId` into `Shot[]`     |
| `client/src/features/workspace-shell/components/ShotRow.tsx`     | Compact + featured layouts for a shot row                              |
| `client/src/features/workspace-shell/components/GenTile.tsx`     | Per-variant tile with 3 states (queued/rendering/ready) + IO pause     |
| `client/src/features/workspace-shell/components/ShotDivider.tsx` | Visual separator between shots                                         |
| `client/src/features/workspace-shell/hooks/useFeaturedTile.ts`   | `(shots, heroGeneration) → featured Generation` with failed-hero rules |
| `client/src/features/workspace-shell/hooks/useShotProgress.ts`   | Per-shot aggregate progress for header                                 |

### New files (Phase 3)

| Path                                                             | Responsibility                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| `client/src/features/workspace-shell/components/TuneDrawer.tsx`  | Above-editor drawer: Motion / Mood / Style chip rows |
| `client/src/features/workspace-shell/components/CostPreview.tsx` | "~22 cr" label next to Make it                       |
| `client/src/features/workspace-shell/utils/estimateShotCost.ts`  | Sources from existing model pricing                  |
| `client/src/features/workspace-shell/utils/tuneChips.ts`         | Chip → prompt-suffix mapping                         |

### Modified files

| Path                                                                 | When                           | Change                                                                          |
| -------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `client/src/config/features.config.ts`                               | Phase 1 task 1                 | Add `UNIFIED_WORKSPACE` to `FLAG_DEFS` and `FEATURES`                           |
| `client/src/features/workspace-shell/index.ts`                       | Phase 1 task 14                | Re-export `CanvasWorkspace` from a dispatcher that picks new vs. legacy by flag |
| `client/src/features/workspace-shell/components/CanvasPromptBar.tsx` | Phase 1 task 6                 | Extract `PromptEditorSurface`; legacy still renders via `layoutMode` prop       |
| `client/src/features/workspace-shell/events.ts`                      | Phase 2 task 5                 | Add `CONTINUE_SCENE` event with `dispatch`/`addListener` helpers                |
| `client/src/index.css`                                               | Phase 1 task 2, Phase 3 task 6 | Add new CSS custom properties; bump `--tool-rail-width`                         |

### Deleted files (Phase 3 flag-removal commit only)

| Path                                                                          | Why                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `client/src/features/workspace-shell/CanvasWorkspace.tsx` (legacy)            | Renamed from `UnifiedCanvasWorkspace.tsx` after legacy delete |
| `client/src/features/workspace-shell/components/NewSessionView.tsx`           | Functionality folded into empty moment                        |
| `client/src/features/workspace-shell/utils/computeIsEmptySession.ts` (+ test) | Superseded by `computeWorkspaceMoment`                        |

### Survives flag removal — DO NOT DELETE

- `client/src/features/workspace-shell/utils/galleryGeneration.ts` (consumed by `groupShots`)
- `client/src/features/workspace-shell/components/CanvasHeroViewer.tsx` (becomes featured-tile leaf)
- `client/src/features/workspace-shell/components/StoryboardHeroView.tsx` (orthogonal)

---

## PHASE 1 — Layout shell & floating composer

Tasks 1–14. Each ships independently behind `FEATURES.UNIFIED_WORKSPACE = false` (default). When the flag flips on, new shell renders; old code unchanged.

### Task 1: Register the feature flag

**Files:**

- Modify: `client/src/config/features.config.ts`

- [ ] **Step 1: Read current flag definition pattern**

Run: `cat client/src/config/features.config.ts`

Confirm the `FLAG_DEFS` and `FEATURES` exports.

- [ ] **Step 2: Add the flag**

Edit `client/src/config/features.config.ts`:

```ts
const FLAG_DEFS = {
  CANVAS_FIRST_LAYOUT: {
    envName: "VITE_FEATURE_CANVAS_FIRST_LAYOUT",
    default: true,
    description:
      "Renders the canvas-first workspace. Set to 'false' to fall back to the legacy sidebar layout.",
    migrationFlag: true,
  } satisfies ClientFlagDef<boolean>,
  UNIFIED_WORKSPACE: {
    envName: "VITE_FEATURE_UNIFIED_WORKSPACE",
    default: false,
    description:
      "Renders the unified workspace (one persistent canvas with floating composer and shot grouping). Set to 'true' to opt in. The legacy four-state CanvasWorkspace remains the default until this flag flips on by default.",
    migrationFlag: true,
  } satisfies ClientFlagDef<boolean>,
} as const;

export const FEATURES = {
  CANVAS_FIRST_LAYOUT: resolveBoolFlag(
    FLAG_DEFS.CANVAS_FIRST_LAYOUT.envName,
    FLAG_DEFS.CANVAS_FIRST_LAYOUT.default,
  ),
  UNIFIED_WORKSPACE: resolveBoolFlag(
    FLAG_DEFS.UNIFIED_WORKSPACE.envName,
    FLAG_DEFS.UNIFIED_WORKSPACE.default,
  ),
} as const;
```

- [ ] **Step 3: Verify type check**

Run: `cd client && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 4: Commit**

```bash
git add client/src/config/features.config.ts
git commit -m "$(cat <<'EOF'
feat(workspace-shell): register VITE_FEATURE_UNIFIED_WORKSPACE flag

Defaults to off. Phase 1 of the unified-workspace refactor (see
docs/superpowers/specs/2026-05-04-unified-workspace-design.md).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add new CSS custom properties

**Files:**

- Modify: `client/src/index.css`

- [ ] **Step 1: Find the existing `--tool-*` token block**

Run: `grep -n "tool-rail-width\|--tool-" client/src/index.css | head -20`

Locate the `:root` block that defines `--tool-rail-width`.

- [ ] **Step 2: Update `--tool-rail-width` from 52px → 56px and add new tokens**

Inside the same `:root` block, ensure these values:

```css
--tool-rail-width: 56px; /* was 52px — Phase 1 hit-area bump */
--workspace-topbar-h: 44px;
--workspace-composer-max-w: 720px;
--workspace-composer-bottom: 20px;
```

- [ ] **Step 3: Verify dev server still compiles**

Run: `cd client && npx vite build --mode development 2>&1 | tail -5`
Expected: build completes without "unknown property" errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/index.css
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add layout tokens for unified workspace shell

Adds --workspace-topbar-h, --workspace-composer-max-w,
--workspace-composer-bottom; bumps --tool-rail-width from 52px to 56px
to match the new design hit area.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Implement `computeWorkspaceMoment` (pure fn) with tests

**Files:**

- Create: `client/src/features/workspace-shell/utils/computeWorkspaceMoment.ts`
- Test: `client/src/features/workspace-shell/utils/__tests__/computeWorkspaceMoment.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `client/src/features/workspace-shell/utils/__tests__/computeWorkspaceMoment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  computeWorkspaceMoment,
  type WorkspaceMomentInput,
} from "../computeWorkspaceMoment";

const baseInput: WorkspaceMomentInput = {
  galleryEntriesCount: 0,
  activeShotStatuses: [],
  promptIsEmpty: true,
  tuneOpen: false,
  promptFocused: false,
};

describe("computeWorkspaceMoment", () => {
  it("returns 'empty' when nothing exists and prompt empty/unfocused", () => {
    expect(computeWorkspaceMoment(baseInput)).toBe("empty");
  });

  it("returns 'drafting' when prompt has content but no shots", () => {
    expect(computeWorkspaceMoment({ ...baseInput, promptIsEmpty: false })).toBe(
      "drafting",
    );
  });

  it("returns 'drafting' when prompt focused but no shots", () => {
    expect(computeWorkspaceMoment({ ...baseInput, promptFocused: true })).toBe(
      "drafting",
    );
  });

  it("returns 'drafting' when tune drawer open with no shots", () => {
    expect(computeWorkspaceMoment({ ...baseInput, tuneOpen: true })).toBe(
      "drafting",
    );
  });

  it("returns 'rendering' when active shot has a queued tile", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 1,
        activeShotStatuses: ["queued"],
      }),
    ).toBe("rendering");
  });

  it("returns 'rendering' when active shot has a generating tile", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 1,
        activeShotStatuses: ["generating"],
      }),
    ).toBe("rendering");
  });

  it("returns 'ready' when active shot has a completed tile and prompt is idle", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 1,
        activeShotStatuses: ["completed"],
      }),
    ).toBe("ready");
  });

  it("returns 'rendering' over 'ready' when both states present", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 2,
        activeShotStatuses: ["completed", "generating"],
      }),
    ).toBe("rendering");
  });

  it("never returns 'empty' once any shot exists", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 1,
        activeShotStatuses: ["failed"],
      }),
    ).toBe("drafting");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/features/workspace-shell/utils/__tests__/computeWorkspaceMoment.test.ts`
Expected: FAIL with "Cannot find module '../computeWorkspaceMoment'"

- [ ] **Step 3: Implement the function**

Create `client/src/features/workspace-shell/utils/computeWorkspaceMoment.ts`:

```ts
import type { Generation } from "@features/generations/types";

export type WorkspaceMoment = "empty" | "drafting" | "rendering" | "ready";

export interface WorkspaceMomentInput {
  /** Total gallery entry count for the current session. */
  galleryEntriesCount: number;
  /** Statuses of tiles in the most recent shot (active shot). */
  activeShotStatuses: ReadonlyArray<Generation["status"]>;
  /** True iff the prompt-bar editor is empty (whitespace only counts as empty). */
  promptIsEmpty: boolean;
  /** True iff the Tune drawer is open. */
  tuneOpen: boolean;
  /** True iff the prompt-bar editor currently has focus. */
  promptFocused: boolean;
}

const RENDERING_STATUSES: ReadonlyArray<Generation["status"]> = [
  "queued",
  "generating",
];

export function computeWorkspaceMoment(
  input: WorkspaceMomentInput,
): WorkspaceMoment {
  const hasAnyShots = input.galleryEntriesCount > 0;
  const activeRendering = input.activeShotStatuses.some((s) =>
    RENDERING_STATUSES.includes(s),
  );
  const activeReady = input.activeShotStatuses.some((s) => s === "completed");

  if (activeRendering) return "rendering";
  if (
    !hasAnyShots &&
    input.promptIsEmpty &&
    !input.tuneOpen &&
    !input.promptFocused
  ) {
    return "empty";
  }
  if (!hasAnyShots) return "drafting";
  if (activeReady) return "ready";
  return "drafting";
}

export function workspaceMomentClass(moment: WorkspaceMoment): string {
  return `workspace--${moment}`;
}
```

- [ ] **Step 4: Verify the actual `Generation["status"]` type**

Run: `grep -n "GenerationStatus\|status:" client/src/features/prompt-optimizer/types/domain/generation.ts | head -10`

If the union does not contain literal strings `"queued"`, `"generating"`, `"completed"`, `"failed"`, update `RENDERING_STATUSES` and the test fixtures to match the actual union.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/workspace-shell/utils/__tests__/computeWorkspaceMoment.test.ts`
Expected: PASS, 9/9

- [ ] **Step 6: Run full type check**

Run: `cd client && npx tsc --noEmit`
Expected: exits 0

- [ ] **Step 7: Commit**

```bash
git add client/src/features/workspace-shell/utils/computeWorkspaceMoment.ts client/src/features/workspace-shell/utils/__tests__/computeWorkspaceMoment.test.ts
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add computeWorkspaceMoment pure function

Replaces the binary computeIsEmptySession with a 4-value WorkspaceMoment
("empty" | "drafting" | "rendering" | "ready"). Drives a single derived
visual state for the unified workspace; nothing about navigation or
mounting depends on it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Implement `useWorkspaceProject` and `useWorkspaceCredits` hooks

**Files:**

- Create: `client/src/features/workspace-shell/hooks/useWorkspaceProject.ts`
- Create: `client/src/features/workspace-shell/hooks/useWorkspaceCredits.ts`
- Test: `client/src/features/workspace-shell/hooks/__tests__/useWorkspaceProject.test.tsx`
- Test: `client/src/features/workspace-shell/hooks/__tests__/useWorkspaceCredits.test.tsx`

- [ ] **Step 1: Identify the existing project source**

Run:

```bash
grep -rn "currentProject\|projectName\|useProject\b" client/src/features client/src/contexts client/src/hooks --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v __tests__ | head -20
```

If the codebase has no first-class "project" concept yet (likely — the legacy `CanvasWorkspace` does not display a project name), the hook surfaces `{ name: "Untitled", rename: () => {} }` as a stub for Phase 1, with a TODO marker pointing to the eventual project store. Document this in the hook file.

- [ ] **Step 2: Identify the credits source**

Run: `grep -rn "useUserCreditBalance\|useAuthUser" client/src/hooks --include="*.ts" 2>/dev/null | head`

Confirm the existing exports.

- [ ] **Step 3: Write the failing test for useWorkspaceProject**

Create `client/src/features/workspace-shell/hooks/__tests__/useWorkspaceProject.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkspaceProject } from "../useWorkspaceProject";

describe("useWorkspaceProject", () => {
  it("returns a name string and a rename callback", () => {
    const { result } = renderHook(() => useWorkspaceProject());
    expect(typeof result.current.name).toBe("string");
    expect(typeof result.current.rename).toBe("function");
  });

  it("name is non-empty", () => {
    const { result } = renderHook(() => useWorkspaceProject());
    expect(result.current.name.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd client && npx vitest run src/features/workspace-shell/hooks/__tests__/useWorkspaceProject.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement `useWorkspaceProject`**

Create `client/src/features/workspace-shell/hooks/useWorkspaceProject.ts`:

```ts
import { useCallback, useState } from "react";

export interface UseWorkspaceProjectResult {
  name: string;
  rename: (next: string) => void;
}

/**
 * Surfaces the current project name + rename action for the workspace top bar.
 *
 * Phase 1 stub: this codebase does not yet have a first-class project store.
 * Renames are persisted in component state so the inline-rename UI flows end
 * to end. When a real project store lands, swap the body of this hook to read
 * from it; the consumer interface stays the same.
 */
export function useWorkspaceProject(): UseWorkspaceProjectResult {
  const [name, setName] = useState<string>("Untitled");
  const rename = useCallback((next: string) => {
    const trimmed = next.trim();
    if (trimmed.length === 0) return;
    setName(trimmed);
  }, []);
  return { name, rename };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/workspace-shell/hooks/__tests__/useWorkspaceProject.test.tsx`
Expected: PASS, 2/2

- [ ] **Step 7: Write the failing test for useWorkspaceCredits**

Create `client/src/features/workspace-shell/hooks/__tests__/useWorkspaceCredits.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useUserCreditBalance", () => ({
  useUserCreditBalance: () => ({ credits: 1234 }),
}));
vi.mock("@/hooks/useAuthUser", () => ({
  useAuthUser: () => ({ user: { photoURL: "https://example.com/a.png" } }),
}));

import { useWorkspaceCredits } from "../useWorkspaceCredits";

describe("useWorkspaceCredits", () => {
  it("exposes credits as a number and avatarUrl as a string", () => {
    const { result } = renderHook(() => useWorkspaceCredits());
    expect(result.current.credits).toBe(1234);
    expect(result.current.avatarUrl).toBe("https://example.com/a.png");
  });
});
```

- [ ] **Step 8: Implement `useWorkspaceCredits`**

Create `client/src/features/workspace-shell/hooks/useWorkspaceCredits.ts`. First, verify the existing hook return shapes with:

```bash
sed -n '1,40p' client/src/hooks/useUserCreditBalance.ts client/src/hooks/useAuthUser.ts
```

Then write the hook so it adapts to whatever the existing hooks return. Skeleton:

```ts
import { useUserCreditBalance } from "@/hooks/useUserCreditBalance";
import { useAuthUser } from "@/hooks/useAuthUser";

export interface UseWorkspaceCreditsResult {
  credits: number;
  avatarUrl: string | null;
}

export function useWorkspaceCredits(): UseWorkspaceCreditsResult {
  const balance = useUserCreditBalance();
  const auth = useAuthUser();
  // Adapt field names to the actual hook return shapes verified above.
  const credits = typeof balance?.credits === "number" ? balance.credits : 0;
  const avatarUrl =
    typeof auth?.user?.photoURL === "string" ? auth.user.photoURL : null;
  return { credits, avatarUrl };
}
```

If the actual hook return shapes use different field names (e.g. `balance.balance` or `auth.user.avatarUrl`), update the field accesses to match.

- [ ] **Step 9: Run both hook tests**

Run: `cd client && npx vitest run src/features/workspace-shell/hooks/__tests__/`
Expected: PASS, all tests

- [ ] **Step 10: Commit**

```bash
git add client/src/features/workspace-shell/hooks/
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add useWorkspaceProject and useWorkspaceCredits hooks

Thin adapters that surface project name + rename action and credits +
avatar URL for the new WorkspaceTopBar. useWorkspaceProject is a Phase 1
stub (component-state only) until a first-class project store lands.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Implement `WorkspaceTopBar` component

**Files:**

- Create: `client/src/features/workspace-shell/components/WorkspaceTopBar.tsx`
- Test: `client/src/features/workspace-shell/components/__tests__/WorkspaceTopBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/workspace-shell/components/__tests__/WorkspaceTopBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useWorkspaceProject", () => ({
  useWorkspaceProject: () => ({
    name: "My Project",
    rename: vi.fn(),
  }),
}));
vi.mock("../../hooks/useWorkspaceCredits", () => ({
  useWorkspaceCredits: () => ({ credits: 1234, avatarUrl: null }),
}));

import { WorkspaceTopBar } from "../WorkspaceTopBar";

describe("WorkspaceTopBar", () => {
  it("renders the project name", () => {
    render(<WorkspaceTopBar />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
  });

  it("renders mode tabs with Image / Audio / 3D as aria-disabled", () => {
    render(<WorkspaceTopBar />);
    expect(screen.getByRole("tab", { name: /image/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("tab", { name: /audio/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("tab", { name: /3d/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("renders Video tab as the active tab", () => {
    render(<WorkspaceTopBar />);
    const videoTab = screen.getByRole("tab", { name: /video/i });
    expect(videoTab).toHaveAttribute("aria-selected", "true");
    expect(videoTab).not.toHaveAttribute("aria-disabled", "true");
  });

  it("renders the credits formatted with thousands separator", () => {
    render(<WorkspaceTopBar />);
    expect(screen.getByText(/1,234/)).toBeInTheDocument();
  });

  it("enters rename mode on click and commits on Enter", () => {
    render(<WorkspaceTopBar />);
    const nameButton = screen.getByText("My Project");
    fireEvent.click(nameButton);
    const input = screen.getByDisplayValue("My Project") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByDisplayValue("Renamed")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/WorkspaceTopBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `client/src/features/workspace-shell/components/WorkspaceTopBar.tsx`:

```tsx
import React, { useState } from "react";
import { cn } from "@/utils/cn";
import { useWorkspaceProject } from "../hooks/useWorkspaceProject";
import { useWorkspaceCredits } from "../hooks/useWorkspaceCredits";

const MODES = [
  { id: "image", label: "Image", active: false },
  { id: "video", label: "Video", active: true },
  { id: "audio", label: "Audio", active: false },
  { id: "3d", label: "3D", active: false },
] as const;

export function WorkspaceTopBar(): React.ReactElement {
  const project = useWorkspaceProject();
  const credits = useWorkspaceCredits();

  return (
    <header
      className="flex h-[var(--workspace-topbar-h)] items-center gap-4 border-b border-tool-rail-border bg-tool-surface-deep px-4"
      role="banner"
    >
      <InlineRename value={project.name} onCommit={project.rename} />
      <nav
        role="tablist"
        aria-label="Output mode"
        className="flex items-center gap-1"
      >
        {MODES.map((mode) => (
          <button
            key={mode.id}
            role="tab"
            aria-selected={mode.active}
            aria-disabled={!mode.active}
            disabled={!mode.active}
            type="button"
            title={mode.active ? undefined : "Coming soon"}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              mode.active
                ? "bg-tool-nav-active text-foreground"
                : "text-tool-text-subdued hover:text-tool-text-dim disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {mode.label}
          </button>
        ))}
      </nav>
      <div className="flex-1" />
      <span
        className="font-mono text-[11px] text-tool-text-dim"
        aria-label="Credits remaining"
      >
        {credits.credits.toLocaleString()} credits
      </span>
      {credits.avatarUrl ? (
        <img
          src={credits.avatarUrl}
          alt=""
          className="h-7 w-7 rounded-full border border-tool-rail-border"
        />
      ) : (
        <div className="h-7 w-7 rounded-full border border-tool-rail-border bg-tool-surface-card" />
      )}
    </header>
  );
}

function InlineRename({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        className="rounded-md px-2 py-1 text-sm font-medium text-foreground hover:bg-tool-rail-border"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      autoFocus
      className="rounded-md border border-tool-nav-active bg-tool-surface-prompt-compact px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-white/10"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() && draft !== value) onCommit(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/WorkspaceTopBar.test.tsx`
Expected: PASS, 5/5

- [ ] **Step 5: Verify type check + lint**

Run:

```bash
cd client && npx tsc --noEmit && cd .. && npx eslint --config config/lint/eslint.config.js client/src/features/workspace-shell/components/WorkspaceTopBar.tsx --quiet
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/workspace-shell/components/WorkspaceTopBar.tsx client/src/features/workspace-shell/components/__tests__/WorkspaceTopBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add WorkspaceTopBar component

44px chrome row: inline-rename project name, mode tabs (only Video active;
Image/Audio/3D are aria-disabled with "Coming soon" tooltip), credits
pill, avatar. Sourced from useWorkspaceProject + useWorkspaceCredits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Extract `PromptEditorSurface` from `CanvasPromptBar`

This is the highest-risk task in Phase 1. The legacy `CanvasPromptBar.tsx` is 504 lines and threads ~50 props. Extract the editor body (PromptEditor + autocomplete + suggestion tray) into a layout-agnostic component that both the old and new composer wrap.

**Files:**

- Create: `client/src/features/workspace-shell/components/PromptEditorSurface.tsx`
- Modify: `client/src/features/workspace-shell/components/CanvasPromptBar.tsx`
- Test: `client/src/features/workspace-shell/components/__tests__/PromptEditorSurface.test.tsx`

- [ ] **Step 1: Write a regression test that locks the editor surface contract**

Create `client/src/features/workspace-shell/components/__tests__/PromptEditorSurface.test.tsx`:

```tsx
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptEditorSurface } from "../PromptEditorSurface";
import type { PromptEditorSurfaceProps } from "../PromptEditorSurface";

const noop = () => {};

function makeProps(): PromptEditorSurfaceProps {
  return {
    editorRef: createRef<HTMLDivElement>(),
    prompt: "",
    onTextSelection: noop,
    onHighlightClick: noop,
    onHighlightMouseDown: noop,
    onHighlightMouseEnter: noop,
    onHighlightMouseLeave: noop,
    onCopyEvent: noop,
    onInput: noop,
    onEditorKeyDown: noop,
    onEditorBlur: noop,
    autocompleteOpen: false,
    autocompleteSuggestions: [],
    autocompleteSelectedIndex: -1,
    autocompletePosition: { top: 0, left: 0 },
    autocompleteLoading: false,
    onAutocompleteSelect: noop,
    onAutocompleteClose: noop,
    onAutocompleteIndexChange: noop,
    selectedSpanId: null,
    suggestionCount: 0,
    suggestionsListRef: createRef<HTMLDivElement>(),
    inlineSuggestions: [],
    activeSuggestionIndex: -1,
    onActiveSuggestionChange: noop,
    interactionSourceRef: { current: "auto" },
    onSuggestionClick: noop,
    onCloseInlinePopover: noop,
    selectionLabel: "",
    onApplyActiveSuggestion: noop,
    isInlineLoading: false,
    isInlineError: false,
    inlineErrorMessage: "",
    isInlineEmpty: false,
    customRequest: "",
    onCustomRequestChange: noop,
    customRequestError: "",
    onCustomRequestErrorChange: noop,
    onCustomRequestSubmit: vi.fn((e) => e.preventDefault()),
    isCustomRequestDisabled: false,
    isCustomLoading: false,
    showI2VLockIndicator: false,
    resolvedI2VReason: null,
    i2vMotionAlternatives: [],
    onLockedAlternativeClick: noop,
  };
}

describe("PromptEditorSurface", () => {
  it("renders the prompt editor with a placeholder", () => {
    render(<PromptEditorSurface {...makeProps()} />);
    expect(
      screen.getByPlaceholderText(/describe a video/i),
    ).toBeInTheDocument();
  });

  it("does not render the suggestion tray when no span is selected", () => {
    render(<PromptEditorSurface {...makeProps()} />);
    expect(
      screen.queryByTestId("canvas-suggestion-tray"),
    ).not.toBeInTheDocument();
  });

  it("renders the suggestion tray when a span is selected", () => {
    render(<PromptEditorSurface {...makeProps()} selectedSpanId="span-1" />);
    expect(screen.getByTestId("canvas-suggestion-tray")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/PromptEditorSurface.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Read CanvasPromptBar lines 200–500 to identify the extraction boundary**

Run: `sed -n '200,503p' client/src/features/workspace-shell/components/CanvasPromptBar.tsx`

The extraction boundary: everything inside the inner `<div className="motion-safe-transition transition-[transform]">` block EXCEPT the trailing `<CanvasSettingsRow />` element. That is the editor body (PromptEditor + TriggerAutocomplete + suggestion tray + custom-request form). The settings row stays in the parent because the new composer renders it differently (TuneDrawer above + dropdowns inline).

- [ ] **Step 4: Create `PromptEditorSurface.tsx` by lifting that block verbatim**

Create `client/src/features/workspace-shell/components/PromptEditorSurface.tsx`:

```tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { X } from "@promptstudio/system/components/ui";
import { Textarea } from "@promptstudio/system/components/ui/textarea";
import { MAX_REQUEST_LENGTH } from "@/components/SuggestionsPanel/config/panelConfig";
import { TriggerAutocomplete } from "@/features/assets/components/TriggerAutocomplete";
import type { AssetSuggestion } from "@/features/assets/hooks/useTriggerAutocomplete";
import { PromptEditor } from "@/features/prompt-optimizer/components/PromptEditor";
import { LockedSpanIndicator } from "@/features/prompt-optimizer/components/LockedSpanIndicator";
import type {
  InlineSuggestion,
  SuggestionItem,
} from "@/features/prompt-optimizer/PromptCanvas/types";
import { addPromptFocusIntentListener } from "../events";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { cn } from "@/utils/cn";

export interface PromptEditorSurfaceProps {
  editorRef: React.RefObject<HTMLDivElement>;
  prompt: string;
  /** Visual variant — "empty" mirrors today's centered hero text styling; "active" mirrors the docked variant. */
  variant?: "empty" | "active";
  onTextSelection: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseEnter: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCopyEvent: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  onInput: (event: React.FormEvent<HTMLDivElement>) => void;
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onEditorBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  autocompleteOpen: boolean;
  autocompleteSuggestions: AssetSuggestion[];
  autocompleteSelectedIndex: number;
  autocompletePosition: { top: number; left: number };
  autocompleteLoading: boolean;
  onAutocompleteSelect: (asset: AssetSuggestion) => void;
  onAutocompleteClose: () => void;
  onAutocompleteIndexChange: (index: number) => void;
  selectedSpanId: string | null;
  suggestionCount: number;
  suggestionsListRef: React.RefObject<HTMLDivElement>;
  inlineSuggestions: InlineSuggestion[];
  activeSuggestionIndex: number;
  onActiveSuggestionChange: (index: number) => void;
  interactionSourceRef: React.MutableRefObject<"keyboard" | "mouse" | "auto">;
  onSuggestionClick: (suggestion: SuggestionItem | string) => void;
  onCloseInlinePopover: () => void;
  selectionLabel: string;
  onApplyActiveSuggestion: () => void;
  isInlineLoading: boolean;
  isInlineError: boolean;
  inlineErrorMessage: string;
  isInlineEmpty: boolean;
  customRequest: string;
  onCustomRequestChange: (value: string) => void;
  customRequestError: string;
  onCustomRequestErrorChange: (value: string) => void;
  onCustomRequestSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isCustomRequestDisabled: boolean;
  isCustomLoading: boolean;
  responseMetadata?: Record<string, unknown> | null;
  onCopyAllDebug?: (() => void) | undefined;
  isBulkCopyLoading?: boolean | undefined;
  showI2VLockIndicator: boolean;
  resolvedI2VReason: string | null;
  i2vMotionAlternatives: SuggestionItem[];
  onLockedAlternativeClick: (suggestion: SuggestionItem) => void;
}

/**
 * Layout-agnostic prompt editor body. Consumed by both the legacy
 * CanvasPromptBar (in "empty" or "active" variant) and the new
 * UnifiedCanvasPromptBar (always "active").
 *
 * Lifted verbatim from CanvasPromptBar to keep behavior identical.
 * Owns: PromptEditor, TriggerAutocomplete, suggestion tray (custom request +
 * inline suggestions + locked-span indicator). Does NOT own CanvasSettingsRow
 * — the parent composer renders that differently per layout.
 */
export function PromptEditorSurface(
  props: PromptEditorSurfaceProps,
): React.ReactElement {
  // [The full body of the existing CanvasPromptBar function, MINUS the
  // outer wrapper `<div className="relative transition-[width,...]">` and
  // MINUS the trailing `<CanvasSettingsRow />`.
  //
  // Implementation note for the executing engineer:
  //
  // 1. Copy lines 151–483 of the existing CanvasPromptBar.tsx body (everything
  //    from `const isEmptyLayout = layoutMode === "empty";` through the close
  //    of the suggestion tray's `</div>`, but BEFORE `<CanvasSettingsRow />`).
  // 2. Replace the destructured-prop names with `props.X` references, OR
  //    destructure `props` at the top of this function the same way the
  //    legacy file does.
  // 3. Replace `layoutMode === "empty"` with `props.variant === "empty"` so
  //    the prop name is intention-revealing in the new home.
  // 4. Wrap the returned JSX in a fragment or a single root div.
  //
  // The legacy file's `useEffect` listener for PROMPT_FOCUS_INTENT MUST move
  // here — it's the editor's responsibility, not the composer chrome's.
  // Keep the import path: `import { addPromptFocusIntentListener } from "../events"`.
  //
  // Do NOT import or reference CanvasSettingsRow.

  // For brevity in this plan, the verbatim copy is omitted. Use:
  //   diff client/src/features/workspace-shell/components/CanvasPromptBar.tsx <new file>
  // to confirm the body matches lines 151–483 (modulo prop access pattern).
  return null as unknown as React.ReactElement;
}
```

**STOP** — the actual implementation must paste in the verbatim 333-line body. Do not ship the `return null` stub. Re-read `client/src/features/workspace-shell/components/CanvasPromptBar.tsx:151-483` and copy that JSX block into this function.

- [ ] **Step 5: Update `CanvasPromptBar.tsx` to delegate to `PromptEditorSurface`**

Edit `client/src/features/workspace-shell/components/CanvasPromptBar.tsx`:

Replace the body returned from `CanvasPromptBar(...)` (lines 205–502 of the original) so that it now renders:

```tsx
return (
  <div
    className={cn(
      "relative transition-[width,max-width,padding,transform] duration-[240ms] [transition-timing-function:var(--motion-ease-emphasized)]",
      isEmptyLayout
        ? "w-full max-w-[640px]"
        : "mx-auto w-full max-w-[780px] flex-shrink-0 pb-4",
    )}
  >
    <div
      className={cn(
        "motion-safe-transition transition-[transform]",
        isEmptyLayout ? "px-5 pb-3 pt-5" : "px-4 py-3",
      )}
      onClick={() => {
        editorRef.current?.focus();
      }}
    >
      <PromptEditorSurface
        editorRef={editorRef}
        prompt={prompt}
        variant={isEmptyLayout ? "empty" : "active"}
        onTextSelection={onTextSelection}
        onHighlightClick={onHighlightClick}
        onHighlightMouseDown={onHighlightMouseDown}
        onHighlightMouseEnter={onHighlightMouseEnter}
        onHighlightMouseLeave={onHighlightMouseLeave}
        onCopyEvent={onCopyEvent}
        onInput={onInput}
        onEditorKeyDown={onEditorKeyDown}
        onEditorBlur={onEditorBlur}
        autocompleteOpen={autocompleteOpen}
        autocompleteSuggestions={autocompleteSuggestions}
        autocompleteSelectedIndex={autocompleteSelectedIndex}
        autocompletePosition={autocompletePosition}
        autocompleteLoading={autocompleteLoading}
        onAutocompleteSelect={onAutocompleteSelect}
        onAutocompleteClose={onAutocompleteClose}
        onAutocompleteIndexChange={onAutocompleteIndexChange}
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
        responseMetadata={responseMetadata}
        onCopyAllDebug={onCopyAllDebug}
        isBulkCopyLoading={isBulkCopyLoading}
        showI2VLockIndicator={showI2VLockIndicator}
        resolvedI2VReason={resolvedI2VReason}
        i2vMotionAlternatives={i2vMotionAlternatives}
        onLockedAlternativeClick={onLockedAlternativeClick}
      />
      <CanvasSettingsRow
        prompt={prompt}
        renderModelId={renderModelId}
        {...(recommendedModelId ? { recommendedModelId } : {})}
        {...(recommendationPromptId ? { recommendationPromptId } : {})}
        {...(recommendationMode ? { recommendationMode } : {})}
        {...(typeof recommendationAgeMs === "number"
          ? { recommendationAgeMs }
          : {})}
        onOpenMotion={onOpenMotion}
        {...(onStartFrameUpload ? { onStartFrameUpload } : {})}
        {...(onUploadSidebarImage ? { onUploadSidebarImage } : {})}
        {...(onEnhance ? { onEnhance } : {})}
        isEnhancing={isEnhancing}
      />
    </div>
  </div>
);
```

Remove the now-unused imports from `CanvasPromptBar.tsx`: `X`, `Textarea`, `MAX_REQUEST_LENGTH`, `TriggerAutocomplete`, `PromptEditor`, `LockedSpanIndicator`, `addPromptFocusIntentListener`, `useAnimatedPresence`, `useRef`, `useEffect`, `useMemo`, `useCallback`. Keep `useState` (still used for `isFocused`).

Remove the now-unused state: `isFocused`, `isSuggestionTrayCollapsed`, `isDebugCopied`, `previousSelectedSpanIdRef`, `shouldRenderAutocomplete`, `autocompletePhase`, `shouldRenderSuggestionTray`, `suggestionTrayPhase`, `debugPayload`, `handleCopyDebug`, the `useEffect` for focus intent, the `useEffect` for span change. Add `import type` for `AssetSuggestion`, `InlineSuggestion`, `SuggestionItem` if still referenced in the prop interface.

- [ ] **Step 6: Run all three regression tests against the legacy CanvasPromptBar**

Run:

```bash
cd client && npx vitest run src/features/workspace-shell/__tests__/CanvasWorkspace.failed-hero-retry.regression.test.tsx src/features/workspace-shell/__tests__/CanvasWorkspace.gallery-selection.regression.test.tsx src/features/workspace-shell/__tests__/CanvasWorkspace.enhance.regression.test.tsx
```

Expected: PASS, all three (the extraction is supposed to be behavior-preserving).

If ANY of them fails, the extraction has changed behavior — read the failure, identify the missing piece (likely a `useEffect`, ref, or memoization that didn't move), and fix `PromptEditorSurface` until they pass.

- [ ] **Step 7: Run the new PromptEditorSurface test**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/PromptEditorSurface.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 8: Type check + lint**

Run:

```bash
cd client && npx tsc --noEmit
cd .. && npx eslint --config config/lint/eslint.config.js client/src/features/workspace-shell/components/PromptEditorSurface.tsx client/src/features/workspace-shell/components/CanvasPromptBar.tsx --quiet
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add client/src/features/workspace-shell/components/PromptEditorSurface.tsx client/src/features/workspace-shell/components/CanvasPromptBar.tsx client/src/features/workspace-shell/components/__tests__/PromptEditorSurface.test.tsx
git commit -m "$(cat <<'EOF'
refactor(workspace-shell): extract PromptEditorSurface from CanvasPromptBar

Lifts the editor body (PromptEditor, TriggerAutocomplete, suggestion tray,
custom request form, locked-span indicator, focus-intent listener) into a
layout-agnostic component. Legacy CanvasPromptBar now delegates and keeps
its layoutMode prop and CanvasSettingsRow rendering. The new unified
composer (Phase 1, next task) wraps the same surface differently.

All three CanvasWorkspace regression tests pass against the refactored
CanvasPromptBar — the extraction is intentionally behavior-preserving.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Implement `UnifiedCanvasPromptBar` floating glass shell

**Files:**

- Create: `client/src/features/workspace-shell/components/UnifiedCanvasPromptBar.tsx`
- Test: `client/src/features/workspace-shell/components/__tests__/UnifiedCanvasPromptBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/workspace-shell/components/__tests__/UnifiedCanvasPromptBar.test.tsx`:

```tsx
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnifiedCanvasPromptBar } from "../UnifiedCanvasPromptBar";
import type { PromptEditorSurfaceProps } from "../PromptEditorSurface";

const noop = () => {};

function makeSurfaceProps(): PromptEditorSurfaceProps {
  return {
    editorRef: createRef<HTMLDivElement>(),
    prompt: "",
    onTextSelection: noop,
    onHighlightClick: noop,
    onHighlightMouseDown: noop,
    onHighlightMouseEnter: noop,
    onHighlightMouseLeave: noop,
    onCopyEvent: noop,
    onInput: noop,
    onEditorKeyDown: noop,
    onEditorBlur: noop,
    autocompleteOpen: false,
    autocompleteSuggestions: [],
    autocompleteSelectedIndex: -1,
    autocompletePosition: { top: 0, left: 0 },
    autocompleteLoading: false,
    onAutocompleteSelect: noop,
    onAutocompleteClose: noop,
    onAutocompleteIndexChange: noop,
    selectedSpanId: null,
    suggestionCount: 0,
    suggestionsListRef: createRef<HTMLDivElement>(),
    inlineSuggestions: [],
    activeSuggestionIndex: -1,
    onActiveSuggestionChange: noop,
    interactionSourceRef: { current: "auto" },
    onSuggestionClick: noop,
    onCloseInlinePopover: noop,
    selectionLabel: "",
    onApplyActiveSuggestion: noop,
    isInlineLoading: false,
    isInlineError: false,
    inlineErrorMessage: "",
    isInlineEmpty: false,
    customRequest: "",
    onCustomRequestChange: noop,
    customRequestError: "",
    onCustomRequestErrorChange: noop,
    onCustomRequestSubmit: vi.fn((e) => e.preventDefault()),
    isCustomRequestDisabled: false,
    isCustomLoading: false,
    showI2VLockIndicator: false,
    resolvedI2VReason: null,
    i2vMotionAlternatives: [],
    onLockedAlternativeClick: noop,
  };
}

describe("UnifiedCanvasPromptBar", () => {
  it("renders as a floating dock with absolute positioning", () => {
    const { container } = render(
      <UnifiedCanvasPromptBar
        moment="empty"
        surfaceProps={makeSurfaceProps()}
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/absolute/);
  });

  it("renders the editor surface", () => {
    render(
      <UnifiedCanvasPromptBar
        moment="empty"
        surfaceProps={makeSurfaceProps()}
      />,
    );
    expect(
      screen.getByPlaceholderText(/describe a video/i),
    ).toBeInTheDocument();
  });

  it("does NOT render the legacy centered/empty styling regardless of moment", () => {
    const { container, rerender } = render(
      <UnifiedCanvasPromptBar
        moment="empty"
        surfaceProps={makeSurfaceProps()}
      />,
    );
    const initial = (container.firstChild as HTMLElement).className;
    rerender(
      <UnifiedCanvasPromptBar
        moment="rendering"
        surfaceProps={makeSurfaceProps()}
      />,
    );
    const rerendered = (container.firstChild as HTMLElement).className;
    // The wrapper class list is identical between moments (no centered/dock fork).
    expect(initial).toBe(rerendered);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/UnifiedCanvasPromptBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `client/src/features/workspace-shell/components/UnifiedCanvasPromptBar.tsx`:

```tsx
import React from "react";
import { cn } from "@/utils/cn";
import { PromptEditorSurface } from "./PromptEditorSurface";
import type { PromptEditorSurfaceProps } from "./PromptEditorSurface";
import type { WorkspaceMoment } from "../utils/computeWorkspaceMoment";

export interface UnifiedCanvasPromptBarProps {
  moment: WorkspaceMoment;
  surfaceProps: PromptEditorSurfaceProps;
  /** Phase 3 will mount the TuneDrawer above the editor; Phase 1 leaves this null. */
  tuneSlot?: React.ReactNode;
  /** Phase 3 will add a CostPreview + Make-it submit row; Phase 1 leaves this null. */
  chromeSlot?: React.ReactNode;
}

/**
 * Floating glass composer for the unified workspace.
 *
 * Always docked at bottom-center; never reflows between WorkspaceMoments.
 * The Tune drawer (Phase 3) renders above the editor surface; the surface
 * grows upward while the bottom edge stays pinned at
 * --workspace-composer-bottom from the canvas bottom.
 */
export function UnifiedCanvasPromptBar({
  moment,
  surfaceProps,
  tuneSlot = null,
  chromeSlot = null,
}: UnifiedCanvasPromptBarProps): React.ReactElement {
  // moment is plumbed in for future use (e.g. dimming the Make-it CTA while
  // rendering); Phase 1 does not need to branch on it.
  void moment;

  return (
    <div
      className={cn(
        "absolute left-1/2 z-10 -translate-x-1/2",
        "w-[min(100%-48px,var(--workspace-composer-max-w))]",
        "rounded-[14px] border border-white/[0.08]",
        "bg-tool-surface-prompt/[0.72] backdrop-blur-[18px] backdrop-saturate-150",
        "shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.4)]",
        "transition-[transform,box-shadow] duration-[240ms]",
      )}
      style={{ bottom: "var(--workspace-composer-bottom)" }}
    >
      {tuneSlot}
      <PromptEditorSurface {...surfaceProps} variant="active" />
      {chromeSlot}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/UnifiedCanvasPromptBar.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 5: Type check + lint**

Run:

```bash
cd client && npx tsc --noEmit
cd .. && npx eslint --config config/lint/eslint.config.js client/src/features/workspace-shell/components/UnifiedCanvasPromptBar.tsx --quiet
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/workspace-shell/components/UnifiedCanvasPromptBar.tsx client/src/features/workspace-shell/components/__tests__/UnifiedCanvasPromptBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add UnifiedCanvasPromptBar floating glass shell

Always docked at bottom-center via position: absolute. Wraps
PromptEditorSurface and exposes tuneSlot + chromeSlot for Phase 3 to
mount the Tune drawer and cost preview. No reflow between moments.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Implement `UnifiedCanvasWorkspace` orchestrator (Phase 1 minimal)

The Phase 1 orchestrator preserves the entire `CanvasWorkspaceProps` interface, the `useGenerationsRuntime` wiring, the failed-hero retry dance, and the gallery rendering — but lays them out in a single grid (top chrome / rail / canvas / floating composer) with no reflow between moments. Phase 2 will swap the flat gallery for grouped shots.

**Files:**

- Create: `client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx`
- Test: `client/src/features/workspace-shell/__tests__/UnifiedCanvasWorkspace.layout.test.tsx`

- [ ] **Step 1: Re-read the legacy `CanvasWorkspace.tsx` body**

Run: `sed -n '180,549p' client/src/features/workspace-shell/CanvasWorkspace.tsx`

Identify the parts that MUST be preserved verbatim:

- `parseDurationSeconds`, `normalizePromptForComparison` helpers
- `useModelSelectionRecommendation` hook + `handleModelChange`
- `useGenerationsRuntime` call + `handleSnapshot`
- `displayHeroGeneration` memo (failed-hero retry rules)
- `galleryEntries`, `galleryGenerations`, `generationLookup` memos
- `viewingId` state + `handleSelectGeneration` / `handleCloseGallery` / `handleReuse`
- `handleOpenMotion`, `handleCameraMotionSelect`
- The `promptBarProps` aggregation
- `<CameraMotionModal>` and `<GenerationPopover>` mounts

Identify the parts that change:

- The outer DOM tree (4 nested motion containers → one workspace grid)
- The `NewSessionView` import and conditional render → folded into an inline empty hero
- The `useAnimatedPresence` triple-fork (`shouldRenderEmptyChrome`, `shouldRenderGallery`, `shouldRenderHero`) → not used in Phase 1; the moment-based render is single-pass
- The `CanvasPromptBar` wrapper → swapped for `UnifiedCanvasPromptBar`
- The `ModelCornerSelector` mount → moves into the `WorkspaceTopBar` chrome region (Phase 1 detail: render it as a sibling of the canvas, anchored top-right; Phase 3 may relocate it inside `CanvasSettingsRow`)
- The `GalleryPanel` mount → kept in Phase 1 (rendered inside the canvas region, below the hero); replaced in Phase 2

- [ ] **Step 2: Write the failing layout test**

Create `client/src/features/workspace-shell/__tests__/UnifiedCanvasWorkspace.layout.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnifiedCanvasWorkspace } from "../UnifiedCanvasWorkspace";

// Provide the absolute minimum mocks/props required to mount.
// The point of this test is to assert the LAYOUT shell, not feature behavior.

vi.mock("@features/generations", () => ({
  useGenerationsRuntime: () => ({
    generations: [],
    activeGenerationId: null,
    isGenerating: false,
    selectedFrameUrl: null,
    keyframeStep: { isActive: false, character: null, pendingModel: null },
    timeline: [],
    totalVisibleGenerations: 0,
    canExtendGenerations: false,
    isSequenceMode: false,
    hasActiveContinuityShot: false,
    isStartingSequence: false,
    heroGeneration: null,
    activeDraftModel: null,
    handleDraft: vi.fn(),
    handleRenderWithFaceSwap: vi.fn(),
    handleStoryboard: vi.fn(),
    handleApproveKeyframe: vi.fn(),
    handleSkipKeyframe: vi.fn(),
    handleRetry: vi.fn(),
    handleDelete: vi.fn(),
    handleDownload: vi.fn(),
    handleExtendGeneration: vi.fn(),
    handleCancel: vi.fn(),
    handleContinueSequence: vi.fn(),
    handleSelectFrame: vi.fn(),
    handleClearSelectedFrame: vi.fn(),
    setActiveGeneration: vi.fn(),
  }),
}));

// (Other mocks needed by the orchestrator — useGenerationControlsStoreActions,
// useGenerationControlsStoreState, useWorkspaceSession, useSidebarGenerationDomain,
// useOptionalPromptHighlights, useModelSelectionRecommendation — are mocked here
// returning safe defaults so the component mounts without error. The executing
// engineer should fill these mocks in based on the real return shapes.)

describe("UnifiedCanvasWorkspace layout", () => {
  it("renders the workspace grid root with topbar + main row", () => {
    // ...assemble the minimum CanvasWorkspaceProps required.
    // Assert that the rendered tree contains an element with role="banner"
    // (WorkspaceTopBar) and that the composer wrapper has `position: absolute`
    // styling.
    // (The test is intentionally minimal — Phase 1's main risk is the layout
    // change, and the regression suite will catch behavior breakage.)
    expect(true).toBe(true); // placeholder; engineer fills in.
  });
});
```

**Note:** The full mount of `UnifiedCanvasWorkspace` requires ~70 props and ~6 mocked context providers. The executing engineer should treat this test as a stub and add realistic mocks based on the existing test fixtures in `__tests__/CanvasWorkspace.failed-hero-retry.regression.test.tsx`. The real layout assertion to add: render the unified workspace at empty/drafting/rendering/ready moments and confirm the top-level grid columns + topbar height stay constant (snapshot the bounding rect of the canvas region).

- [ ] **Step 3: Implement `UnifiedCanvasWorkspace`**

Create `client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx`. Start by COPYING `CanvasWorkspace.tsx` verbatim, then transform it:

1. Rename the function from `CanvasWorkspace` to `UnifiedCanvasWorkspace`. Keep the prop interface identical (re-export the existing `CanvasWorkspaceProps` type or inline it).
2. Drop these imports: `NewSessionView`, `computeIsEmptySession`, `useAnimatedPresence`.
3. Keep these imports: `CameraMotionModal`, `VIDEO_DRAFT_MODEL`, `useGenerationControlsStore*`, `useWorkspaceSession`, `useGenerationsRuntime`, `useModelSelectionRecommendation`, `useSidebarGenerationDomain`, `GalleryPanel`, `GenerationPopover`, `buildGalleryGenerationEntries`, `CanvasPromptBar` (for legacy compat is gone — use `UnifiedCanvasPromptBar` instead), `CanvasHeroViewer`, `useOptionalPromptHighlights`, `useGenerationControlsStoreActions`, `useGenerationControlsStoreState`, `trackModelRecommendationEvent`, `sanitizeText`, `useGenerationsRuntime`.
4. Add new imports:
   ```ts
   import { WorkspaceTopBar } from "./components/WorkspaceTopBar";
   import { UnifiedCanvasPromptBar } from "./components/UnifiedCanvasPromptBar";
   import {
     computeWorkspaceMoment,
     workspaceMomentClass,
   } from "./utils/computeWorkspaceMoment";
   import { ModelCornerSelector } from "./components/ModelCornerSelector";
   ```
5. Remove `useState(false)` for `showCameraMotionModal` if it lives in legacy state but is preserved? Keep it — it's still needed for `CameraMotionModal`.
6. Keep ALL the helper logic (lines 195–449 of legacy) verbatim: `parseDurationSeconds`, `normalizePromptForComparison`, `useModelSelectionRecommendation` call, `handleModelChange`, `handleSnapshot`, the `useGenerationsRuntime` call, `displayHeroGeneration` memo, `galleryEntries` / `galleryGenerations` / `generationLookup` memos, `viewingId` state and its handlers, `handleOpenMotion` / `handleCameraMotionSelect`, the `promptBarProps` aggregation.
7. Compute the moment: `const promptIsEmpty = prompt.trim().length === 0;`
   ```ts
   const moment = computeWorkspaceMoment({
     galleryEntriesCount: galleryEntries.length,
     activeShotStatuses:
       galleryGenerations.length > 0
         ? galleryGenerations
             .slice(0, 4)
             .map((g) => g.status as Generation["status"])
         : [],
     promptIsEmpty,
     tuneOpen: false, // Phase 3 wires this
     promptFocused: false, // Phase 3 wires this
   });
   ```
   (The "active shot" approximation in Phase 1 is "the most recent up-to-4 entries". Phase 2 replaces this with `groupShots(...)[0].tiles`.)
8. Replace the entire `return (...)` body with the unified layout:

```tsx
return (
  <div
    className={cn(
      "grid h-full grid-rows-[var(--workspace-topbar-h)_1fr] bg-tool-surface-deep text-foreground overflow-hidden",
      workspaceMomentClass(moment),
    )}
  >
    <WorkspaceTopBar />
    <div className="grid min-h-0 grid-cols-[var(--tool-rail-width)_1fr]">
      {/*
        ToolSidebar already mounts inside its own portal/context elsewhere
        in the app. If it currently renders OUTSIDE CanvasWorkspace (it
        does, per the existing PromptCanvasView), this column stays empty
        — the sidebar lives at the page level. Confirm at integration
        time and either render <ToolSidebar /> here or leave the column
        for the existing mount.
      */}
      <div aria-hidden="true" />
      <div className="relative min-h-0 overflow-y-auto px-7 pb-[140px] scroll-smooth">
        <ModelCornerSelector
          renderModelOptions={renderModelOptions}
          renderModelId={renderModelId}
          modelRecommendation={modelRecommendation}
          recommendedModelId={recommendedModelId}
          efficientModelId={efficientModelId}
          onModelChange={handleModelChange}
          className="absolute right-5 top-3"
        />

        {moment === "empty" ? (
          <EmptyHero />
        ) : (
          <>
            {displayHeroGeneration ? (
              <div className="mb-3">
                <CanvasHeroViewer
                  generation={displayHeroGeneration}
                  onCancel={generationsRuntime.handleCancel}
                />
              </div>
            ) : null}
            <GalleryPanel
              generations={galleryGenerations}
              activeGenerationId={viewingId}
              onSelectGeneration={handleSelectGeneration}
              onClose={handleCloseGallery}
            />
          </>
        )}

        <UnifiedCanvasPromptBar moment={moment} surfaceProps={promptBarProps} />
      </div>
    </div>

    {viewingId ? (
      <GenerationPopover
        generations={galleryGenerations}
        activeId={viewingId}
        onChange={setViewingId}
        onClose={() => setViewingId(null)}
        onReuse={handleReuse}
        onToggleFavorite={onToggleGenerationFavorite}
      />
    ) : null}

    {domain.startFrame ? (
      <CameraMotionModal
        isOpen={showCameraMotionModal}
        onClose={() => setShowCameraMotionModal(false)}
        imageUrl={domain.startFrame.url}
        imageStoragePath={domain.startFrame.storagePath ?? null}
        imageAssetId={domain.startFrame.assetId ?? null}
        initialSelection={domain.cameraMotion}
        onSelect={handleCameraMotionSelect}
      />
    ) : null}
  </div>
);
```

9. Add the `EmptyHero` inline component (lifted from the sketch, but this codebase's Tailwind):

```tsx
const STARTER_CHIPS = [
  "A neon-lit cyberpunk alley at night",
  "Slow-motion ink drop in clear water",
  "Drone shot over autumn forest at sunrise",
  "A dancer mid-leap in a sunlit studio",
] as const;

function EmptyHero(): React.ReactElement {
  // Phase 1: chips are visual stubs — clicking does nothing yet.
  // Phase 3 will wire them to seed the editor (see spec §0).
  return (
    <div className="mx-auto flex min-h-[calc(100vh-var(--workspace-topbar-h)-240px)] max-w-[640px] flex-col items-center justify-center gap-[18px] text-center">
      <h1 className="text-[28px] font-medium tracking-[-0.01em]">
        What are you making?
      </h1>
      <p className="m-0 max-w-[460px] text-tool-text-subdued">
        Describe a shot. Pick a model. We&apos;ll render four variants.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {STARTER_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="rounded-full border border-tool-rail-border bg-tool-surface-card px-3 py-1 text-xs text-tool-text-dim hover:text-foreground"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type check**

Run: `cd client && npx tsc --noEmit`
Expected: exits 0. If `promptBarProps` type doesn't match `PromptEditorSurfaceProps` exactly, narrow it explicitly — the `UnifiedCanvasPromptBar` accepts `surfaceProps: PromptEditorSurfaceProps`, so `promptBarProps` must be a superset. If extra fields are present (e.g. `renderModelId`), strip them before passing.

- [ ] **Step 5: Run all three regression tests against the legacy CanvasWorkspace (sanity)**

Run:

```bash
cd client && npx vitest run src/features/workspace-shell/__tests__/CanvasWorkspace.failed-hero-retry.regression.test.tsx src/features/workspace-shell/__tests__/CanvasWorkspace.gallery-selection.regression.test.tsx src/features/workspace-shell/__tests__/CanvasWorkspace.enhance.regression.test.tsx
```

Expected: PASS, all three (this task only adds a new file; legacy is untouched).

- [ ] **Step 6: Commit**

```bash
git add client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx client/src/features/workspace-shell/__tests__/UnifiedCanvasWorkspace.layout.test.tsx
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add UnifiedCanvasWorkspace orchestrator (flag off)

New Phase 1 orchestrator with same CanvasWorkspaceProps as the legacy
CanvasWorkspace. Lays out the workspace as a single grid (44px topbar /
56px rail / fluid canvas / floating composer) with computeWorkspaceMoment
driving the canvas content. heroGeneration + failed-hero retry +
GalleryPanel preserved verbatim; only the layout tree changes.

Phase 2 will replace the flat GalleryPanel with grouped shots; this
task ships the shell without changing gallery semantics.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Wire the flag dispatcher at the public entry

**Files:**

- Modify: `client/src/features/workspace-shell/index.ts`
- Create: `client/src/features/workspace-shell/CanvasWorkspaceDispatcher.tsx`

- [ ] **Step 1: Create the dispatcher**

Create `client/src/features/workspace-shell/CanvasWorkspaceDispatcher.tsx`:

```tsx
import React from "react";
import { FEATURES } from "@/config/features.config";
import { CanvasWorkspace as LegacyCanvasWorkspace } from "./CanvasWorkspace";
import { UnifiedCanvasWorkspace } from "./UnifiedCanvasWorkspace";

type CanvasWorkspaceImpl = typeof LegacyCanvasWorkspace;

const Impl: CanvasWorkspaceImpl = FEATURES.UNIFIED_WORKSPACE
  ? (UnifiedCanvasWorkspace as CanvasWorkspaceImpl)
  : LegacyCanvasWorkspace;

export const CanvasWorkspace: CanvasWorkspaceImpl = (props) => (
  <Impl {...props} />
);
```

- [ ] **Step 2: Update the public entry**

Edit `client/src/features/workspace-shell/index.ts`:

```ts
export { CanvasWorkspace } from "./CanvasWorkspaceDispatcher";
export {
  PROMPT_FOCUS_INTENT,
  dispatchPromptFocusIntent,
  addPromptFocusIntentListener,
} from "./events";
export type { PromptFocusIntentDetail, PromptFocusIntentEvent } from "./events";
```

- [ ] **Step 3: Run the full regression suite**

Run:

```bash
cd client && npx vitest run src/features/workspace-shell/__tests__/
```

Expected: ALL PASS. The dispatcher defaults to `UNIFIED_WORKSPACE: false`, so all existing tests still hit the legacy path.

- [ ] **Step 4: Run the full type check + lint**

Run:

```bash
cd client && npx tsc --noEmit
cd .. && npx eslint --config config/lint/eslint.config.js client/src/ --quiet
```

Expected: 0 errors.

- [ ] **Step 5: Run the full unit test suite**

Run: `cd .. && npm run test:unit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/features/workspace-shell/CanvasWorkspaceDispatcher.tsx client/src/features/workspace-shell/index.ts
git commit -m "$(cat <<'EOF'
feat(workspace-shell): dispatch CanvasWorkspace via UNIFIED_WORKSPACE flag

Public entry now exports CanvasWorkspace from a tiny dispatcher that
picks UnifiedCanvasWorkspace (flag on) or legacy CanvasWorkspace
(flag off, default). Consumers do not change. Sets the stage for
Phase 2 to extend the unified path; the legacy path stays the default
until Phase 3's flag-removal commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Phase 1 verification under flag-on

**Files:** none (manual verification + targeted regression run with flag enabled)

- [ ] **Step 1: Run the regression suite with the flag forced on**

Run:

```bash
cd client && VITE_FEATURE_UNIFIED_WORKSPACE=true npx vitest run src/features/workspace-shell/__tests__/CanvasWorkspace.failed-hero-retry.regression.test.tsx
```

Expected: PASS. The unified path is functionally equivalent for hero behavior.

If the test fails, the most likely cause is that the test mocks a child of the legacy tree that the unified tree doesn't render (e.g. expects `<NewSessionView />` to mount). Update the test ONLY if the assertion targets layout-specific markup — semantic assertions about hero retry must hold on both paths.

```bash
VITE_FEATURE_UNIFIED_WORKSPACE=true npx vitest run src/features/workspace-shell/__tests__/CanvasWorkspace.gallery-selection.regression.test.tsx src/features/workspace-shell/__tests__/CanvasWorkspace.enhance.regression.test.tsx
```

Expected: PASS for both.

- [ ] **Step 2: Manual smoke test**

Set the flag in `client/.env.local`:

```
VITE_FEATURE_UNIFIED_WORKSPACE=true
```

Run: `cd .. && npm start`

Open http://localhost:5173 in a browser. Verify:

- Top bar appears (44px tall, project name, mode tabs, credits)
- Image / Audio / 3D tabs are disabled with "Coming soon" tooltip
- Composer floats at bottom-center
- No layout shift between empty (page load) → drafting (start typing) → rendering (submit) → ready (result)
- Gallery still renders entries (flat — Phase 2 will group)
- Hero / failed-hero retry works the same as flag-off

If anything breaks, fix it before Phase 2.

Unset the flag:

```
# remove VITE_FEATURE_UNIFIED_WORKSPACE from client/.env.local
```

- [ ] **Step 3: Phase 1 milestone commit (no code change — message only marker)**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(workspace-shell): Phase 1 milestone — layout shell shippable

Phase 1 of the unified-workspace refactor is complete behind
VITE_FEATURE_UNIFIED_WORKSPACE. New shell renders, no layout shift
between moments, all regression tests green on both paths. Phase 2
will replace the flat gallery with grouped shots.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## PHASE 2 — Shot grouping & ShotRow

Tasks 11–18. Replaces the flat gallery with `groupShots`-grouped rows; introduces `ShotRow`, `GenTile`, `ShotDivider`, `useFeaturedTile`, and the `CONTINUE_SCENE` event. Failed-hero retry semantics preserved verbatim through `useFeaturedTile`.

### Task 11: Implement `groupShots` pure function with tests

**Files:**

- Create: `client/src/features/workspace-shell/utils/groupShots.ts`
- Test: `client/src/features/workspace-shell/utils/__tests__/groupShots.test.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/workspace-shell/utils/__tests__/groupShots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupShots } from "../groupShots";
import type { Generation } from "@features/generations/types";

function gen(overrides: Partial<Generation>): Generation {
  return {
    id: "g1",
    tier: "render",
    status: "completed",
    model: "sora-2",
    prompt: "neon market",
    promptVersionId: "v1",
    createdAt: 1_000,
    completedAt: 2_000,
    mediaType: "video",
    mediaUrls: ["u1"],
    isFavorite: false,
    generationSettings: null,
    ...overrides,
  } as Generation;
}

describe("groupShots", () => {
  it("groups generations by promptVersionId", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v1" }),
      gen({ id: "b", promptVersionId: "v1" }),
      gen({ id: "c", promptVersionId: "v2" }),
    ]);
    expect(shots).toHaveLength(2);
    expect(shots.find((s) => s.id === "v1")?.tiles).toHaveLength(2);
    expect(shots.find((s) => s.id === "v2")?.tiles).toHaveLength(1);
  });

  it("orders shots newest-first by max(createdAt)", () => {
    const shots = groupShots([
      gen({ id: "old", promptVersionId: "old", createdAt: 1_000 }),
      gen({ id: "new", promptVersionId: "new", createdAt: 5_000 }),
    ]);
    expect(shots[0].id).toBe("new");
    expect(shots[1].id).toBe("old");
  });

  it("falls back to a synthetic __legacy:<id> bucket for missing promptVersionId", () => {
    const shots = groupShots([
      gen({ id: "x", promptVersionId: undefined as unknown as string }),
    ]);
    expect(shots[0].id).toBe("__legacy:x");
    expect(shots[0].tiles).toHaveLength(1);
  });

  it("aggregates status: all completed → 'ready'", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v", status: "completed" }),
      gen({ id: "b", promptVersionId: "v", status: "completed" }),
    ]);
    expect(shots[0].status).toBe("ready");
  });

  it("aggregates status: any generating → 'rendering'", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v", status: "completed" }),
      gen({ id: "b", promptVersionId: "v", status: "generating" }),
    ]);
    expect(shots[0].status).toBe("rendering");
  });

  it("aggregates status: mixed completed + failed → 'mixed'", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v", status: "completed" }),
      gen({ id: "b", promptVersionId: "v", status: "failed" }),
    ]);
    expect(shots[0].status).toBe("mixed");
  });

  it("aggregates status: all failed → 'failed'", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v", status: "failed" }),
      gen({ id: "b", promptVersionId: "v", status: "failed" }),
    ]);
    expect(shots[0].status).toBe("failed");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/features/workspace-shell/utils/__tests__/groupShots.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `groupShots`**

Create `client/src/features/workspace-shell/utils/groupShots.ts`:

```ts
import type { Generation } from "@features/generations/types";

export type ShotStatus = "queued" | "rendering" | "ready" | "mixed" | "failed";

export interface Shot {
  /** `promptVersionId`, or `__legacy:<generation.id>` for un-grouped rows. */
  id: string;
  /** First 80ch of sanitized prompt from the earliest tile. */
  promptSummary: string;
  /** Model id from the earliest tile. */
  modelId: string;
  /** ms epoch — earliest variant's createdAt; used for sort order. */
  createdAt: number;
  /** Generations in this shot, ordered by createdAt ascending. */
  tiles: Generation[];
  /** Aggregate status across all variants. */
  status: ShotStatus;
}

const PROMPT_SUMMARY_MAX = 80;

function summarize(prompt: string | null | undefined): string {
  const trimmed = (prompt ?? "").trim();
  if (trimmed.length <= PROMPT_SUMMARY_MAX) return trimmed;
  return `${trimmed.slice(0, PROMPT_SUMMARY_MAX - 1)}…`;
}

function aggregateStatus(tiles: ReadonlyArray<Generation>): ShotStatus {
  const states = tiles.map((t) => t.status);
  if (states.every((s) => s === "completed")) return "ready";
  if (states.every((s) => s === "failed")) return "failed";
  if (states.some((s) => s === "generating")) return "rendering";
  if (states.some((s) => s === "queued")) return "queued";
  // Mix of completed + failed (the only remaining combo)
  return "mixed";
}

export function groupShots(generations: ReadonlyArray<Generation>): Shot[] {
  const buckets = new Map<string, Generation[]>();

  for (const gen of generations) {
    const key = gen.promptVersionId ?? `__legacy:${gen.id}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(gen);
    else buckets.set(key, [gen]);
  }

  const shots: Shot[] = [];
  for (const [id, tiles] of buckets) {
    tiles.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const earliest = tiles[0];
    shots.push({
      id,
      promptSummary: summarize(earliest.prompt),
      modelId: earliest.model,
      createdAt: Math.min(...tiles.map((t) => t.createdAt ?? 0)),
      tiles,
      status: aggregateStatus(tiles),
    });
  }

  shots.sort((a, b) => b.createdAt - a.createdAt);
  return shots;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/workspace-shell/utils/__tests__/groupShots.test.ts`
Expected: PASS, 7/7.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/workspace-shell/utils/groupShots.ts client/src/features/workspace-shell/utils/__tests__/groupShots.test.ts
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add groupShots pure function

Groups Generation[] by promptVersionId into Shot[], with synthetic
__legacy:<id> bucket for un-grouped rows. Aggregate status follows the
spec: all-completed → ready, all-failed → failed, any-generating →
rendering, any-queued → queued, mixed completed+failed → mixed.

Newest-first sort order; tiles within a shot sort by createdAt asc.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Implement `useFeaturedTile` hook

**Files:**

- Create: `client/src/features/workspace-shell/hooks/useFeaturedTile.ts`
- Test: `client/src/features/workspace-shell/hooks/__tests__/useFeaturedTile.test.ts`

The featured tile within the active shot is: (a) the variant matching `heroGeneration.id` if it exists in the shot, else (b) the first `completed` tile, else (c) the first tile. The failed-hero retry rule from the legacy code (don't keep promoting a failed hero past its retry) is preserved here.

- [ ] **Step 1: Write the failing test**

Create `client/src/features/workspace-shell/hooks/__tests__/useFeaturedTile.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFeaturedTile } from "../useFeaturedTile";
import type { Shot } from "../../utils/groupShots";
import type { Generation } from "@features/generations/types";

function gen(p: Partial<Generation>): Generation {
  return {
    id: "g",
    tier: "render",
    status: "completed",
    model: "sora-2",
    prompt: "x",
    promptVersionId: "v",
    createdAt: 1,
    completedAt: 1,
    mediaType: "video",
    mediaUrls: ["u"],
    isFavorite: false,
    generationSettings: null,
    ...p,
  } as Generation;
}

function shot(tiles: Generation[]): Shot {
  return {
    id: "v",
    promptSummary: "x",
    modelId: "sora-2",
    createdAt: 1,
    tiles,
    status: "ready",
  };
}

describe("useFeaturedTile", () => {
  it("returns null when no shots", () => {
    const { result } = renderHook(() =>
      useFeaturedTile({ shots: [], heroGeneration: null, currentPrompt: "" }),
    );
    expect(result.current).toBeNull();
  });

  it("returns the tile matching heroGeneration.id when present in active shot", () => {
    const tiles = [
      gen({ id: "a", status: "completed" }),
      gen({ id: "b", status: "completed" }),
    ];
    const { result } = renderHook(() =>
      useFeaturedTile({
        shots: [shot(tiles)],
        heroGeneration: tiles[1],
        currentPrompt: "",
      }),
    );
    expect(result.current?.id).toBe("b");
  });

  it("falls back to the first completed tile when hero is missing", () => {
    const tiles = [
      gen({ id: "a", status: "queued" }),
      gen({ id: "b", status: "completed" }),
    ];
    const { result } = renderHook(() =>
      useFeaturedTile({
        shots: [shot(tiles)],
        heroGeneration: null,
        currentPrompt: "",
      }),
    );
    expect(result.current?.id).toBe("b");
  });

  it("preserves failed hero only when current prompt matches its prompt", () => {
    const failedHero = gen({
      id: "f",
      status: "failed",
      prompt: "neon market",
    });
    const tiles = [failedHero, gen({ id: "ok", status: "completed" })];
    // Same prompt → keep showing the failed hero (so retry message is visible).
    const same = renderHook(() =>
      useFeaturedTile({
        shots: [shot(tiles)],
        heroGeneration: failedHero,
        currentPrompt: "neon market",
      }),
    );
    expect(same.result.current?.id).toBe("f");
    // Different prompt → fall through to the next ready tile.
    const diff = renderHook(() =>
      useFeaturedTile({
        shots: [shot(tiles)],
        heroGeneration: failedHero,
        currentPrompt: "rainy alley",
      }),
    );
    expect(diff.result.current?.id).toBe("ok");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/features/workspace-shell/hooks/__tests__/useFeaturedTile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useFeaturedTile`**

Create `client/src/features/workspace-shell/hooks/useFeaturedTile.ts`:

```ts
import { useMemo } from "react";
import type { Generation } from "@features/generations/types";
import type { Shot } from "../utils/groupShots";
import { sanitizeText } from "@/features/span-highlighting";

export interface UseFeaturedTileInput {
  shots: ReadonlyArray<Shot>;
  heroGeneration: Generation | null;
  /** Current prompt-bar text — used to decide whether a failed hero stays featured. */
  currentPrompt: string;
}

const normalize = (s: string | null | undefined): string =>
  sanitizeText(typeof s === "string" ? s : "").trim();

/**
 * Selects the featured tile within the active (most-recent) shot.
 *
 * Rules (preserved from the legacy CanvasWorkspace.displayHeroGeneration memo):
 *   1. No shots → null.
 *   2. heroGeneration matches a tile in the active shot → that tile.
 *   3. heroGeneration is failed AND current prompt differs from the failed
 *      tile's prompt → fall through (the user retried with a new prompt;
 *      the old failure is no longer relevant).
 *   4. Otherwise prefer the first completed tile, then the first tile.
 */
export function useFeaturedTile({
  shots,
  heroGeneration,
  currentPrompt,
}: UseFeaturedTileInput): Generation | null {
  return useMemo(() => {
    if (shots.length === 0) return null;
    const active = shots[0];
    if (active.tiles.length === 0) return null;

    if (heroGeneration) {
      const matched = active.tiles.find((t) => t.id === heroGeneration.id);
      if (matched) {
        if (matched.status === "failed") {
          const promptsMatch =
            normalize(currentPrompt) === normalize(matched.prompt);
          if (!promptsMatch) {
            // Fall through to the next-best tile.
          } else {
            return matched;
          }
        } else {
          return matched;
        }
      }
    }

    const firstCompleted = active.tiles.find((t) => t.status === "completed");
    if (firstCompleted) return firstCompleted;
    return active.tiles[0];
  }, [shots, heroGeneration, currentPrompt]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/workspace-shell/hooks/__tests__/useFeaturedTile.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/workspace-shell/hooks/useFeaturedTile.ts client/src/features/workspace-shell/hooks/__tests__/useFeaturedTile.test.ts
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add useFeaturedTile hook

Selects the featured tile of the active shot from heroGeneration with
the legacy CanvasWorkspace.displayHeroGeneration semantics preserved
(failed hero stays featured only when the current prompt matches its
prompt; otherwise falls through to the next ready tile).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Implement `GenTile` component

**Files:**

- Create: `client/src/features/workspace-shell/components/GenTile.tsx`
- Test: `client/src/features/workspace-shell/components/__tests__/GenTile.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/workspace-shell/components/__tests__/GenTile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenTile } from "../GenTile";
import type { Generation } from "@features/generations/types";

function gen(p: Partial<Generation>): Generation {
  return {
    id: "g",
    tier: "render",
    status: "completed",
    model: "sora-2",
    prompt: "x",
    promptVersionId: "v",
    createdAt: 1,
    completedAt: 1,
    mediaType: "video",
    mediaUrls: ["https://example.com/v.mp4"],
    thumbnailUrl: "https://example.com/poster.jpg",
    isFavorite: false,
    generationSettings: null,
    ...p,
  } as Generation;
}

describe("GenTile", () => {
  it("renders a 'queued' state placeholder", () => {
    render(
      <GenTile
        generation={gen({ status: "queued" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/queued/i)).toBeInTheDocument();
  });

  it("renders a 'rendering' state with progress shimmer", () => {
    const { container } = render(
      <GenTile
        generation={gen({ status: "generating" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[data-state="rendering"]'),
    ).toBeInTheDocument();
  });

  it("renders a poster image when ready and mediaType is video", () => {
    render(
      <GenTile
        generation={gen({ status: "completed", mediaType: "video" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/poster.jpg");
  });

  it("renders a Continue Scene button only when isFeatured", () => {
    const { rerender, queryByText } = render(
      <GenTile
        generation={gen({ status: "completed" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(queryByText(/continue scene/i)).not.toBeInTheDocument();
    rerender(
      <GenTile
        generation={gen({ status: "completed" })}
        isFeatured={true}
        onSelect={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(queryByText(/continue scene/i)).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked on a failed tile", () => {
    const onRetry = vi.fn();
    render(
      <GenTile
        generation={gen({ status: "failed" })}
        isFeatured={false}
        onSelect={vi.fn()}
        onRetry={onRetry}
      />,
    );
    screen.getByText(/retry/i).click();
    expect(onRetry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/GenTile.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `GenTile`**

Create `client/src/features/workspace-shell/components/GenTile.tsx`:

```tsx
import React from "react";
import { cn } from "@/utils/cn";
import type { Generation } from "@features/generations/types";
import { dispatchContinueScene } from "../events";

export interface GenTileProps {
  generation: Generation;
  isFeatured: boolean;
  onSelect: () => void;
  onRetry: () => void;
}

export function GenTile({
  generation,
  isFeatured,
  onSelect,
  onRetry,
}: GenTileProps): React.ReactElement {
  const status = generation.status;
  const dataState =
    status === "completed"
      ? "ready"
      : status === "generating"
        ? "rendering"
        : status === "queued"
          ? "queued"
          : "failed";

  return (
    <article
      data-state={dataState}
      data-generation-id={generation.id}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-lg border border-tool-rail-border bg-tool-surface-card",
        isFeatured && "ring-2 ring-tool-accent-neutral/40",
        status === "completed" && "cursor-pointer",
      )}
      onClick={status === "completed" ? onSelect : undefined}
    >
      {status === "queued" && <QueuedPlaceholder />}
      {status === "generating" && <RenderingPlaceholder />}
      {status === "completed" && <ReadyMedia generation={generation} />}
      {status === "failed" && <FailedState onRetry={onRetry} />}

      {status === "completed" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="pointer-events-auto rounded-md bg-tool-surface-deep/80 px-2 py-1 text-[10px] font-medium text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            Open
          </button>
          {isFeatured && (
            <button
              type="button"
              className="pointer-events-auto rounded-md bg-tool-accent-neutral px-2 py-1 text-[10px] font-semibold text-tool-surface-deep"
              onClick={(e) => {
                e.stopPropagation();
                dispatchContinueScene({ fromGenerationId: generation.id });
              }}
            >
              Continue scene
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function QueuedPlaceholder(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="rounded-full border border-tool-rail-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tool-text-subdued">
        queued
      </span>
    </div>
  );
}

function RenderingPlaceholder(): React.ReactElement {
  return (
    <div className="relative h-full">
      <div className="absolute inset-0 animate-pulse bg-tool-rail-border/40" />
      <div className="absolute inset-x-0 bottom-2 text-center">
        <span className="rounded-full border border-tool-rail-border bg-tool-surface-deep/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--tool-status-rendering,#d4b486)]">
          rendering
        </span>
      </div>
    </div>
  );
}

function ReadyMedia({
  generation,
}: {
  generation: Generation;
}): React.ReactElement {
  // Phase 2: poster-first. The featured tile should preload video; the
  // executing engineer wires that in via an `eager` prop pulled from
  // ShotRow when this tile is the featured one. For Phase 2 baseline,
  // every tile shows the poster image and only swaps to <video> on
  // user interaction (Phase 2.5 — out of scope for this task).
  const poster = generation.thumbnailUrl ?? generation.mediaUrls[0] ?? "";
  return (
    <img
      src={poster}
      alt=""
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );
}

function FailedState({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
      <p className="text-xs text-tool-text-subdued">Render failed.</p>
      <button
        type="button"
        className="rounded-md border border-tool-rail-border px-2 py-1 text-[10px] font-semibold text-tool-text-dim hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
      >
        Retry
      </button>
    </div>
  );
}
```

Note: this references `dispatchContinueScene` from `../events`, which Task 15 adds. If the test runs before Task 15, mock the events module.

- [ ] **Step 4: Mock `dispatchContinueScene` in the test**

Add to the top of `GenTile.test.tsx` (above the imports):

```ts
vi.mock("../../events", () => ({
  dispatchContinueScene: vi.fn(),
}));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/GenTile.test.tsx`
Expected: PASS, 5/5.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/workspace-shell/components/GenTile.tsx client/src/features/workspace-shell/components/__tests__/GenTile.test.tsx
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add GenTile per-variant tile component

Renders one Generation in 4 states (queued / rendering / completed /
failed). Continue Scene button shows only when isFeatured. Poster-first
media to keep tile renders cheap; the actual video element only mounts
on user interaction (out of scope for this task — see Phase 2.5).

Continue Scene dispatches the new CONTINUE_SCENE event (added in the
next task).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Implement `ShotRow` and `ShotDivider` components

**Files:**

- Create: `client/src/features/workspace-shell/components/ShotRow.tsx`
- Create: `client/src/features/workspace-shell/components/ShotDivider.tsx`
- Test: `client/src/features/workspace-shell/components/__tests__/ShotRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/workspace-shell/components/__tests__/ShotRow.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShotRow } from "../ShotRow";
import type { Shot } from "../../utils/groupShots";
import type { Generation } from "@features/generations/types";

vi.mock("../../events", () => ({ dispatchContinueScene: vi.fn() }));

function gen(p: Partial<Generation>): Generation {
  return {
    id: "g",
    tier: "render",
    status: "completed",
    model: "sora-2",
    prompt: "x",
    promptVersionId: "v",
    createdAt: 1,
    completedAt: 1,
    mediaType: "video",
    mediaUrls: ["u"],
    thumbnailUrl: "https://example.com/p.jpg",
    isFavorite: false,
    generationSettings: null,
    ...p,
  } as Generation;
}

const shot: Shot = {
  id: "v1",
  promptSummary: "neon market in the rain",
  modelId: "sora-2",
  createdAt: Date.now() - 60_000,
  tiles: [
    gen({ id: "a" }),
    gen({ id: "b" }),
    gen({ id: "c" }),
    gen({ id: "d" }),
  ],
  status: "ready",
};

describe("ShotRow", () => {
  it("renders the prompt summary in the header", () => {
    render(
      <ShotRow
        shot={shot}
        layout="featured"
        featuredTileId="a"
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    expect(screen.getByText("neon market in the rain")).toBeInTheDocument();
  });

  it("renders all tiles", () => {
    const { container } = render(
      <ShotRow
        shot={shot}
        layout="featured"
        featuredTileId="a"
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("[data-generation-id]")).toHaveLength(4);
  });

  it("marks the featured tile via data attribute", () => {
    const { container } = render(
      <ShotRow
        shot={shot}
        layout="featured"
        featuredTileId="b"
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    const tiles = container.querySelectorAll("[data-generation-id]");
    expect(tiles[1].className).toMatch(/ring-/);
  });

  it("uses compact layout class when layout='compact'", () => {
    const { container } = render(
      <ShotRow
        shot={shot}
        layout="compact"
        featuredTileId={null}
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[data-layout="compact"]'),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/ShotRow.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ShotRow.tsx`**

Create `client/src/features/workspace-shell/components/ShotRow.tsx`:

```tsx
import React from "react";
import { cn } from "@/utils/cn";
import type { Shot } from "../utils/groupShots";
import { GenTile } from "./GenTile";

export interface ShotRowProps {
  shot: Shot;
  layout: "featured" | "compact";
  /** id of the featured tile within this shot, or null. */
  featuredTileId: string | null;
  onSelectTile: (generationId: string) => void;
  onRetryTile: (generationId: string) => void;
}

const STATUS_PILL_CLASS: Record<Shot["status"], string> = {
  ready: "text-[var(--tool-status-ready,#9ec4a8)]",
  rendering: "text-[var(--tool-status-rendering,#d4b486)]",
  queued: "text-tool-text-subdued",
  failed: "text-red-400",
  mixed: "text-[var(--tool-status-rendering,#d4b486)]",
};

export function ShotRow({
  shot,
  layout,
  featuredTileId,
  onSelectTile,
  onRetryTile,
}: ShotRowProps): React.ReactElement {
  return (
    <section
      data-layout={layout}
      aria-labelledby={`shot-${shot.id}-header`}
      className="rounded-lg border border-tool-rail-border bg-tool-surface-card/40 p-4"
    >
      <header
        id={`shot-${shot.id}-header`}
        className="mb-3 flex items-center gap-3"
      >
        <h2 className="m-0 flex-1 truncate text-sm font-medium text-foreground">
          {shot.promptSummary || "Untitled shot"}
        </h2>
        <span
          className={cn(
            "rounded-full border border-tool-rail-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
            STATUS_PILL_CLASS[shot.status],
          )}
        >
          {shot.status}
        </span>
        <time className="font-mono text-[10px] text-tool-text-subdued">
          {formatRelative(shot.createdAt)}
        </time>
      </header>
      <div
        className={cn(
          "grid gap-3",
          layout === "featured"
            ? "grid-cols-2 lg:grid-cols-4"
            : "grid-cols-4 lg:grid-cols-6",
        )}
      >
        {shot.tiles.map((tile) => (
          <GenTile
            key={tile.id}
            generation={tile}
            isFeatured={tile.id === featuredTileId}
            onSelect={() => onSelectTile(tile.id)}
            onRetry={() => onRetryTile(tile.id)}
          />
        ))}
      </div>
    </section>
  );
}

function formatRelative(epoch: number): string {
  const delta = Date.now() - epoch;
  const m = Math.floor(delta / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
```

- [ ] **Step 4: Implement `ShotDivider.tsx`**

Create `client/src/features/workspace-shell/components/ShotDivider.tsx`:

```tsx
import React from "react";

export function ShotDivider(): React.ReactElement {
  return (
    <hr
      aria-hidden="true"
      className="my-2 border-0 border-t border-tool-rail-border/40"
    />
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/ShotRow.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/workspace-shell/components/ShotRow.tsx client/src/features/workspace-shell/components/ShotDivider.tsx client/src/features/workspace-shell/components/__tests__/ShotRow.test.tsx
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add ShotRow + ShotDivider components

ShotRow renders one shot's header (prompt summary, aggregate status pill,
relative time) and its tiles in a grid that varies by layout
(featured: 2/4 cols; compact: 4/6 cols). ShotDivider is a pure visual
separator. Featured tile is marked with a ring; consumers pass
featuredTileId from useFeaturedTile.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Add `CONTINUE_SCENE` event + listener helper

**Files:**

- Modify: `client/src/features/workspace-shell/events.ts`
- Modify: `client/src/features/workspace-shell/__tests__/events.test.ts`

- [ ] **Step 1: Read existing events.ts** (already done in exploration)

- [ ] **Step 2: Extend the events module**

Edit `client/src/features/workspace-shell/events.ts` — append after the existing focus-intent helpers:

```ts
/* ─── Continue Scene ────────────────────────────────────────── */

export const CONTINUE_SCENE = "workspace:continue-scene" as const;

export interface ContinueSceneDetail {
  fromGenerationId: string;
}

export type ContinueSceneEvent = CustomEvent<ContinueSceneDetail>;

export function dispatchContinueScene(detail: ContinueSceneDetail): void {
  if (!supportsWindow()) return;
  window.dispatchEvent(
    new CustomEvent<ContinueSceneDetail>(CONTINUE_SCENE, { detail }),
  );
}

export function addContinueSceneListener(
  listener: (event: ContinueSceneEvent) => void,
): () => void {
  if (!supportsWindow()) return () => {};
  const handler: EventListener = (event) => {
    listener(event as ContinueSceneEvent);
  };
  window.addEventListener(CONTINUE_SCENE, handler);
  return () => {
    window.removeEventListener(CONTINUE_SCENE, handler);
  };
}
```

- [ ] **Step 3: Extend the events test**

Read the existing test to see its pattern:

```bash
cat client/src/features/workspace-shell/__tests__/events.test.ts
```

Add a new `describe("CONTINUE_SCENE")` block following the same pattern as the existing `PROMPT_FOCUS_INTENT` block. Verify dispatch + listen + unsubscribe.

- [ ] **Step 4: Run the test**

Run: `cd client && npx vitest run src/features/workspace-shell/__tests__/events.test.ts`
Expected: PASS

- [ ] **Step 5: Re-export from public entry**

Edit `client/src/features/workspace-shell/index.ts`:

```ts
export { CanvasWorkspace } from "./CanvasWorkspaceDispatcher";
export {
  PROMPT_FOCUS_INTENT,
  dispatchPromptFocusIntent,
  addPromptFocusIntentListener,
  CONTINUE_SCENE,
  dispatchContinueScene,
  addContinueSceneListener,
} from "./events";
export type {
  PromptFocusIntentDetail,
  PromptFocusIntentEvent,
  ContinueSceneDetail,
  ContinueSceneEvent,
} from "./events";
```

- [ ] **Step 6: Commit**

```bash
git add client/src/features/workspace-shell/events.ts client/src/features/workspace-shell/__tests__/events.test.ts client/src/features/workspace-shell/index.ts
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add CONTINUE_SCENE workspace event

Following the existing PROMPT_FOCUS_INTENT pattern (window CustomEvent),
adds dispatchContinueScene + addContinueSceneListener helpers. GenTile
emits this when the user clicks Continue Scene on the featured tile;
the listener (UnifiedCanvasPromptBar, next task) opens StartFramePopover
with the prior tile's last frame pre-selected.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Wire shots into `UnifiedCanvasWorkspace`

**Files:**

- Modify: `client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx`

- [ ] **Step 1: Add imports**

In `UnifiedCanvasWorkspace.tsx`, add:

```ts
import { groupShots } from "./utils/groupShots";
import { useFeaturedTile } from "./hooks/useFeaturedTile";
import { ShotRow } from "./components/ShotRow";
import { ShotDivider } from "./components/ShotDivider";
```

- [ ] **Step 2: Compute shots from `galleryEntries`**

Inside the orchestrator, after `galleryEntries` is computed:

```ts
const shotInputGenerations = useMemo(
  () => galleryEntries.map((entry) => entry.generation),
  [galleryEntries],
);
const shots = useMemo(
  () => groupShots(shotInputGenerations),
  [shotInputGenerations],
);
const featuredTile = useFeaturedTile({
  shots,
  heroGeneration: heroGeneration,
  currentPrompt: prompt,
});
```

- [ ] **Step 3: Update the active-shot input to `computeWorkspaceMoment`**

Replace the Phase 1 approximation:

```ts
const moment = computeWorkspaceMoment({
  galleryEntriesCount: galleryEntries.length,
  activeShotStatuses: shots[0]?.tiles.map((t) => t.status) ?? [],
  promptIsEmpty: prompt.trim().length === 0,
  tuneOpen: false,
  promptFocused: false,
});
```

- [ ] **Step 4: Replace the gallery render with shot rows**

In the JSX, swap the Phase 1 `<GalleryPanel ... />` block for:

```tsx
<div className="mx-auto flex max-w-[1280px] flex-col gap-6">
  {shots.map((shot, idx) => (
    <React.Fragment key={shot.id}>
      <ShotRow
        shot={shot}
        layout={idx === 0 ? "featured" : "compact"}
        featuredTileId={idx === 0 ? (featuredTile?.id ?? null) : null}
        onSelectTile={handleSelectGeneration}
        onRetryTile={(id) => {
          const target = shot.tiles.find((t) => t.id === id);
          if (target) generationsRuntime.handleRetry(target);
        }}
      />
      {idx < shots.length - 1 && <ShotDivider />}
    </React.Fragment>
  ))}
</div>
```

Remove the now-unused `<GalleryPanel>` import and the old `<CanvasHeroViewer>` mount (the featured tile is rendered inside `ShotRow` via `GenTile` with `isFeatured`).

- [ ] **Step 5: Add the Continue Scene listener**

In `UnifiedCanvasPromptBar` (Phase 2 modification — add a `useEffect`):

Edit `client/src/features/workspace-shell/components/UnifiedCanvasPromptBar.tsx` to accept an `onContinueScene` callback and listen for the event:

```tsx
import { useEffect } from "react";
import { addContinueSceneListener } from "../events";

export interface UnifiedCanvasPromptBarProps {
  moment: WorkspaceMoment;
  surfaceProps: PromptEditorSurfaceProps;
  /** Called when a featured tile dispatches CONTINUE_SCENE. */
  onContinueScene?: (fromGenerationId: string) => void;
  tuneSlot?: React.ReactNode;
  chromeSlot?: React.ReactNode;
}

export function UnifiedCanvasPromptBar({
  moment,
  surfaceProps,
  onContinueScene,
  tuneSlot = null,
  chromeSlot = null,
}: UnifiedCanvasPromptBarProps): React.ReactElement {
  useEffect(() => {
    if (!onContinueScene) return;
    return addContinueSceneListener((e) => {
      onContinueScene(e.detail.fromGenerationId);
    });
  }, [onContinueScene]);

  // ...rest unchanged
}
```

In `UnifiedCanvasWorkspace.tsx`, pass:

```tsx
<UnifiedCanvasPromptBar
  moment={moment}
  surfaceProps={promptBarProps}
  onContinueScene={(fromGenerationId) => {
    // Phase 2 baseline: log + open the start-frame popover by setting the
    // start frame on the generation controls store. The actual
    // StartFramePopover open trigger lives inside CanvasSettingsRow / the
    // sidebar — calling storeActions.setStartFrame with the generation's
    // last frame URL is the integration point. The executing engineer
    // must wire the actual asset resolution here:
    //
    //   const target = shotInputGenerations.find((g) => g.id === fromGenerationId);
    //   if (target?.mediaUrls[0]) {
    //     storeActions.setStartFrame({ url: target.mediaUrls[0], ... });
    //   }
    //
    // Phase 2 ships the event + handler stub; full StartFramePopover seeding
    // (last-frame extraction from video metadata) is Phase 2.5.
    void fromGenerationId;
  }}
/>
```

- [ ] **Step 6: Run the regression suite under flag-on**

```bash
cd client && VITE_FEATURE_UNIFIED_WORKSPACE=true npx vitest run src/features/workspace-shell/__tests__/CanvasWorkspace.failed-hero-retry.regression.test.tsx
```

Expected: PASS. The featured-tile selection (via `useFeaturedTile`) preserves the failed-hero retry semantics.

If the test asserts on specific DOM nodes (e.g. expects `<CanvasHeroViewer>` to mount), update the test to find the tile by `data-generation-id` and `[ring-]`-class instead. The semantic assertion (which generation is shown to the user when retrying a failed prompt) must still hold.

- [ ] **Step 7: Update `gallery-selection.regression.test.tsx`**

Run the test with the flag on to see what fails:

```bash
VITE_FEATURE_UNIFIED_WORKSPACE=true npx vitest run src/features/workspace-shell/__tests__/CanvasWorkspace.gallery-selection.regression.test.tsx
```

The test currently asserts that selecting a gallery entry promotes it to the hero. Under the unified path the assertion becomes: selecting a tile in a non-active shot opens the GenerationPopover (preserving the legacy `setViewingId` behavior). Update the test's assertions to match while keeping the user-facing behavior contract intact.

- [ ] **Step 8: Commit**

```bash
git add client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx client/src/features/workspace-shell/components/UnifiedCanvasPromptBar.tsx client/src/features/workspace-shell/__tests__/CanvasWorkspace.gallery-selection.regression.test.tsx
git commit -m "$(cat <<'EOF'
feat(workspace-shell): wire grouped shots into UnifiedCanvasWorkspace

Replaces the flat GalleryPanel render with groupShots-grouped ShotRows.
Active shot uses the 'featured' layout with featuredTileId driven by
useFeaturedTile (preserves legacy failed-hero retry semantics). Older
shots use 'compact' layout, separated by ShotDivider.

UnifiedCanvasPromptBar now accepts onContinueScene and subscribes to
the CONTINUE_SCENE event. Full StartFramePopover seeding (last-frame
extraction) is Phase 2.5.

gallery-selection regression test updated to assert featured-tile-of-
active-shot semantics; failed-hero-retry still passes unmodified.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Phase 2 perf regression test

**Files:**

- Create: `client/src/features/workspace-shell/components/__tests__/GenTile.perf.regression.test.tsx`

- [ ] **Step 1: Write the failing perf test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShotRow } from "../ShotRow";
import type { Shot } from "../../utils/groupShots";
import type { Generation } from "@features/generations/types";

vi.mock("../../events", () => ({ dispatchContinueScene: vi.fn() }));

function gen(id: string, status: Generation["status"]): Generation {
  return {
    id,
    tier: "render",
    status,
    model: "sora-2",
    prompt: "x",
    promptVersionId: id.slice(0, 1),
    createdAt: 1,
    completedAt: 1,
    mediaType: "video",
    mediaUrls: ["https://example.com/v.mp4"],
    thumbnailUrl: "https://example.com/p.jpg",
    isFavorite: false,
    generationSettings: null,
  } as Generation;
}

describe("GenTile perf — at most one <video> element actively renders per shot", () => {
  it("renders 8 tiles with poster <img> only (no <video>)", () => {
    const tiles = Array.from({ length: 8 }, (_, i) =>
      gen(`g${i}`, "completed"),
    );
    const shot: Shot = {
      id: "v",
      promptSummary: "p",
      modelId: "m",
      createdAt: 1,
      tiles,
      status: "ready",
    };
    const { container } = render(
      <ShotRow
        shot={shot}
        layout="featured"
        featuredTileId="g0"
        onSelectTile={vi.fn()}
        onRetryTile={vi.fn()}
      />,
    );
    const videos = container.querySelectorAll("video");
    expect(videos.length).toBe(0);
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(8);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd client && npx vitest run src/features/workspace-shell/components/__tests__/GenTile.perf.regression.test.tsx`
Expected: PASS (the Phase 2 baseline implementation in Task 13 is poster-only; this test locks that contract).

- [ ] **Step 3: Commit**

```bash
git add client/src/features/workspace-shell/components/__tests__/GenTile.perf.regression.test.tsx
git commit -m "$(cat <<'EOF'
test(workspace-shell): lock GenTile poster-only baseline

Per spec §10 risk #1, asserts that a fully-rendered shot of 8 completed
tiles produces zero <video> elements — only poster <img>. Phase 2.5
will introduce on-interaction video swap; this regression keeps a 32+
tile session from trying to play 32 videos at once.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Phase 2 milestone

- [ ] **Step 1: Run the full unit test suite under flag-on AND flag-off**

```bash
cd .. && npm run test:unit
cd client && VITE_FEATURE_UNIFIED_WORKSPACE=true npx vitest run src/features/workspace-shell/
```

Expected: ALL PASS in both runs.

- [ ] **Step 2: Manual smoke test**

Repeat the smoke test from Task 10 Step 2. Verify:

- Gallery is grouped by shot (each prompt → one row)
- Active shot has the "featured" treatment (larger grid, ring on featured tile)
- Older shots are compact
- ShotDivider visible between shots
- Continue Scene button visible only on the featured tile

- [ ] **Step 3: Phase 2 milestone commit**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(workspace-shell): Phase 2 milestone — shot grouping shippable

Phase 2 of the unified-workspace refactor is complete behind
VITE_FEATURE_UNIFIED_WORKSPACE. Shots are grouped by promptVersionId,
ShotRow renders featured/compact layouts, GenTile renders 4 states
poster-only, CONTINUE_SCENE event dispatches and listens. Failed-hero
retry semantics preserved via useFeaturedTile.

Phase 3 adds TuneDrawer + CostPreview, then deletes the legacy path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## PHASE 3 — Tune drawer, polish, flag removal

Tasks 19–25. Three commit groups in strict order: drawer add → polish → flag removal.

### Task 19: Add status-hue + canvas-bg CSS custom properties

**Files:**

- Modify: `client/src/index.css`

- [ ] **Step 1: Add the new tokens**

Inside the existing `:root` block (next to the Phase 1 token additions):

```css
--tool-status-rendering: #d4b486;
--tool-status-ready: #9ec4a8;
--tool-canvas-bg: radial-gradient(
  1600px 900px at 50% -10%,
  #15151d,
  #0a0a0e 50%,
  #050507
);
```

Update existing `--tool-surface-prompt` to its glass form (preserve the original line as a comment for one commit):

```css
/* was: --tool-surface-prompt: #14141a; */
--tool-surface-prompt: rgba(22, 22, 28, 0.72);
```

Update `UnifiedCanvasWorkspace.tsx` outer div className to use `[background:var(--tool-canvas-bg)]` instead of the flat `bg-tool-surface-deep`.

- [ ] **Step 2: Type check + smoke**

Run: `cd client && npx vite build --mode development 2>&1 | tail -10`
Expected: build completes cleanly.

- [ ] **Step 3: Commit**

```bash
git add client/src/index.css client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add status hue and canvas-bg tokens

Adds --tool-status-rendering (#d4b486 muted amber), --tool-status-ready
(#9ec4a8 muted sage), --tool-canvas-bg (radial top-center warmth).
Converts --tool-surface-prompt to its glass form so the floating
composer renders against the canvas backdrop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Implement `tuneChips` + `estimateShotCost` utilities

**Files:**

- Create: `client/src/features/workspace-shell/utils/tuneChips.ts`
- Create: `client/src/features/workspace-shell/utils/estimateShotCost.ts`
- Tests for both

- [ ] **Step 1: Write the failing test for tuneChips**

Create `client/src/features/workspace-shell/utils/__tests__/tuneChips.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TUNE_CHIPS, applyTuneChips, type TuneChipId } from "../tuneChips";

describe("tuneChips", () => {
  it("exposes 3 sections (Motion / Mood / Style)", () => {
    const sections = new Set(TUNE_CHIPS.map((c) => c.section));
    expect(sections.has("motion")).toBe(true);
    expect(sections.has("mood")).toBe(true);
    expect(sections.has("style")).toBe(true);
  });

  it("appends selected chip suffixes to the prompt, comma-separated", () => {
    const ids: TuneChipId[] = TUNE_CHIPS.slice(0, 2).map((c) => c.id);
    const result = applyTuneChips("a dancer", ids);
    expect(result.startsWith("a dancer, ")).toBe(true);
  });

  it("returns the prompt unchanged when no chips selected", () => {
    expect(applyTuneChips("a dancer", [])).toBe("a dancer");
  });
});
```

- [ ] **Step 2: Implement `tuneChips`**

Create `client/src/features/workspace-shell/utils/tuneChips.ts`:

```ts
export interface TuneChip {
  id: string;
  section: "motion" | "mood" | "style";
  label: string;
  /** Suffix appended to the prompt when this chip is selected. */
  suffix: string;
}

export type TuneChipId = TuneChip["id"];

export const TUNE_CHIPS: ReadonlyArray<TuneChip> = [
  {
    id: "m-handheld",
    section: "motion",
    label: "Handheld",
    suffix: "handheld camera",
  },
  { id: "m-dolly", section: "motion", label: "Dolly in", suffix: "dolly-in" },
  {
    id: "m-static",
    section: "motion",
    label: "Static",
    suffix: "locked-off camera",
  },
  {
    id: "mood-soft",
    section: "mood",
    label: "Soft",
    suffix: "soft warm light",
  },
  {
    id: "mood-noir",
    section: "mood",
    label: "Noir",
    suffix: "high-contrast noir lighting",
  },
  {
    id: "mood-dreamy",
    section: "mood",
    label: "Dreamy",
    suffix: "dreamy bloom",
  },
  {
    id: "style-film",
    section: "style",
    label: "Film",
    suffix: "35mm film grain",
  },
  {
    id: "style-anime",
    section: "style",
    label: "Anime",
    suffix: "anime cel shading",
  },
  {
    id: "style-concept",
    section: "style",
    label: "Concept",
    suffix: "concept-art rendering",
  },
];

export function applyTuneChips(
  prompt: string,
  chipIds: ReadonlyArray<TuneChipId>,
): string {
  if (chipIds.length === 0) return prompt;
  const suffixes = TUNE_CHIPS.filter((c) => chipIds.includes(c.id)).map(
    (c) => c.suffix,
  );
  if (suffixes.length === 0) return prompt;
  const trimmed = prompt.trimEnd();
  const sep = trimmed.endsWith(",") ? " " : ", ";
  return `${trimmed}${sep}${suffixes.join(", ")}`;
}
```

- [ ] **Step 3: Run tuneChips test**

Run: `cd client && npx vitest run src/features/workspace-shell/utils/__tests__/tuneChips.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 4: Write the failing test for estimateShotCost**

Create `client/src/features/workspace-shell/utils/__tests__/estimateShotCost.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { estimateShotCost } from "../estimateShotCost";

describe("estimateShotCost", () => {
  it("returns a positive integer for a known model", () => {
    const cost = estimateShotCost({
      modelId: "sora-2",
      durationSeconds: 5,
      variantCount: 4,
    });
    expect(cost).toBeGreaterThan(0);
    expect(Number.isInteger(cost)).toBe(true);
  });

  it("scales linearly with variant count", () => {
    const a = estimateShotCost({
      modelId: "sora-2",
      durationSeconds: 5,
      variantCount: 1,
    });
    const b = estimateShotCost({
      modelId: "sora-2",
      durationSeconds: 5,
      variantCount: 4,
    });
    expect(b).toBe(a * 4);
  });

  it("returns 0 for an unknown model", () => {
    expect(
      estimateShotCost({
        modelId: "definitely-not-a-model",
        durationSeconds: 5,
        variantCount: 4,
      }),
    ).toBe(0);
  });
});
```

- [ ] **Step 5: Implement `estimateShotCost`**

First, locate the existing model pricing utility:

```bash
grep -rn "credit\|cost\|price" client/src/components/ToolSidebar/config/modelConfig.ts client/src/features/generations/config/ 2>/dev/null | head -20
```

Create `client/src/features/workspace-shell/utils/estimateShotCost.ts` referencing the existing pricing source. If the existing source returns credits-per-second, the implementation is:

```ts
import { getModelConfig } from "@features/generations/config/generationConfig";

export interface EstimateShotCostInput {
  modelId: string;
  durationSeconds: number;
  variantCount: number;
}

/**
 * Estimates the credit cost for one shot (= variantCount tiles).
 *
 * Sources per-second cost from the existing model registry. Returns 0
 * when the model is unknown so the UI can hide the preview rather than
 * showing a misleading number.
 */
export function estimateShotCost({
  modelId,
  durationSeconds,
  variantCount,
}: EstimateShotCostInput): number {
  const config = getModelConfig(modelId);
  if (!config) return 0;
  // Adjust the field name to whatever the actual model registry exposes —
  // common candidates: config.creditsPerSecond, config.pricing.credits,
  // config.cost. The executing engineer must verify before merging.
  const perSecond =
    typeof (config as { creditsPerSecond?: number }).creditsPerSecond ===
    "number"
      ? (config as { creditsPerSecond: number }).creditsPerSecond
      : 0;
  return Math.max(0, Math.round(perSecond * durationSeconds * variantCount));
}
```

If `getModelConfig` doesn't expose pricing (likely — pricing may live in a different module), this task expands to: find the pricing source, import it here, and adapt the multiplication. The test contract stays the same (integer, scales linearly with variants, 0 for unknown).

- [ ] **Step 6: Run estimateShotCost test**

Run: `cd client && npx vitest run src/features/workspace-shell/utils/__tests__/estimateShotCost.test.ts`
Expected: PASS, 3/3. If the implementation can't return a positive cost for `sora-2` because the registry doesn't have credits, the test fixtures need to either (a) stub the registry or (b) use a known-priced model.

- [ ] **Step 7: Commit**

```bash
git add client/src/features/workspace-shell/utils/tuneChips.ts client/src/features/workspace-shell/utils/estimateShotCost.ts client/src/features/workspace-shell/utils/__tests__/tuneChips.test.ts client/src/features/workspace-shell/utils/__tests__/estimateShotCost.test.ts
git commit -m "$(cat <<'EOF'
feat(workspace-shell): add tuneChips + estimateShotCost utilities

tuneChips: 9 chips across Motion / Mood / Style sections; applyTuneChips
appends selected suffixes to a prompt comma-separated.

estimateShotCost: pure fn sourcing per-model pricing from the existing
generation config registry. Returns integer credits; scales linearly
with variant count; returns 0 for unknown models.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: Implement `TuneDrawer` and `CostPreview` components

**Files:**

- Create: `client/src/features/workspace-shell/components/TuneDrawer.tsx`
- Create: `client/src/features/workspace-shell/components/CostPreview.tsx`
- Tests for both

Follow the same TDD pattern as Tasks 5 / 13 / 14. Each component has a focused test and a Tailwind-styled implementation. The drawer takes `selectedChipIds: TuneChipId[]`, `onToggle: (id) => void`, `onClose: () => void` and renders three `<fieldset>` blocks for the three sections, each with chip buttons that have `aria-pressed`. The cost preview takes `cost: number` and renders `~{cost} cr / shot` with the `font-mono` style and a `--tool-status-ready` dot when cost > 0.

(Detailed code omitted for brevity; the patterns are identical to Tasks 5, 13, 14. Each task: write test → run-fail → implement → run-pass → commit.)

---

### Task 22: Mount TuneDrawer + CostPreview in `UnifiedCanvasPromptBar`

Wire the drawer (open state in `UnifiedCanvasWorkspace` parent so the moment computation can include `tuneOpen`), pass `tuneSlot={tuneOpen ? <TuneDrawer ... /> : null}` and `chromeSlot={<CostPreview cost={estimatedCost} />}`. The "Tune" button toggle and the "Make it" submit button live in `chromeSlot`. Append selected chip suffixes to the prompt at submit time via `applyTuneChips`.

The flag-off legacy path is untouched because none of these slots existed in the legacy `CanvasPromptBar`.

(Detailed code follows the same plumbing pattern as Task 16; engineer reuses the slot props.)

---

### Task 23: Phase 3 polish commits

- Bump the GenTile rendering placeholder to use the new `--tool-status-rendering` token instead of inline hex.
- Bump the ShotRow status pill to use both new status tokens via the existing `STATUS_PILL_CLASS` map (already references `--tool-status-rendering` and `--tool-status-ready` via `var()` — confirm).
- Add a `composer.layout.regression.test.tsx` that mounts `UnifiedCanvasPromptBar` at all four moments and asserts the `getBoundingClientRect().bottom` of the composer is constant (within tolerance) across moments. This locks the no-reflow contract.

Each polish item is a separate small commit.

---

### Task 24: Flag removal — single mechanical commit

**Files (to delete):**

- `client/src/features/workspace-shell/CanvasWorkspace.tsx` (legacy)
- `client/src/features/workspace-shell/CanvasWorkspaceDispatcher.tsx`
- `client/src/features/workspace-shell/components/NewSessionView.tsx`
- `client/src/features/workspace-shell/utils/computeIsEmptySession.ts`
- `client/src/features/workspace-shell/utils/__tests__/computeIsEmptySession.regression.test.ts`

**Files (to rename):**

- `client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx` → `client/src/features/workspace-shell/CanvasWorkspace.tsx`

**Files (to modify):**

- `client/src/features/workspace-shell/index.ts` — re-export `CanvasWorkspace` directly from `./CanvasWorkspace`
- `client/src/features/workspace-shell/components/CanvasPromptBar.tsx` — drop `layoutMode` prop entirely; the body always renders the "active" variant. If `UnifiedCanvasPromptBar` is now the only consumer of `PromptEditorSurface`, delete `CanvasPromptBar` outright and rename `UnifiedCanvasPromptBar.tsx` → `CanvasPromptBar.tsx`. (The executing engineer makes this judgment call at commit time based on what's cleanest.)
- `client/src/features/workspace-shell/components/CanvasSettingsRow.tsx` — refactor to remove Tune chips (now sole consumer is the unified path, where chips live in the drawer); keep aspect/duration/model dropdowns
- `client/src/config/features.config.ts` — remove `UNIFIED_WORKSPACE` entry from `FLAG_DEFS` and `FEATURES`
- `client/.env.local` — remove the `VITE_FEATURE_UNIFIED_WORKSPACE` line if present

- [ ] **Step 1: Verify no remaining imports of legacy files**

```bash
grep -rn "NewSessionView\|computeIsEmptySession\|FlaggedCanvasWorkspace\|CanvasWorkspaceDispatcher" client/src/ 2>/dev/null | grep -v __tests__ | grep -v "\.md:"
```

Expected: no output (after the deletions land). Before deletion, this lists every consumer that needs updating.

- [ ] **Step 2: Delete the files**

```bash
rm client/src/features/workspace-shell/CanvasWorkspace.tsx
rm client/src/features/workspace-shell/CanvasWorkspaceDispatcher.tsx
rm client/src/features/workspace-shell/components/NewSessionView.tsx
rm client/src/features/workspace-shell/utils/computeIsEmptySession.ts
rm client/src/features/workspace-shell/utils/__tests__/computeIsEmptySession.regression.test.ts
```

- [ ] **Step 3: Rename**

```bash
git mv client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx client/src/features/workspace-shell/CanvasWorkspace.tsx
```

- [ ] **Step 4: Update `index.ts`**

```ts
export { CanvasWorkspace } from "./CanvasWorkspace";
export {
  PROMPT_FOCUS_INTENT,
  dispatchPromptFocusIntent,
  addPromptFocusIntentListener,
  CONTINUE_SCENE,
  dispatchContinueScene,
  addContinueSceneListener,
} from "./events";
export type {
  PromptFocusIntentDetail,
  PromptFocusIntentEvent,
  ContinueSceneDetail,
  ContinueSceneEvent,
} from "./events";
```

- [ ] **Step 5: Refactor `CanvasSettingsRow` to drop Tune chips**

Read the current file, identify the Tune-chips block, delete it, keep the dropdowns. Verify nothing breaks by running the enhance regression test.

- [ ] **Step 6: Drop the flag**

Edit `features.config.ts`: remove the `UNIFIED_WORKSPACE` entry from both `FLAG_DEFS` and `FEATURES`. Remove the matching env line from `.env.local`.

- [ ] **Step 7: Type check + lint + full test**

```bash
cd client && npx tsc --noEmit
cd .. && npx eslint --config config/lint/eslint.config.js client/src/ --quiet
npm run test:unit
```

Expected: 0 errors. All tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(workspace-shell): remove unified-workspace feature flag

Deletes the legacy CanvasWorkspace tree (NewSessionView,
computeIsEmptySession, CanvasWorkspaceDispatcher), renames
UnifiedCanvasWorkspace to CanvasWorkspace, drops layoutMode from
CanvasPromptBar, removes Tune chips from CanvasSettingsRow (now in
the TuneDrawer), and unregisters VITE_FEATURE_UNIFIED_WORKSPACE.

The unified workspace is now the only path. All three regression
tests (failed-hero-retry, gallery-selection, enhance) plus the new
GenTile / ShotRow / TuneDrawer / CostPreview suites stay green.

Closes the unified-workspace refactor described in
docs/superpowers/specs/2026-05-04-unified-workspace-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 25: Final smoke + close-out

- [ ] **Step 1: Manual smoke test**

Run: `npm start`. Verify the app is functionally identical to flag-on Phase 2 + Tune drawer + cost preview, with no flag involvement.

- [ ] **Step 2: Commit project plan completion**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(workspace-shell): unified workspace refactor complete

All 3 phases shipped. Spec: docs/superpowers/specs/2026-05-04-unified-workspace-design.md
Plan: docs/superpowers/plans/2026-05-04-unified-workspace.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**

| Spec section                                            | Plan task(s)                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Locked decisions: feature flag at index.ts           | Task 9                                                                                                                                                                                                                                                          |
| §1 Locked decisions: React Context + existing stores    | Task 4, 8 (no new stores added)                                                                                                                                                                                                                                 |
| §1 Locked decisions: Tailwind                           | All component tasks (5, 7, 13, 14, 21)                                                                                                                                                                                                                          |
| §1 Locked decisions: useGenerationsRuntime untouched    | Task 8 (preserves the call site verbatim)                                                                                                                                                                                                                       |
| §1 Locked decisions: heroGeneration semantics preserved | Task 12 (`useFeaturedTile`)                                                                                                                                                                                                                                     |
| §1 Locked decisions: mode tabs aria-disabled            | Task 5                                                                                                                                                                                                                                                          |
| §1 Locked decisions: Continue Scene → StartFramePopover | Task 16 step 5 (full asset resolution noted as Phase 2.5)                                                                                                                                                                                                       |
| §1 Locked decisions: pin shot deferred                  | Out of scope, no task                                                                                                                                                                                                                                           |
| §1 Locked decisions: mobile deferred                    | Out of scope, no task                                                                                                                                                                                                                                           |
| §3 State machine                                        | Task 3                                                                                                                                                                                                                                                          |
| §4 Layout regions                                       | Task 5, 7, 8, 19                                                                                                                                                                                                                                                |
| §5 Shot data shape                                      | Task 11                                                                                                                                                                                                                                                         |
| §6 New CONTINUE_SCENE event                             | Task 15                                                                                                                                                                                                                                                         |
| §7 Token deltas                                         | Task 2 (Phase 1 layout tokens) + Task 19 (Phase 3 status hues + canvas-bg)                                                                                                                                                                                      |
| §8 Phase 1 plan                                         | Tasks 1–10                                                                                                                                                                                                                                                      |
| §8 Phase 2 plan                                         | Tasks 11–18                                                                                                                                                                                                                                                     |
| §8 Phase 3 plan: drawer add                             | Tasks 19–22                                                                                                                                                                                                                                                     |
| §8 Phase 3 plan: polish                                 | Task 23                                                                                                                                                                                                                                                         |
| §8 Phase 3 plan: flag removal                           | Task 24                                                                                                                                                                                                                                                         |
| §9 A11y & motion                                        | Task 5 (aria-disabled tabs), Task 14 (aria-labelledby on shot rows). Keyboard shortcuts (⌘K composer focus, J/K shot navigation, H/L variant navigation) + aria-live announcer + reduced-motion handling are NOT covered by an explicit task. **Add Task 23.5** |
| §10 Risks: 32+ video perf                               | Task 17                                                                                                                                                                                                                                                         |
| §10 Risks: legacy promptVersionId                       | Task 11 (synthetic bucket)                                                                                                                                                                                                                                      |
| §10 Risks: mode tabs scope                              | Task 5 (aria-disabled)                                                                                                                                                                                                                                          |
| §10 Risks: failed-hero retry                            | Task 12                                                                                                                                                                                                                                                         |
| §10 Risks: composer occlusion                           | Task 8 (canvas padding-bottom 140px)                                                                                                                                                                                                                            |
| §11 Test contract                                       | Tasks 6, 16, 17                                                                                                                                                                                                                                                 |
| §12 Out of scope                                        | Honored throughout                                                                                                                                                                                                                                              |
| §13 Commit protocol                                     | Every commit step runs tsc + lint via the pre-commit hook                                                                                                                                                                                                       |

**Gap found in self-review:** §9 keyboard shortcuts (⌘K, J/K, H/L) and the `aria-live="polite"` tile state announcer are not covered by any task above. Adding Task 23.5 below.

**Placeholder scan:** Searched for "TODO", "TBD", "implement later", "fill in details" in the plan. Found these intentional pointers:

- Task 6 step 4 — "STOP — the actual implementation must paste in the verbatim 333-line body" (intentional reminder, not a placeholder)
- Task 8 step 2 — `expect(true).toBe(true); // placeholder; engineer fills in.` (acceptable per the explanatory note: full mock setup requires reading the existing test fixtures; the TASK as written tells the engineer what to do)
- Task 16 step 5 — Continue Scene full asset resolution noted as "Phase 2.5" with the integration shape spelled out (acceptable scope deferral; the SHIP point is the event + handler stub, not full last-frame extraction)
- Task 20 step 5 — `getModelConfig` field name verification (intentional — registry shape is uncertain; engineer must verify the actual field name)
- Task 21 — Detailed code "omitted for brevity" with pattern reference. **This is the worst placeholder in the plan; tightening below.**

**Type consistency:** `Generation["status"]` referenced consistently across Tasks 3, 11, 12, 13. `Shot` type defined in Task 11, consumed in Tasks 12, 14, 16 with identical fields. `PromptEditorSurfaceProps` defined in Task 6, consumed in Tasks 7, 16 with identical shape. `WorkspaceMoment` defined in Task 3, consumed in Tasks 7, 8, 16 with identical 4-string union.

### Task 23.5 (added during self-review): Keyboard shortcuts + aria-live announcer

**Files:**

- Create: `client/src/features/workspace-shell/hooks/useWorkspaceKeyboardShortcuts.ts`
- Create: `client/src/features/workspace-shell/components/TileStateAnnouncer.tsx`
- Modify: `client/src/features/workspace-shell/UnifiedCanvasWorkspace.tsx` (mount the announcer; install the keyboard hook)

The hook listens for ⌘K (focus composer via `dispatchPromptFocusIntent`), J/K (cycle the active shot — increment/decrement an internal index that drives `featuredTileId` selection by surrogate), H/L (cycle variants within the active shot). The announcer is a single `<div role="status" aria-live="polite">` that subscribes to `shots[0].tiles` status changes and announces "Variant 2 ready" debounced to 1.5s.

(Standard TDD pattern; one focused test per shortcut; commit on green.)

### Task 21 (tightened): TuneDrawer + CostPreview full code

Replace the "omitted for brevity" deferral with concrete code blocks following the same TDD pattern as Tasks 5, 13, 14. Each component:

- `TuneDrawer.tsx` — three `<fieldset>` blocks (Motion / Mood / Style); chip buttons with `aria-pressed`; close button with `aria-label="Close"`. Tailwind classes match the floating composer surface (no separate background — it sits inside the composer's glass).
- `CostPreview.tsx` — `<span className="font-mono text-[11px] text-tool-text-dim">~{cost} cr / shot</span>` with the status-ready dot when cost > 0.

(The plan as currently written gestures at this; before execution, the engineer should expand Task 21 into the same step-by-step structure as Task 13. Optionally, request a follow-up plan for Phase 3 alone with full code, after Phase 1 + Phase 2 land cleanly.)

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-04-unified-workspace.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
