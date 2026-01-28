# PromptStudio System (Design Tokens + Tailwind Preset)

## Overview

PromptStudio System is the **single source of truth** for design tokens and typography across apps in this repo.

- **Dark-first**
- **14px base**
- **CSS variables** define tokens
- **Tailwind preset** exposes token-backed utilities (unprefixed)

The system lives in the workspace package:
- `packages/promptstudio-system/src/tokens.css`
- `packages/promptstudio-system/src/type.css`
- `packages/promptstudio-system/tailwind.preset.js`

## Consuming the system in an app

### CSS (tokens + typography)

Import once in the client entry:

- `client/src/main.tsx` imports `@promptstudio/system/index.css`

### Tailwind preset

Tailwind loads the preset in:

- `config/build/tailwind.config.js`

## Token-backed Tailwind utilities

### Colors

- `bg-app`
- `bg-surface-1`, `bg-surface-2`, `bg-surface-3`
- `text-foreground`, `text-muted`, `text-faint`
- `border-border`, `border-border-strong`
- `ring-accent`, `border-accent`, `text-accent`

### Spacing

The system defines a 4px grid spacing scale via CSS vars and exposes it to Tailwind as **token utilities**:

- `p-ps-6`, `px-ps-4`, `py-ps-3`
- `m-ps-6`, `mt-ps-3`, `mb-ps-8`
- `gap-ps-3`, `space-y-ps-4`
- `top-ps-6`, `left-ps-4` (inset utilities)

Token keys:
- `ps-0` .. `ps-10`
- `ps-page` (default page padding / section rhythm)
- `ps-card` (default card padding)

### Typography

Semantic sizes:
- `text-h1` … `text-h5`
- `text-body`, `text-body-sm`, `text-body-lg`
- `text-label`, `text-label-sm`
- `text-meta`, `text-code`

Compatibility sizes (still token-backed, but numeric):
- `text-heading-40`, `text-heading-32`, `text-heading-24`, `text-heading-20`, `text-heading-18`, `text-heading-16`, `text-heading-14`
- `text-copy-16`, `text-copy-14`, `text-copy-13`
- `text-label-16`, `text-label-14`, `text-label-13`, `text-label-12`
- `text-button-16`, `text-button-14`, `text-button-12`

## Layout spacing tokens (ps-*)

Layout components in `client/src/components/layout` support `ps-*` tokens, mapped directly to CSS vars:

- `ps-1` .. `ps-10` → `var(--ps-s-1)` .. `var(--ps-s-10)`

Example:

- `<Section spacing="ps-6">` for standard vertical rhythm.
- `<Box p="ps-card">` for card padding.

## Editing the system

Make changes in the package and keep apps consuming the preset + CSS import. Avoid reintroducing app-local token sources.

