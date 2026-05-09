---
name: flag-docs-sync
description: Use after editing server/src/config/feature-flags.ts. Regenerates the auto-generated feature-flag table in CLAUDE.md by running scripts/generate-flag-docs.ts --write, then verifies the BEGIN/END markers and table integrity.
---

# Flag Docs Sync

Source of truth for feature flags is `server/src/config/feature-flags.ts`. The table in `CLAUDE.md` between `<!-- BEGIN: feature-flag-table -->` and `<!-- END: feature-flag-table -->` is auto-generated. This skill keeps them in sync.

## When to invoke

- After ANY edit to `server/src/config/feature-flags.ts`
- After adding, removing, or renaming a flag
- After changing a flag's default value, group, description, or legacy aliases
- Before committing changes touching the flags file

## Workflow

### 1. Verify the source file changed

```bash
git diff --name-only HEAD -- server/src/config/feature-flags.ts
```

If unchanged, no sync is needed — exit.

### 2. Run the generator in check mode first

```bash
npx tsx scripts/generate-flag-docs.ts
```

The script (without `--write`) reports whether `CLAUDE.md` is in sync. If already in sync, exit.

### 3. Write updated docs

```bash
npx tsx scripts/generate-flag-docs.ts --write
```

This rewrites the block between the BEGIN/END markers in `CLAUDE.md`.

### 4. Verify markers and structure are intact

```bash
grep -c "BEGIN: feature-flag-table" CLAUDE.md  # must be 1
grep -c "END: feature-flag-table" CLAUDE.md    # must be 1
```

If either count is wrong, the block was corrupted. Restore from git and investigate.

### 5. Confirm the diff is sensible

```bash
git diff CLAUDE.md
```

Visually verify the change matches what you expect from your `feature-flags.ts` edit. Flag a missing or unexpected row to the user before continuing.

### 6. Commit alongside the source change

The flag source edit and the doc regen are part of the same logical change. Commit them together — do NOT split into two commits.

## Common pitfalls

- **Editing the table by hand**: Don't. The HTML comment in `CLAUDE.md` says "Auto-generated… Do not edit by hand." Hand edits will be overwritten on the next regen.
- **Forgetting `--write`**: Without the flag, the script only prints a diff. The file isn't updated.
- **Running from the wrong directory**: The script resolves paths relative to the repo root. Always run from there.

## Related files

- Source of truth: `server/src/config/feature-flags.ts`
- Generator: `scripts/generate-flag-docs.ts`
- Output target: `CLAUDE.md` (between marker comments)
- Related skill: `.claude/skills/cross-layer-change/SKILL.md` if the flag also requires client changes
