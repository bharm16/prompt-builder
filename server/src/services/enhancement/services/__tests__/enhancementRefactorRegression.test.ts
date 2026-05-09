import { describe, expect, it } from "vitest";
import { detectPlaceholder } from "../placeholderDetection";

describe("enhancement refactor regressions", () => {
  describe("detectPlaceholder function", () => {
    it("returns true for known placeholder keywords", () => {
      expect(
        detectPlaceholder(
          "location",
          "Set the scene in",
          "",
          "Set the scene in location",
        ),
      ).toBe(true);
    });

    it("avoids false positives for technical spec labels with colon context", () => {
      expect(
        detectPlaceholder(
          "dutch angle",
          "**Camera:** ",
          "",
          "**Camera:** dutch angle",
        ),
      ).toBe(false);
    });

    it("returns false for invalid highlighted text", () => {
      expect(detectPlaceholder("", "", "", "")).toBe(false);
      expect(detectPlaceholder(42 as unknown as string, "", "", "")).toBe(
        false,
      );
    });
  });
});
