import { describe, expect, it } from "vitest";
import {
  calculateTotalScore,
  GENERAL_RUBRIC,
  getRubric,
  VIDEO_RUBRIC,
} from "../config/judgeRubrics";

describe("judgeRubrics", () => {
  describe("getRubric", () => {
    it('returns video rubric for "video" context', () => {
      const rubric = getRubric("video");
      expect(rubric.name).toBe("video_prompt_evaluation");
      expect(rubric.criteria).toHaveLength(4);
    });

    it('returns general rubric for "general" context', () => {
      const rubric = getRubric("general");
      expect(rubric.name).toBe("general_text_evaluation");
      expect(rubric.criteria).toHaveLength(4);
    });

    it("returns general rubric for unknown context", () => {
      const rubric = getRubric("unknown");
      expect(rubric.name).toBe("general_text_evaluation");
    });
  });

  describe("VIDEO_RUBRIC", () => {
    it("has required criteria: cinematicQuality, visualGrounding, safety, diversity", () => {
      const names = VIDEO_RUBRIC.criteria.map((c) => c.name);
      expect(names).toContain("cinematicQuality");
      expect(names).toContain("visualGrounding");
      expect(names).toContain("safety");
      expect(names).toContain("diversity");
    });

    it("has weights that sum to 1.0", () => {
      const totalWeight = VIDEO_RUBRIC.criteria.reduce(
        (sum, c) => sum + c.weight,
        0,
      );
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });

    it("each criterion has required fields", () => {
      for (const criterion of VIDEO_RUBRIC.criteria) {
        expect(criterion.name).toBeTruthy();
        expect(criterion.weight).toBeGreaterThan(0);
        expect(criterion.scale).toBe("1-5");
        expect(criterion.description).toBeTruthy();
        expect(criterion.examples.high).toBeTruthy();
        expect(criterion.examples.low).toBeTruthy();
        expect(criterion.questions.length).toBeGreaterThan(0);
      }
    });
  });

  describe("GENERAL_RUBRIC", () => {
    it("has required criteria: coherence, specificity, usefulness, diversity", () => {
      const names = GENERAL_RUBRIC.criteria.map((c) => c.name);
      expect(names).toContain("coherence");
      expect(names).toContain("specificity");
      expect(names).toContain("usefulness");
      expect(names).toContain("diversity");
    });

    it("has weights that sum to 1.0", () => {
      const totalWeight = GENERAL_RUBRIC.criteria.reduce(
        (sum, c) => sum + c.weight,
        0,
      );
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });
  });

  describe("calculateTotalScore", () => {
    it("returns 100 for perfect scores on video rubric", () => {
      const scores = {
        cinematicQuality: 5,
        visualGrounding: 5,
        safety: 5,
        diversity: 5,
      };
      expect(calculateTotalScore(scores, VIDEO_RUBRIC)).toBe(100);
    });

    it("returns 20 for minimum scores on video rubric", () => {
      const scores = {
        cinematicQuality: 1,
        visualGrounding: 1,
        safety: 1,
        diversity: 1,
      };
      expect(calculateTotalScore(scores, VIDEO_RUBRIC)).toBe(20);
    });

    it("returns 0 when all scores are missing", () => {
      expect(calculateTotalScore({}, VIDEO_RUBRIC)).toBe(0);
    });

    it("weights scores correctly for video rubric", () => {
      // cinematicQuality: 5 × 0.30 = 30 (normalized: 100 × 0.30 = 30)
      // visualGrounding: 1 × 0.30 = (normalized: 20 × 0.30 = 6)
      // safety: 1 × 0.20 = (normalized: 20 × 0.20 = 4)
      // diversity: 1 × 0.20 = (normalized: 20 × 0.20 = 4)
      // Total = 30 + 6 + 4 + 4 = 44
      const scores = {
        cinematicQuality: 5,
        visualGrounding: 1,
        safety: 1,
        diversity: 1,
      };
      expect(calculateTotalScore(scores, VIDEO_RUBRIC)).toBe(44);
    });

    it("returns rounded integer score", () => {
      const scores = {
        coherence: 3,
        specificity: 4,
        usefulness: 3,
        diversity: 4,
      };
      const result = calculateTotalScore(scores, GENERAL_RUBRIC);
      expect(Number.isInteger(result)).toBe(true);
    });
  });
});
