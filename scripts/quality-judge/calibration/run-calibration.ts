import "dotenv/config";

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { runJudge } from "../judge-client.js";
import { loadRubric } from "../rubric-loader.js";
import { spearmanCorrelation, meanAbsoluteError } from "../correlation.js";
import {
  QUALITY_SCORED_SURFACES,
  sumDimensions,
  type QualityScoredSurface,
} from "../judge-event-types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CalibrationEntry {
  scoredEvent: string;
  inputContent: Record<string, unknown>;
  outputContent: Record<string, unknown>;
  humanScore: number;
  humanDimensions: Record<string, number>;
  humanNotes: string;
  authoredAt: string;
  authoredBy: string;
}

async function loadCalibration(
  surface: QualityScoredSurface,
): Promise<CalibrationEntry[]> {
  const path = join(__dirname, `${surface}.calibration.json`);
  return JSON.parse(await readFile(path, "utf8")) as CalibrationEntry[];
}

async function runForSurface(surface: QualityScoredSurface): Promise<boolean> {
  const entries = await loadCalibration(surface);
  if (entries.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[calibration] ${surface}: 0 entries — set is unpopulated. Run-calibration is a no-op until the calibration JSON is hand-authored.`,
    );
    // Treat empty set as a soft pass; the shape test enforces population separately.
    return true;
  }

  const rubric = await loadRubric(surface);
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const judged = await runJudge({
          rubric,
          surface,
          inputContent: entry.inputContent,
          outputContent: entry.outputContent,
        });
        return {
          humanScore: entry.humanScore,
          judgeScore: sumDimensions(judged.dimensions),
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[calibration] ${surface}: skipped entry — ${String(err)}`,
        );
        return null;
      }
    }),
  );

  const valid = results.filter(
    (r): r is { humanScore: number; judgeScore: number } => r !== null,
  );
  if (valid.length < 20) {
    // eslint-disable-next-line no-console
    console.error(
      `[calibration] ${surface}: too few valid entries (${valid.length}/${entries.length}); cannot judge`,
    );
    return false;
  }

  const rho = spearmanCorrelation(
    valid.map((r) => r.humanScore),
    valid.map((r) => r.judgeScore),
  );
  const mae = meanAbsoluteError(
    valid.map((r) => r.humanScore),
    valid.map((r) => r.judgeScore),
  );

  // eslint-disable-next-line no-console
  console.log(
    `[calibration] ${surface}: rho=${rho.toFixed(3)}  MAE=${mae.toFixed(2)}  (n=${valid.length})`,
  );

  if (rho < 0.7) {
    // eslint-disable-next-line no-console
    console.error(`[calibration] ${surface}: FAILED — need rho >= 0.7`);
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  const requested = process.argv.slice(2);
  const surfaces: QualityScoredSurface[] = requested.length
    ? (requested as QualityScoredSurface[])
    : [...QUALITY_SCORED_SURFACES];

  let allOk = true;
  for (const surface of surfaces) {
    const ok = await runForSurface(surface);
    if (!ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[calibration] fatal:", err);
  process.exit(2);
});
