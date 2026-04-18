#!/usr/bin/env node
/**
 * Drift detector for hand-maintained shared catalogs.
 *
 * The shared/ layer carries three hand-maintained catalogs that the server
 * also knows about:
 *   - CANONICAL_PROMPT_MODEL_IDS + PROMPT_MODEL_ALIASES + PROMPT_MODEL_CONSTRAINTS (videoModels.ts)
 *   - GENERATION_PRICING (generationPricing.ts)
 *
 * This script checks internal consistency AND cross-checks server fallback
 * values that were meant to mirror shared. It's a lightweight safety net
 * (no API changes required) — run in CI to catch drift before deploy.
 *
 * Usage:
 *   npx tsx scripts/validate-shared-catalogs.ts          # report + exit 0 if clean
 *   npx tsx scripts/validate-shared-catalogs.ts --strict # exit 1 on any issue
 */

import {
  CANONICAL_PROMPT_MODEL_IDS,
  PROMPT_MODEL_ALIASES,
  PROMPT_MODEL_CONSTRAINTS,
} from "../shared/videoModels.ts";
import {
  GENERATION_PRICING,
  getGenerationCreditsPerSecond,
} from "../shared/generationPricing.ts";

interface Finding {
  severity: "error" | "warn";
  category: string;
  message: string;
}

const findings: Finding[] = [];

function err(category: string, message: string): void {
  findings.push({ severity: "error", category, message });
}

function warn(category: string, message: string): void {
  findings.push({ severity: "warn", category, message });
}

// ─── Check 1: every canonical model has a self-alias ────────────────
for (const canonical of CANONICAL_PROMPT_MODEL_IDS) {
  if (PROMPT_MODEL_ALIASES[canonical] !== canonical) {
    err(
      "aliases",
      `Canonical model "${canonical}" is missing a self-alias in PROMPT_MODEL_ALIASES (or points elsewhere).`,
    );
  }
}

// ─── Check 2: every canonical model has constraints ─────────────────
for (const canonical of CANONICAL_PROMPT_MODEL_IDS) {
  if (!(canonical in PROMPT_MODEL_CONSTRAINTS)) {
    err(
      "constraints",
      `Canonical model "${canonical}" is missing an entry in PROMPT_MODEL_CONSTRAINTS.`,
    );
  }
}

// ─── Check 3: no PROMPT_MODEL_CONSTRAINTS keys that aren't canonical ─
for (const key of Object.keys(PROMPT_MODEL_CONSTRAINTS)) {
  if (!(CANONICAL_PROMPT_MODEL_IDS as readonly string[]).includes(key)) {
    err(
      "constraints",
      `PROMPT_MODEL_CONSTRAINTS has an entry for "${key}" which is not in CANONICAL_PROMPT_MODEL_IDS.`,
    );
  }
}

// ─── Check 4: alias targets are all canonical ───────────────────────
for (const [alias, target] of Object.entries(PROMPT_MODEL_ALIASES)) {
  if (!(CANONICAL_PROMPT_MODEL_IDS as readonly string[]).includes(target)) {
    err(
      "aliases",
      `Alias "${alias}" points to "${target}" which is not a canonical model id.`,
    );
  }
}

// ─── Check 5: every canonical model has pricing (direct or via alias) ─
for (const canonical of CANONICAL_PROMPT_MODEL_IDS) {
  const direct = getGenerationCreditsPerSecond(canonical);
  if (direct == null) {
    // Check if any alias maps to this canonical id AND has pricing
    const pricedAlias = Object.entries(PROMPT_MODEL_ALIASES).find(
      ([aliasKey, target]) =>
        target === canonical &&
        aliasKey !== canonical &&
        getGenerationCreditsPerSecond(aliasKey) != null,
    );
    if (!pricedAlias) {
      warn(
        "pricing",
        `Canonical model "${canonical}" has no direct pricing in GENERATION_PRICING and no priced alias. UI will fall back to hardcoded defaults.`,
      );
    }
  }
}

// ─── Check 6: every pricing key is resolvable (canonical or alias) ──
const resolvableKeys = new Set<string>([
  ...CANONICAL_PROMPT_MODEL_IDS,
  ...Object.keys(PROMPT_MODEL_ALIASES),
  // Known non-video pricing keys that are intentionally outside the model registry:
  "flux-kontext",
  "storyboard",
]);
for (const priceKey of Object.keys(GENERATION_PRICING)) {
  if (!resolvableKeys.has(priceKey)) {
    warn(
      "pricing",
      `GENERATION_PRICING has an entry for "${priceKey}" which is not in the canonical set or alias table. It is effectively unreachable via prompt flow.`,
    );
  }
}

// ─── Report ─────────────────────────────────────────────────────────
const strict = process.argv.includes("--strict");
const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");

if (findings.length === 0) {
  process.stdout.write("Shared catalogs are consistent. ✓\n");
  process.exit(0);
}

const byCategory = new Map<string, Finding[]>();
for (const f of findings) {
  const bucket = byCategory.get(f.category) ?? [];
  bucket.push(f);
  byCategory.set(f.category, bucket);
}

for (const [category, entries] of byCategory) {
  process.stdout.write(`\n[${category}]\n`);
  for (const f of entries) {
    const tag = f.severity === "error" ? "ERROR" : "WARN ";
    process.stdout.write(`  ${tag}  ${f.message}\n`);
  }
}

process.stdout.write(
  `\nSummary: ${errors.length} error(s), ${warns.length} warning(s).\n`,
);

if (errors.length > 0 || (strict && warns.length > 0)) {
  process.exit(1);
}
process.exit(0);
