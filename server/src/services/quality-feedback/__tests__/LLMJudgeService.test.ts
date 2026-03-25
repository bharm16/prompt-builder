import { beforeEach, describe, expect, it, vi } from "vitest";
import { LLMJudgeService } from "../services/LLMJudgeService";
import type { EvaluationContext } from "../types";

// Mock logger
vi.mock("@infrastructure/Logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

// Mock StructuredOutputEnforcer
vi.mock("@utils/StructuredOutputEnforcer", () => ({
  StructuredOutputEnforcer: {
    enforceJSON: vi.fn(),
  },
}));

import { StructuredOutputEnforcer } from "@utils/StructuredOutputEnforcer";

const mockEnforceJSON = vi.mocked(StructuredOutputEnforcer.enforceJSON);

function createMockAIService() {
  return {
    generateText: vi.fn(),
    generateJSON: vi.fn(),
    streamText: vi.fn(),
  } as unknown as ConstructorParameters<typeof LLMJudgeService>[0];
}

describe("LLMJudgeService", () => {
  let service: LLMJudgeService;
  let mockAI: ReturnType<typeof createMockAIService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAI = createMockAIService();
    service = new LLMJudgeService(mockAI);
  });

  describe("evaluateSuggestions", () => {
    const videoContext: EvaluationContext = {
      highlightedText: "a dramatic sunset",
      fullPrompt: "A dramatic sunset over the ocean with golden light",
      isVideoPrompt: true,
    };

    const generalContext: EvaluationContext = {
      highlightedText: "improving clarity",
      fullPrompt:
        "The report needs improving clarity in the methodology section",
      isVideoPrompt: false,
    };

    it("returns scored evaluation for video prompts", async () => {
      mockEnforceJSON.mockResolvedValue({
        rubricScores: {
          cinematicQuality: 4,
          visualGrounding: 5,
          safety: 5,
          diversity: 3,
        },
        feedback: ["Could improve diversity"],
        strengths: ["Strong visual grounding"],
        weaknesses: [],
      });

      const result = await service.evaluateSuggestions({
        suggestions: [
          { text: "golden hour backlight" },
          { text: "warm diffuse glow" },
        ],
        context: videoContext,
      });

      expect(result.rubricScores).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.metadata.rubricUsed).toBe("video_prompt_evaluation");
      expect(result.metadata.suggestionCount).toBe(2);
      expect(result.metadata.evaluationTime).toBeGreaterThanOrEqual(0);
    });

    it("returns scored evaluation for general text", async () => {
      mockEnforceJSON.mockResolvedValue({
        rubricScores: {
          coherence: 4,
          specificity: 3,
          usefulness: 4,
          diversity: 3,
        },
        feedback: ["Good clarity improvements"],
        strengths: ["Maintains context"],
        weaknesses: [],
      });

      const result = await service.evaluateSuggestions({
        suggestions: [{ text: "enhancing readability" }],
        context: generalContext,
      });

      expect(result.metadata.rubricUsed).toBe("general_text_evaluation");
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it("uses explicit rubricType when provided", async () => {
      mockEnforceJSON.mockResolvedValue({
        rubricScores: {
          cinematicQuality: 3,
          visualGrounding: 3,
          safety: 5,
          diversity: 3,
        },
        feedback: [],
        strengths: [],
        weaknesses: [],
      });

      const result = await service.evaluateSuggestions({
        suggestions: [{ text: "test" }],
        context: generalContext,
        rubricType: "video",
      });

      expect(result.metadata.rubricUsed).toBe("video_prompt_evaluation");
    });

    it("returns fallback evaluation when LLM call fails", async () => {
      mockEnforceJSON.mockRejectedValue(new Error("LLM unavailable"));

      const result = await service.evaluateSuggestions({
        suggestions: [{ text: "test" }],
        context: videoContext,
      });

      expect(result.overallScore).toBe(60);
      expect(result.metadata.suggestionCount).toBe(0);
      expect(result.metadata.evaluationTime).toBe(0);
      expect(result.rubricScores.cinematicQuality).toBe(3);
      expect(result.rubricScores.visualGrounding).toBe(3);
      expect(result.rubricScores.safety).toBe(3);
      expect(result.rubricScores.diversity).toBe(3);
    });

    it("handles suggestions without text field", async () => {
      mockEnforceJSON.mockResolvedValue({
        rubricScores: {
          cinematicQuality: 3,
          visualGrounding: 3,
          safety: 5,
          diversity: 2,
        },
        feedback: [],
        strengths: [],
        weaknesses: [],
      });

      const result = await service.evaluateSuggestions({
        suggestions: [{ value: "no text field" }],
        context: videoContext,
      });

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
    });
  });

  describe("evaluateSingleSuggestion", () => {
    it("delegates to evaluateSuggestions with single-item array", async () => {
      mockEnforceJSON.mockResolvedValue({
        rubricScores: {
          coherence: 4,
          specificity: 4,
          usefulness: 4,
          diversity: 3,
        },
        feedback: [],
        strengths: [],
        weaknesses: [],
      });

      const context: EvaluationContext = {
        highlightedText: "test",
        isVideoPrompt: false,
      };

      const result = await service.evaluateSingleSuggestion(
        "improved text",
        context,
      );

      expect(result.metadata.suggestionCount).toBe(1);
      expect(mockEnforceJSON).toHaveBeenCalledOnce();
    });
  });

  describe("batchEvaluate", () => {
    it("evaluates multiple suggestion sets sequentially", async () => {
      let callCount = 0;
      mockEnforceJSON.mockImplementation(async () => {
        callCount++;
        return {
          rubricScores: {
            coherence: callCount === 1 ? 5 : 3,
            specificity: 4,
            usefulness: 4,
            diversity: 3,
          },
          feedback: [],
          strengths: [],
          weaknesses: [],
        };
      });

      const context: EvaluationContext = {
        highlightedText: "test",
        isVideoPrompt: false,
      };

      const results = await service.batchEvaluate(
        [[{ text: "set1" }], [{ text: "set2" }]],
        context,
      );

      expect(results).toHaveLength(2);
      expect(mockEnforceJSON).toHaveBeenCalledTimes(2);
      expect(results[0]!.overallScore).toBeGreaterThan(
        results[1]!.overallScore,
      );
    });

    it("handles empty suggestion sets", async () => {
      mockEnforceJSON.mockResolvedValue({
        rubricScores: {
          coherence: 3,
          specificity: 3,
          usefulness: 3,
          diversity: 3,
        },
        feedback: [],
        strengths: [],
        weaknesses: [],
      });

      const context: EvaluationContext = { isVideoPrompt: false };

      const results = await service.batchEvaluate([[]], context);

      expect(results).toHaveLength(1);
    });
  });

  describe("compareSuggestionSets", () => {
    it("returns comparison with winner when scores differ", async () => {
      let callCount = 0;
      mockEnforceJSON.mockImplementation(async () => {
        callCount++;
        return {
          rubricScores: {
            coherence: callCount === 1 ? 5 : 2,
            specificity: callCount === 1 ? 4 : 2,
            usefulness: callCount === 1 ? 5 : 3,
            diversity: callCount === 1 ? 4 : 2,
          },
          feedback: [],
          strengths: [],
          weaknesses: [],
        };
      });

      const context: EvaluationContext = {
        highlightedText: "compare me",
        isVideoPrompt: false,
      };

      const comparison = await service.compareSuggestionSets(
        [{ text: "better option" }],
        [{ text: "worse option" }],
        context,
      );

      expect(comparison.winner).toBe("A");
      expect(comparison.scoreDifference).toBeGreaterThan(0);
      expect(comparison.setA.overallScore).toBeGreaterThan(
        comparison.setB.overallScore,
      );
      expect(comparison.criteriaComparison).toBeDefined();
      expect(Object.keys(comparison.criteriaComparison)).toHaveLength(4);
    });

    it("returns TIE when scores are equal", async () => {
      mockEnforceJSON.mockResolvedValue({
        rubricScores: {
          coherence: 4,
          specificity: 4,
          usefulness: 4,
          diversity: 4,
        },
        feedback: [],
        strengths: [],
        weaknesses: [],
      });

      const context: EvaluationContext = { isVideoPrompt: false };

      const comparison = await service.compareSuggestionSets(
        [{ text: "a" }],
        [{ text: "b" }],
        context,
      );

      expect(comparison.winner).toBe("TIE");
      expect(comparison.scoreDifference).toBe(0);
    });
  });
});
