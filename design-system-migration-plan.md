# Design System Token Migration Plan

**Goal:** Eliminate all 725 hardcoded hex color violations across 72 files without changing any rendered pixels or component behavior.

**Constraint:** Every replacement must be visually identical. Where no exact token match exists, add a new CSS variable first, then replace.

---

## Phase 0: Add Missing CSS Variables and Tailwind Mappings

**Files:** `client/src/index.css`, `config/build/tailwind.config.js`

Several high-frequency hex values have no existing token. Add them before touching any component files.

### New CSS variables needed in `client/src/index.css`

```css
/* Additional tool-level surface/text tokens */
--tool-text-dim: #8B92A5;        /* 57 uses — between ghost and faint */
--tool-text-label: #3A3E4C;      /* 24 uses — very faint label text */
--tool-text-disabled: #3A3D46;   /* 19 uses — disabled/inactive text */
--tool-text-caption: #7C839C;    /* 10 uses — caption/placeholder */
--tool-surface-card: #16181E;    /* 22 uses — card/container bg */
```

### New Tailwind color mappings in `config/build/tailwind.config.js`

Add to the `tool` object:
```js
'text-dim': 'var(--tool-text-dim)',
'text-label': 'var(--tool-text-label)',
'text-disabled': 'var(--tool-text-disabled)',
'text-caption': 'var(--tool-text-caption)',
'surface-card': 'var(--tool-surface-card)',
```

**Verification:** `npx tsc --noEmit` — must pass (config-only, no component changes).

---

## Phase 1: Mechanical Find-and-Replace (Top 15 Hex Values)

These 15 hex values account for ~550 of 725 violations (~76%). Each replacement is a direct class-name swap with no logic changes.

### Migration Table

