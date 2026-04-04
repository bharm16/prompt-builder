import { describe, expect, it, vi } from "vitest";

import { TAXONOMY } from "#shared/taxonomy";
import { ValidationReporter } from "../ValidationReporter";

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe("ValidationReporter", () => {
  it("formats single and multi-orphan messages differently", () => {
    const reporter = new ValidationReporter();

    const single = reporter.generateOrphanMessage({
      missingParent: TAXONOMY.SUBJECT.id,
      orphanedSpans: [
        { category: TAXONOMY.SUBJECT.attributes.WARDROBE, text: "jacket" },
      ],
      count: 1,
      categories: [TAXONOMY.SUBJECT.attributes.WARDROBE],
    });

    const multi = reporter.generateOrphanMessage({
      missingParent: TAXONOMY.SUBJECT.id,
      orphanedSpans: [
        { category: TAXONOMY.SUBJECT.attributes.WARDROBE, text: "jacket" },
        { category: TAXONOMY.SUBJECT.attributes.EMOTION, text: "determined" },
      ],
      count: 2,
      categories: [
        TAXONOMY.SUBJECT.attributes.WARDROBE,
        TAXONOMY.SUBJECT.attributes.EMOTION,
      ],
    });

    expect(single).toContain("Consider adding a Subject & Character");
    expect(multi).toContain("Found 2 attribute(s)");
  });

  it("falls back to a REVIEW suggested fix for unknown issue types", () => {
    const reporter = new ValidationReporter();

    expect(
      reporter.generateFix({
        type: "UNKNOWN" as never,
        severity: "warning",
        message: "needs review",
      }),
    ).toEqual({
      action: "REVIEW",
      suggestion: "Review the prompt structure for consistency",
    });
  });

  it("summarizes mixed severities across errors, warnings, and suggestions", () => {
    const reporter = new ValidationReporter();

    expect(
      reporter.generateSummary([
        {
          type: "ORPHANED_ATTRIBUTE",
          severity: "error",
          message: "error",
          affectedSpans: [],
          suggestedFix: {
            action: "ADD_PARENT",
            suggestion: "add subject",
          },
        },
        {
          type: "MISSING_PARENT",
          severity: "warning",
          message: "warning",
          affectedSpans: [],
          suggestedFix: {
            action: "ADD_PARENT",
            suggestion: "add parent",
          },
        },
        {
          type: "DISTANT_RELATIONSHIP",
          severity: "info",
          message: "info",
          affectedSpans: [],
          suggestedFix: {
            action: "REORDER",
            suggestion: "move attribute",
          },
        },
      ]),
    ).toBe("Found 1 error(s), 1 warning(s), 1 suggestion(s)");
  });
});
