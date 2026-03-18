# Design Tokens Reference

Quick reference for color tokens used in the Vidra UI. All colors must use design token classes — hardcoded hex values (`[#...]`) are blocked by ESLint.

## System Tokens (`--ps-*`)

Defined in `packages/promptstudio-system/src/tokens.css`. Available as Tailwind classes via the preset.

| Token | Hex | Tailwind Class | Usage |
|-------|-----|---------------|-------|
| `--ps-bg` | `#16181d` | `bg-app` | Page background |
| `--ps-surface-1` | `#1b1e23` | `bg-surface-1` | Panel backgrounds |
| `--ps-surface-2` | `#2c3037` | `bg-surface-2` | Elevated surfaces, active tabs |
| `--ps-surface-3` | `#242a38` | `bg-surface-3` | — |
| `--ps-border` | `#434651` | `border-border` | Default borders |
| `--ps-border-strong` | `#5a5e6c` | `border-border-strong` | Emphasized borders |
| `--ps-text` | `#ebecef` | `text-foreground` | Primary text |
| `--ps-text-muted` | `#c6c9d2` | `text-muted` | Secondary text |
| `--ps-text-faint` | `#aaaebb` | `text-faint` | Tertiary text |
| `--ps-text-ghost` | `#a1afc5` | `text-ghost` | Ghost/muted text |
| `--ps-accent` | `#ffffff` | `text-accent` | White accent |
| `--ps-accent-2` | `#b3affd` | `text-accent-2` | Purple version accent |
| `--ps-accent-runway` | `#2c22fa` | `bg-accent-runway` | Runway blue CTA |
| `--ps-success` | `#4ec7a2` | `text-success` | Success state |
| `--ps-warning` | `#f5c05c` | `text-warning` | Warning state |
| `--ps-danger` | `#fa6e7c` | `text-danger` | Error/danger state |

## Tool Sidebar Tokens (`--tool-*`)

Defined in `client/src/index.css`. Mapped in `config/build/tailwind.config.js` under the `tool.*` namespace.

| Token | Hex | Tailwind Class | Usage |
|-------|-----|---------------|-------|
| `--tool-rail-bg` | `#131416` | `bg-tool-rail-bg` | Rail background |
| `--tool-panel-bg` | `#131416` | `bg-tool-panel-bg` | Panel background |
| `--tool-panel-inner-bg` | `#12131A` | `bg-tool-panel-inner` | Inner panel bg |
| `--tool-rail-border` | `#1B1E23` | `border-tool-rail-border` | Rail/divider borders |
| `--tool-nav-active-bg` | `#22252C` | `bg-tool-nav-active` | Active nav item bg |
| `--tool-nav-hover-bg` | `#1C1E26` | `bg-tool-nav-hover` | Nav hover bg |
| `--tool-nav-indicator` | `#3B82F6` | `bg-tool-nav-indicator` | Active pill indicator |
| `--tool-tab-active-bg` | `#2F3237` | `bg-tool-tab-active` | Active tab bg |
| `--tool-border-primary` | `#2C3037` | `border-tool-border-primary` | Primary borders |
| `--tool-border-dark` | `#29292D` | `border-tool-border-dark` | Dark borders |
| `--tool-text-primary` | `#FFFFFF` | `text-tool-text-primary` | Primary text |
| `--tool-text-secondary` | `#A1AFC5` | `text-tool-text-secondary` | Secondary text |
| `--tool-text-muted` | `#A0AEC0` | `text-tool-text-muted` | Muted text |
| `--tool-text-dim` | `#8B92A5` | `text-tool-text-dim` | Dim text |
| `--tool-text-subdued` | `#555B6E` | `text-tool-text-subdued` | Very subdued text |
| `--tool-text-label` | `#3A3E4C` | `text-tool-text-label` | Label/caption text |
| `--tool-text-disabled` | `#3A3D46` | `text-tool-text-disabled` | Disabled text |
| `--tool-text-placeholder` | `#7C839C` | `text-tool-text-placeholder` | Placeholder text |
| `--tool-accent-purple` | `#B3AFFD` | `text-tool-accent-purple` | Purple accent |
| `--tool-accent-selection` | `#6C5CE7` | `text-tool-accent-selection` | Selection accent (frames, badges) |
| `--tool-surface-deep` | `#0D0E12` | `bg-tool-surface-deep` | Deepest bg |
| `--tool-surface-inset` | `#0F1118` | `bg-tool-surface-inset` | Inset container bg |
| `--tool-surface-card` | `#16181E` | `bg-tool-surface-card` | Card/container bg |

## Decision Tree: When to Add a New Token

1. Does the color exist in `tokens.css` (`--ps-*`)? → Use the system token.
2. Does it exist in `index.css` (`--tool-*`)? → Use the tool token.
3. Neither? → **Add a CSS variable to `index.css`**, then add the Tailwind mapping to `config/build/tailwind.config.js`, then use the new class.

**Never use `[#hex]` in a className.** The `no-hardcoded-css/no-arbitrary-color` ESLint rule will block it.

## Namespace Conventions

- `--ps-*` — System-level design tokens (colors, spacing, typography, motion). Defined in the `@promptstudio/system` package. Shared across all apps.
- `--tool-*` — App-level ToolSidebar and modal colors. Defined in `client/src/index.css`. Specific to this app.
- Tailwind colors: system tokens are mapped in `packages/promptstudio-system/tailwind.preset.js`, tool tokens in `config/build/tailwind.config.js`.
