import { describe, expect, it, vi } from "vitest";

import { TAXONOMY } from "#shared/taxonomy";
import { HierarchyValidator } from "../HierarchyValidator";

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

describe("HierarchyValidator", () => {
  it("returns no issues for empty input", () => {
    const validator = new HierarchyValidator();

    expect(validator.validateHierarchy([])).toEqual([]);
    expect(validator.validateConsistency([])).toEqual([]);
  });

  it("treats non-attribute categories as always valid in canAttributeExist", () => {
    const validator = new HierarchyValidator();

    expect(validator.canAttributeExist(TAXONOMY.SUBJECT.id, [])).toEqual({
      valid: true,
      missingParent: null,
    });
  });

  it("accepts attributes whose parent category is already present", () => {
    const validator = new HierarchyValidator();

    expect(
      validator.canAttributeExist(TAXONOMY.SUBJECT.attributes.WARDROBE, [
        TAXONOMY.SUBJECT.id,
      ]),
    ).toEqual({
      valid: true,
      missingParent: null,
    });
  });

  it("does not flag distant relationships when the parent is nearby", () => {
    const validator = new HierarchyValidator();

    const issues = validator.validateConsistency([
      { category: TAXONOMY.SUBJECT.id, text: "runner", start: 0, end: 6 },
      {
        category: TAXONOMY.SUBJECT.attributes.WARDROBE,
        text: "jacket",
        start: 20,
        end: 26,
      },
    ]);

    expect(issues).toEqual([]);
  });
});
