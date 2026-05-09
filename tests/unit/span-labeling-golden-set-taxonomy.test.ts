import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  isAttribute,
  isValidCategory,
  VALID_CATEGORIES,
} from "#shared/taxonomy";

const GOLDEN_SET_DIR = join(
  process.cwd(),
  "server/src/llm/span-labeling/evaluation/golden-set",
);

interface GoldenSpan {
  text: string;
  start: number;
  end: number;
  role: string;
}

interface GoldenPrompt {
  id: string;
  text: string;
  groundTruth: { spans: GoldenSpan[] };
}

interface GoldenFixture {
  metadata: { name: string; category: string; version: string };
  prompts: GoldenPrompt[];
}

function loadFixtures(): Array<{ file: string; fixture: GoldenFixture }> {
  return readdirSync(GOLDEN_SET_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((file) => ({
      file,
      fixture: JSON.parse(
        readFileSync(join(GOLDEN_SET_DIR, file), "utf8"),
      ) as GoldenFixture,
    }));
}

describe("Golden set taxonomy drift guard", () => {
  const fixtures = loadFixtures();

  it("loads at least one golden-set fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it("VALID_CATEGORIES is non-empty (sanity)", () => {
    expect(VALID_CATEGORIES.size).toBeGreaterThan(0);
  });

  // Per-fixture, per-prompt assertion. Failing prompt id and role land in the
  // error message so the diagnostic is actionable.
  for (const { file, fixture } of fixtures) {
    describe(file, () => {
      for (const prompt of fixture.prompts) {
        it(`${prompt.id}: every ground-truth role is in VALID_CATEGORIES`, () => {
          const invalid = prompt.groundTruth.spans
            .map((s) => s.role)
            .filter((role) => !isValidCategory(role));

          expect(invalid).toEqual([]);
        });

        // Anti-pattern guard: every span must use a leaf attribute (e.g.
        // "subject.identity"), not a bare parent ("subject"). Bare-parent
        // labels are ambiguous — the model can't learn whether the span
        // is about identity, appearance, wardrobe, or emotion.
        it(`${prompt.id}: every role uses a leaf attribute, not a bare parent`, () => {
          const bareParents = prompt.groundTruth.spans
            .map((s) => s.role)
            .filter((role) => !isAttribute(role));

          expect(bareParents).toEqual([]);
        });

        it(`${prompt.id}: every span's [start, end) lies within prompt text`, () => {
          const len = prompt.text.length;
          const outOfBounds = prompt.groundTruth.spans.filter(
            (s) => s.start < 0 || s.end > len || s.start >= s.end,
          );

          expect(outOfBounds).toEqual([]);
        });

        it(`${prompt.id}: every span's text matches prompt[start:end]`, () => {
          const mismatched = prompt.groundTruth.spans.filter(
            (s) => prompt.text.slice(s.start, s.end) !== s.text,
          );

          expect(mismatched).toEqual([]);
        });
      }
    });
  }
});
