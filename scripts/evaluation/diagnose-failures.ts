#!/usr/bin/env tsx

/**
 * Diagnostic for golden-set eval failures.
 *
 * Reads `golden-set-results-latest.json` (must contain `predicted` and
 * `groundTruth` per prompt) and produces:
 *
 *   1. Confusion matrix per ground-truth category — for each GT span the
 *      model overlapped (IoU >= 0.3) with a prediction, what role did
 *      it actually predict? Tells you whether failures are "wrong
 *      category" (model picked a sibling) or "completely missed"
 *      (no spatial overlap at all).
 *
 *   2. Failure breakdown — for each weak GT category (F1 < 0.6 or
 *      caller-specified --category), shows:
 *        - matched_correctly: count
 *        - wrong_role: count + breakdown by predicted role
 *        - missed: count (no prediction overlapped)
 *
 *   3. Top N worst prompts — prompts with the largest gap between GT
 *      and predicted span counts, with full diff.
 *
 * Usage:
 *   tsx scripts/evaluation/diagnose-failures.ts
 *   tsx scripts/evaluation/diagnose-failures.ts --category lighting.quality
 *   tsx scripts/evaluation/diagnose-failures.ts --top-prompts 5
 *
 * Exit codes:
 *   0 = analysis written
 *   2 = setup error (missing results file, missing predicted spans)
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESULTS_PATH = join(__dirname, "golden-set-results-latest.json");

// Use a looser IoU threshold (0.3) than the gate's 0.5 for diagnosis —
// we want to catch "model knew where the span was but got the boundary
// slightly wrong" cases, which the gate would mark as a miss.
const DIAGNOSTIC_IOU_THRESHOLD = 0.3;

interface Span {
  text: string;
  start: number;
  end: number;
  role: string;
}

interface PerPrompt {
  promptId: string;
  predictedCount: number;
  groundTruthCount: number;
  predicted: Span[];
  groundTruth: Span[];
  error: string | null;
}

interface ResultsFile {
  provider: string;
  perPrompt: PerPrompt[];
}

function calculateIoU(a: Span, b: Span): number {
  const intersection = Math.max(
    0,
    Math.min(a.end, b.end) - Math.max(a.start, b.start),
  );
  const union = Math.max(a.end, b.end) - Math.min(a.start, b.start);
  return union > 0 ? intersection / union : 0;
}

interface CategoryDiagnostic {
  category: string;
  totalGroundTruth: number;
  matchedCorrectly: number;
  wrongRole: Array<{
    predictedRole: string;
    count: number;
    examples: Array<{ promptId: string; text: string }>;
  }>;
  missed: number;
  missedExamples: Array<{ promptId: string; text: string }>;
}

function diagnoseCategory(
  category: string,
  results: PerPrompt[],
): CategoryDiagnostic {
  const wrongRoleCounts: Map<
    string,
    { count: number; examples: Array<{ promptId: string; text: string }> }
  > = new Map();
  let matchedCorrectly = 0;
  let missed = 0;
  const missedExamples: Array<{ promptId: string; text: string }> = [];
  let totalGroundTruth = 0;

  for (const prompt of results) {
    if (prompt.error !== null) continue;

    for (const gt of prompt.groundTruth) {
      if (gt.role !== category) continue;
      totalGroundTruth++;

      // Find the predicted span with highest IoU
      let bestIoU = 0;
      let bestPred: Span | null = null;
      for (const pred of prompt.predicted) {
        const iou = calculateIoU(pred, gt);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestPred = pred;
        }
      }

      if (bestPred && bestIoU >= DIAGNOSTIC_IOU_THRESHOLD) {
        if (bestPred.role === gt.role) {
          matchedCorrectly++;
        } else {
          const entry = wrongRoleCounts.get(bestPred.role) ?? {
            count: 0,
            examples: [],
          };
          entry.count++;
          if (entry.examples.length < 3) {
            entry.examples.push({
              promptId: prompt.promptId,
              text: gt.text,
            });
          }
          wrongRoleCounts.set(bestPred.role, entry);
        }
      } else {
        missed++;
        if (missedExamples.length < 3) {
          missedExamples.push({ promptId: prompt.promptId, text: gt.text });
        }
      }
    }
  }

  const wrongRole = [...wrongRoleCounts.entries()]
    .map(([predictedRole, v]) => ({
      predictedRole,
      count: v.count,
      examples: v.examples,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    category,
    totalGroundTruth,
    matchedCorrectly,
    wrongRole,
    missed,
    missedExamples,
  };
}

function formatDiagnostic(d: CategoryDiagnostic): string {
  const lines: string[] = [];
  lines.push(`\n━━━ ${d.category} (n=${d.totalGroundTruth}) ━━━`);
  const correctPct = d.totalGroundTruth
    ? ((d.matchedCorrectly / d.totalGroundTruth) * 100).toFixed(0)
    : "0";
  lines.push(`  matched correctly:  ${d.matchedCorrectly} (${correctPct}%)`);

  if (d.wrongRole.length > 0) {
    const totalWrong = d.wrongRole.reduce((s, w) => s + w.count, 0);
    const wrongPct = ((totalWrong / d.totalGroundTruth) * 100).toFixed(0);
    lines.push(`  wrong role:         ${totalWrong} (${wrongPct}%)`);
    for (const w of d.wrongRole) {
      lines.push(`    → ${w.predictedRole}: ${w.count}`);
      for (const ex of w.examples) {
        lines.push(`        e.g. "${ex.text}" (${ex.promptId})`);
      }
    }
  }

  if (d.missed > 0) {
    const missedPct = ((d.missed / d.totalGroundTruth) * 100).toFixed(0);
    lines.push(`  missed (no overlap): ${d.missed} (${missedPct}%)`);
    for (const ex of d.missedExamples) {
      lines.push(`    e.g. "${ex.text}" (${ex.promptId})`);
    }
  }

  return lines.join("\n");
}

interface CliOptions {
  category: string | null;
  topPrompts: number;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { category: null, topPrompts: 5 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--category") {
      opts.category = argv[++i] ?? null;
    } else if (arg === "--top-prompts") {
      opts.topPrompts = Number(argv[++i] ?? "5");
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: diagnose-failures.ts [--category <role>] [--top-prompts N]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function diagnoseTopPrompts(results: PerPrompt[], n: number): string {
  const lines: string[] = [];
  lines.push(`\n━━━ Top ${n} prompts with largest GT/predicted gap ━━━`);

  const ranked = results
    .filter((r) => r.error === null && r.groundTruthCount > 0)
    .map((r) => ({
      ...r,
      gap: Math.abs(r.predictedCount - r.groundTruthCount),
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, n);

  for (const r of ranked) {
    lines.push(
      `\n  ${r.promptId}: predicted ${r.predictedCount}, gt ${r.groundTruthCount} (gap=${r.gap})`,
    );
    if (r.predictedCount === 0 && r.groundTruthCount > 0) {
      lines.push(`    NO PREDICTIONS — investigate prompt format`);
      lines.push(
        `    GT roles: ${r.groundTruth.map((s) => s.role).join(", ")}`,
      );
    } else {
      const predRoles = r.predicted.map((s) => s.role).sort();
      const gtRoles = r.groundTruth.map((s) => s.role).sort();
      lines.push(`    GT roles:        ${gtRoles.join(", ")}`);
      lines.push(`    predicted roles: ${predRoles.join(", ")}`);
    }
  }

  return lines.join("\n");
}

function main(): number {
  const opts = parseArgs(process.argv.slice(2));

  let raw: string;
  try {
    raw = readFileSync(RESULTS_PATH, "utf8");
  } catch {
    console.error(
      `\n❌ No results file at ${RESULTS_PATH}. Run an eval first:\n   npm run eval:golden-set -- --provider groq`,
    );
    return 2;
  }

  const data = JSON.parse(raw) as ResultsFile;
  const hasSpans = data.perPrompt[0]?.predicted !== undefined;
  if (!hasSpans) {
    console.error(
      "\n❌ Results file is missing per-prompt `predicted` arrays. Re-run with the latest harness — predicted/groundTruth output was added recently.",
    );
    return 2;
  }

  console.log(`Provider: ${data.provider}`);
  console.log(`Total prompts: ${data.perPrompt.length}`);

  // Collect all distinct GT categories
  const categories = new Set<string>();
  for (const p of data.perPrompt) {
    for (const gt of p.groundTruth) {
      categories.add(gt.role);
    }
  }

  if (opts.category) {
    if (!categories.has(opts.category)) {
      console.error(
        `\n❌ Category "${opts.category}" not found. Available: ${[...categories].sort().join(", ")}`,
      );
      return 2;
    }
    const d = diagnoseCategory(opts.category, data.perPrompt);
    console.log(formatDiagnostic(d));
  } else {
    // Diagnose all categories with at least 5 ground-truth instances
    // (matches the gate's min-support threshold). Sort worst → best.
    const diagnostics = [...categories]
      .map((c) => diagnoseCategory(c, data.perPrompt))
      .filter((d) => d.totalGroundTruth >= 5)
      .sort((a, b) => {
        const aScore = a.matchedCorrectly / Math.max(1, a.totalGroundTruth);
        const bScore = b.matchedCorrectly / Math.max(1, b.totalGroundTruth);
        return aScore - bScore;
      });

    for (const d of diagnostics) {
      console.log(formatDiagnostic(d));
    }
  }

  console.log(diagnoseTopPrompts(data.perPrompt, opts.topPrompts));

  return 0;
}

process.exit(main());