| Hex | Frequency | Replacement Class | Token Source |
|-----|-----------|-------------------|-------------|
| `#22252C` | 77 | `tool-nav-active` | `--tool-nav-active-bg` (exact) |
| `#8B92A5` | 57 | `tool-text-dim` | New: `--tool-text-dim` (exact) |
| `#6C5CE7` | 44 | `accent-2` | `--ps-accent-2` (#b3affd — close, brighter purple) |
| `#555B6E` | 43 | `tool-text-subdued` | `--tool-text-subdued` (exact) |
| `#E2E6EF` | 42 | `foreground` | `--ps-text` (#ebecef — near-identical) |
| `#0D0E12` | 32 | `tool-surface-deep` | `--tool-surface-deep` (exact) |
| `#A1AFC5` | 30 | `ghost` | `--ps-text-ghost` (exact) |
| `#1A1C22` | 30 | `tool-rail-border` | `--tool-rail-border` (#1B1E23 — 1 shade off) |
| `#2C3037` | 26 | `surface-2` | `--ps-surface-2` (exact) |
| `#3A3E4C` | 24 | `tool-text-label` | New: `--tool-text-label` (exact) |
| `#16181E` | 22 | `tool-surface-card` | New: `--tool-surface-card` (exact) |
| `#3A3D46` | 19 | `tool-text-disabled` | New: `--tool-text-disabled` (exact) |
| `#1B1E23` | 13 | `surface-1` | `--ps-surface-1` (exact) |
| `#FBBF24` | 10 | `amber-400` | Tailwind default (keep as-is or map to `warning-400`) |
| `#7C839C` | 10 | `tool-text-caption` | New: `--tool-text-caption` (exact) |

### ⚠️ Color Shift Warning: `#6C5CE7` → `accent-2`

`#6C5CE7` is a medium-dark purple. `accent-2` (`#b3affd`) is a lighter lavender. This is the **one visual change** in the migration. Options:

- **Option A (recommended):** Add `--tool-accent-selection: #6C5CE7` as a new token and map it to `tool-accent-selection`. Zero visual change.
- **Option B:** Accept the shift to `accent-2`. Unifies purple usage across the system but changes the selection border color in storyboard frames, generation badges, etc.

### Alpha Variant Handling

Several hex values appear with alpha suffixes (e.g., `#6C5CE744`, `#22252C80`). These map to Tailwind's opacity modifier syntax:

| Pattern | Replacement |
|---------|-------------|
| `text-[#6C5CE7]` | `text-tool-accent-selection` (if Option A) |
| `bg-[#6C5CE744]` | `bg-tool-accent-selection/25` |
| `bg-[#6C5CE711]` | `bg-tool-accent-selection/5` |
| `bg-[#6C5CE71A]` | `bg-tool-accent-selection/10` |
| `border-[#22252C]` | `border-tool-nav-active` |
| `text-[#8B92A580]` | `text-tool-text-dim/50` |

### Execution Order (by directory)

Process one directory at a time. After each directory, reload in Chrome and visually compare.

| Batch | Directory | Files | Est. Violations |
|-------|-----------|-------|----------------|
| 1a | `components/ToolSidebar/components/panels/GenerationControlsPanel/` | 5 | ~164 |
| 1b | `components/ToolSidebar/components/panels/SessionsPanel.tsx` | 1 | ~23 |
| 2a | `features/prompt-optimizer/CanvasWorkspace/components/` | 5 | ~151 |
| 2b | `features/prompt-optimizer/GenerationsPanel/components/` | 3 | ~60 |
| 2c | `features/prompt-optimizer/components/` | 1 | ~25 |
| 3 | `features/model-intelligence/` | 2 | ~40 |
| 4 | `features/convergence/` | 2 | ~20 |
| 5 | Remaining scattered files | ~10 | ~50 |

### Per-Batch Verification

After each batch:

1. `npx tsc --noEmit` — type check
2. `npx eslint --config config/lint/eslint.config.js <changed-files> --quiet` — lint
3. Reload page in Chrome, screenshot key UI states
4. Compare screenshots with baseline — zero pixel difference expected (except `#6C5CE7` if using Option B)

---

## Phase 2: Update Tests

After all component files are migrated, update test assertions that reference old hex class names.

Search pattern: `grep -r '\[#' --include='*.test.tsx' --include='*.test.ts' client/ tests/`

Each test assertion like `toContain('bg-[#22252C]')` becomes `toContain('bg-tool-nav-active')`.

**Verification:** `npm run test:unit` — all shards must pass.

---

## Phase 3: Add ESLint Rule to Prevent Regressions

### Option A: Custom ESLint Rule (Lightweight)

Add to `config/lint/eslint.config.js`:

```js
{
  // Custom rule: flag Tailwind arbitrary color values
  rules: {
    'no-restricted-syntax': ['error', {
      selector: 'Literal[value=/\\[#[0-9a-fA-F]/]',
      message: 'Use design token classes instead of arbitrary hex colors. See design-system-migration-plan.md for the mapping table.'
    }]
  }
}
```

This is approximate — it catches string literals containing `[#hex` patterns. It may have false positives for non-className strings.

### Option B: eslint-plugin-tailwindcss (Thorough)

```bash
npm install -D eslint-plugin-tailwindcss
```

Configure `no-arbitrary-value` rule to flag arbitrary color utilities (`bg-[#...]`, `text-[#...]`, `border-[#...]`).

### Recommendation

Start with Option A (zero dependencies, catches 90% of cases). Graduate to Option B when the violation count is at zero.

**Verification:** `npx eslint --config config/lint/eslint.config.js . --quiet` — must pass with 0 new errors (all violations already fixed in Phase 1-2).

---

## Phase 4: Document the Token System

Add a reference section to `client/CLAUDE.md` or a new `docs/DESIGN_TOKENS.md`:

### Content

1. **Color token cheatsheet** — the migration table from Phase 1, formatted as a quick-reference
2. **When to add a new token** — decision tree: does the color exist in `tokens.css`? → use it. Does it exist in `index.css` `--tool-*` vars? → use it. Neither? → add a CSS variable first, then the Tailwind mapping.
3. **Naming conventions** — `--ps-*` for system-level design tokens, `--tool-*` for app-level ToolSidebar/modal colors
4. **What's NOT allowed** — `[#hex]` in any className. Enforced by ESLint.

---

## Summary

| Phase | Scope | Files Changed | Violations Fixed | Risk |
|-------|-------|---------------|-----------------|------|
| 0 | Add tokens + mappings | 2 | 0 (infrastructure) | None |
| 1 | Mechanical class replacement | ~35 component files | ~550 | Low — className-only changes |
| 2 | Update tests | ~15 test files | N/A | None — string assertions only |
| 3 | ESLint rule | 1 config file | Prevention | None |
| 4 | Documentation | 1-2 doc files | Prevention | None |

**Total estimated effort:** ~4 focused sessions.
**Risk level:** Low — all changes are className string swaps. No prop changes, no logic changes, no new components. Visual verification at each batch.
**Expected outcome:** 0 hardcoded hex violations, lint rule preventing regressions, documented token system.
