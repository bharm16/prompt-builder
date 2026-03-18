# Design System Audit — Vidra

**Date:** 2026-03-17
**Scope:** `packages/promptstudio-system/`, `client/src/components/`, `client/src/features/*/components/`

---

## Summary

| Metric | Value |
|--------|-------|
| **System components** | 24 (well-designed Radix + CVA) |
| **Client components** | 120+ across 16 directories |
| **Feature components** | 14 domain areas |
| **Issues found** | 5 critical/high, 4 medium |
| **Overall score** | **62 / 100** |

The token system is mature (~685 CSS variables, proper layer ordering, semantic naming). The problem is adoption — **442 instances of hardcoded hex colors across 74 files** bypass it entirely. The architecture is sound; the enforcement is absent.

---

## Token Coverage

| Category | Tokens Defined | Hardcoded Values Found | Coverage |
|----------|---------------|----------------------|----------|
| Colors | 80+ (brand, semantic, surface, text, glass) | **442 instances** in 74 files via `[#...]` | Poor |
| Spacing | 12-step scale + semantic aliases | Minor — layout primitives use tokens well | Good |
| Typography | Full scale (fs-10 → fs-56, weights, line heights) | 1 instance (`text-[13px]` in ToolNavButton) | Good |
| Borders / Radius | xs → 3xl + pill | Clean | Excellent |
| Shadows | 6 levels + glow | Clean | Excellent |
| Motion | 4 durations + 3 semantic + easings | Clean, respects `prefers-reduced-motion` | Excellent |
| Z-index | 9-level stack (base → toast) | Clean | Excellent |

**Root cause of color violations:** Developers use Tailwind's `[#hex]` arbitrary value syntax instead of mapped token classes. No lint rule prevents this.

---

## Worst Offenders (Hardcoded Colors)

| File | Violations | Examples |
|------|-----------|----------|
| `ToolNavButton.tsx` | 4+ | `bg-[#22252C]`, `text-[#E2E6EF]`, `bg-[#3B82F6]` |
| `FaceSwapPreviewModal.tsx` | 10+ | `bg-[#12131A]`, `border-[#29292D]`, `bg-[#2C22FA]` |
| `CameraMotionModal.tsx` | 8+ | `bg-[#12131A]`, `text-[#A1AFC5]`, `bg-[#1B1E23]` |
| `InsufficientCreditsModal.tsx` | 8+ | `border-[#1A1C22]`, `bg-[#111318]`, `text-[#8B92A5]` |
| `ToolRail.tsx` | 5+ | `border-[#1A1C22]`, `bg-[#2A2D35]`, `text-[#555B6E]` |
| `GenerationBadge.tsx` | 2 | `text-[#4ADE80]/80`, `text-[#6C5CE7]/80` |
| Feature components (continuity, prompt-optimizer) | 50+ | Scattered across ~60 files |

Many of these hex values map directly to existing tokens (e.g., `#A1AFC5` ≈ `--ps-text-muted`, `#1B1E23` ≈ `--ps-surface-2`). This is purely a discoverability/enforcement gap.

---

## Naming Consistency

| Issue | Where | Recommendation |
|-------|-------|----------------|
| **"Dialog" vs "Modal"** mixed terminology | `dialog.tsx` in system, `CameraMotionModal.tsx` / `FaceSwapPreviewModal.tsx` in client | Adopt convention: "Dialog" for Radix overlays, "Modal" for full-screen custom overlays. Document it. |
| **Folder casing** inconsistent | Root: PascalCase (`VideoConceptBuilder/`), Features: kebab-case (`prompt-optimizer/`) | This is fine — root = component, feature = domain. Just document the rule. |
| **Component file casing** | Consistent PascalCase | No issues found. |

---

## Component Completeness

| Component | Variants | States | A11y | Docs | Score |
|-----------|----------|--------|------|------|-------|
| Button (system) | 7 + 8 sizes | loading, disabled, aria-busy | Excellent | CVA self-documents | 9/10 |
| Badge (system) | 3 + 5 sizes | — | Good | — | 8/10 |
| Panel (system) | 240 combos (surface × shadow × radius × padding) | — | Good | — | 8/10 |
| Dialog (system) | Radix-wrapped | focus trap, ESC | Excellent | — | 9/10 |
| Select (system) | 5 trigger + 6 sizes | disabled, open/closed | Excellent | — | 9/10 |
| EmptyState (client) | 8 variants | role="status", aria-live | Excellent | — | 9/10 |
| ToolNavButton | 1 | hover, active, aria-pressed | Fair (hardcoded colors) | — | 5/10 |
| Modals (client) | 0 (each is bespoke) | Basic close/open | Poor (no Radix, hardcoded everything) | — | 3/10 |
| Form inputs | Base only | focus, disabled | Good (Radix) | No error variant | 6/10 |

