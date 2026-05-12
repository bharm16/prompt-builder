import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  OPTIMIZE_DIMENSION_KEYS,
  SUGGESTIONS_DIMENSION_KEYS,
  SPAN_LABELING_DIMENSION_KEYS,
} from "../judge-event-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface CalibrationEntry {
  scoredEvent: string;
  inputContent: Record<string, unknown>;
  outputContent: Record<string, unknown>;
  humanScore: number;
  humanDimensions: Record<string, number>;
}

function loadSet(surface: string): CalibrationEntry[] {
  const path = join(
    __dirname,
    "..",
    "calibration",
    `${surface}.calibration.json`,
  );
  return JSON.parse(readFileSync(path, "utf8")) as CalibrationEntry[];
}

const cases: Array<{
  surface: string;
  scoredEvent: string;
  dimensionKeys: readonly string[];
}> = [
  {
    surface: "optimize",
    scoredEvent: "optimize.completed",
    dimensionKeys: OPTIMIZE_DIMENSION_KEYS,
  },
  {
    surface: "suggestions",
    scoredEvent: "suggestions.completed",
    dimensionKeys: SUGGESTIONS_DIMENSION_KEYS,
  },
  {
    surface: "span-labeling",
    scoredEvent: "label-spans.completed",
    dimensionKeys: SPAN_LABELING_DIMENSION_KEYS,
  },
];

for (const { surface, scoredEvent, dimensionKeys } of cases) {
  describe(`${surface} calibration set`, () => {
    const entries = loadSet(surface);

    it("file parses as a JSON array", () => {
      expect(Array.isArray(entries)).toBe(true);
    });

    // The remaining assertions are gated: they only run once the calibration
    // JSON is populated (length > 0). Until then they're effectively no-ops,
    // letting the infrastructure land cleanly while the hand-authoring work is
    // tracked separately.
    if (entries.length === 0) {
      it.skip("contains at least 30 entries (pending hand-authoring)", () => {});
      return;
    }

    it("contains at least 30 entries", () => {
      expect(entries.length).toBeGreaterThanOrEqual(30);
    });

    it(`every entry uses scoredEvent = '${scoredEvent}'`, () => {
      for (const e of entries) {
        expect(e.scoredEvent).toBe(scoredEvent);
      }
    });

    it("every entry has all 5 dimensions in [0,5]", () => {
      for (const e of entries) {
        for (const k of dimensionKeys) {
          expect(typeof e.humanDimensions[k]).toBe("number");
          expect(e.humanDimensions[k]).toBeGreaterThanOrEqual(0);
          expect(e.humanDimensions[k]).toBeLessThanOrEqual(5);
        }
      }
    });

    it("humanScore equals the sum of dimensions", () => {
      for (const e of entries) {
        const sum = Object.values(e.humanDimensions).reduce((a, b) => a + b, 0);
        expect(e.humanScore).toBe(sum);
      }
    });

    it("covers the full quality range (min <= 10, max >= 18)", () => {
      const scores = entries.map((e) => e.humanScore);
      expect(Math.min(...scores)).toBeLessThanOrEqual(10);
      expect(Math.max(...scores)).toBeGreaterThanOrEqual(18);
    });
  });
}