**Missing from the system entirely:**

- Skeleton / shimmer loading component
- Consistent field-level error styling (red border + message)
- Progress indicator (bar or circular)
- Alert / inline feedback component
- Avatar component

---

## Accessibility

**Strong:**
- All Radix-based components get focus management, keyboard nav, ARIA roles for free
- `EmptyState` has `role="status"`, `aria-live="polite"`
- `ToolNavButton` uses `aria-pressed` for toggle
- `ToolRail` uses semantic `<nav>` with `aria-label`
- Icons consistently use `aria-hidden="true"`
- Motion respects `prefers-reduced-motion`

**Gaps:**
- Only ~46 of 120+ client components have explicit ARIA attributes
- Custom modals (`FaceSwapPreviewModal`, `CameraMotionModal`, `InsufficientCreditsModal`) don't use Radix Dialog — they lack focus trapping, ESC handling, and `aria-modal`
- No `aria-describedby` pattern for form validation errors
- No documented keyboard navigation guide
- No skip-nav link in `AppShell`

---

## Architecture Strengths

Things working well that should be preserved:

1. **CSS layer ordering** (`ps.tokens` → `ps.base` → `ps.type` → `ps.layout` → `ps.animations` → `ps.utilities`) prevents cascade conflicts.
2. **CVA for variants** — Button, Badge, Panel, Select all use `class-variance-authority` consistently. This is the right pattern.
3. **Radix primitives** for Dialog, Select, Dropdown, Tabs, Switch, Checkbox, Slider — no reinventing the wheel.
4. **Token naming convention** (`--ps-` prefix, semantic grouping) is clean and extensible.
5. **Layout primitives** (Box, Flex, Grid) properly consume tokens via CSS variables.
6. **shadcn compatibility layer** allows gradual adoption without breaking existing components.

---

## Priority Actions

### 1. Enforce token usage via lint rule (Critical)

Add an ESLint or Stylelint rule that flags arbitrary Tailwind color values (`[#...]`). This is the single highest-leverage fix — it prevents 442 existing violations from growing and forces developers to map colors to tokens.

Candidate: `eslint-plugin-tailwindcss` with `no-arbitrary-value` or a custom rule targeting color utilities.

### 2. Migrate the 3 bespoke modals to Radix Dialog (High)

`FaceSwapPreviewModal`, `CameraMotionModal`, and `InsufficientCreditsModal` are the worst offenders: hardcoded colors, no focus trapping, no keyboard handling, no ARIA. Wrap them in the existing system `Dialog` component and replace hex values with token classes.

### 3. Create a color token → Tailwind class mapping cheatsheet (High)

Most developers are likely using `[#hex]` because they don't know which token class maps to which color. A single reference file (or Storybook page) showing `--ps-surface-1` = `bg-surface-1` = the dark panel background would eliminate the discoverability gap.

### 4. Add field-level error states to Input/Textarea/Select (Medium)

The system has `--ps-input-border-error` and `--ps-danger` tokens defined but no component variant that applies them. Add an `error` variant to form components with red border + error message slot.

### 5. Standardize Dialog vs Modal naming (Medium)

Document the convention, rename files to match, add to the project's CLAUDE.md glossary.

### 6. Add missing system components (Low, ongoing)

Skeleton loader, Alert/InlineMessage, Progress, Avatar. These keep getting rebuilt ad-hoc in features — centralizing them prevents drift.

---

## Scoring Breakdown

| Area | Weight | Score | Weighted |
|------|--------|-------|----------|
| Token definition quality | 15% | 95 | 14.3 |
| Token adoption / enforcement | 25% | 30 | 7.5 |
| Component variant coverage | 15% | 80 | 12.0 |
| Naming consistency | 10% | 75 | 7.5 |
| Accessibility | 20% | 60 | 12.0 |
| State handling (loading/error/disabled) | 15% | 55 | 8.3 |
| **Total** | **100%** | | **61.5 → 62** |

The token system is professional-grade. The gap is entirely in enforcement and adoption. Fix the lint rule and migrate the modals, and this score jumps to ~80.
