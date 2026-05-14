import { describe, expect, it, vi } from "vitest";
import { PolicyAwareSuggestionQualityEvaluator } from "../PolicyAwareSuggestionQualityEvaluator";
import { hardCaseBenchmarks } from "../__fixtures__/suggestionQualityHardCases";

function createEvaluator() {
  const videoPromptService = {
    isVideoPrompt: vi.fn(() => true),
    countWords: vi.fn(
      (text: string) => text.trim().split(/\s+/).filter(Boolean).length,
    ),
  };

  return new PolicyAwareSuggestionQualityEvaluator(
    videoPromptService as never,
    "2026-03-v2a",
  );
}

describe("PolicyAwareSuggestionQualityEvaluator", () => {
  it("scores hard cases using V2 policy rules rather than V1 validators", async () => {
    const evaluator = createEvaluator();

    for (const benchmark of hardCaseBenchmarks) {
      const result = await evaluator.evaluateCase(
        benchmark.testCase,
        benchmark.suggestions,
      );
      expect(result.id).toBe(benchmark.testCase.id);
      expect(result.scores.categoryAlignment).toBeGreaterThanOrEqual(3);
    }
  });

  it("fails low-quality suggestions on hard cases", async () => {
    const evaluator = createEvaluator();

    const result = await evaluator.evaluateCase(
      {
        id: "camera-movement-hard-fail",
        prompt:
          "A runner pushes through smoke while the camera follows tightly.",
        span: { text: "tracking", category: "camera.movement" },
        contextBefore: "A runner pushes through smoke while the camera ",
        contextAfter: " tightly.",
        expectedQualities: {
          contextualFit: { min: 4 },
          categoryAlignment: { min: 4 },
          sceneCoherence: { min: 4 },
        },
      },
      // Truthful self-declared categories that don't fit a camera.movement
      // slot: lens, lighting, and aesthetic. After the 2026-05-14 V2CandidateScorer
      // refactor (regex classification → structural taxonomy lookups via
      // candidate.category), the scorer trusts the LLM's self-classification.
      // These categories trigger family_miss / forbidden_family gates structurally.
      [
        { text: "50mm prime lens", category: "camera.lens" },
        { text: "soft backlight from the left", category: "lighting.source" },
        { text: "dreamlike memory haze", category: "style.aesthetic" },
      ],
    );

    expect(result.passed).toBe(false);
    expect(result.failures.join(" | ")).toMatch(
      /contextualFit|categoryAlignment|sceneCoherence/,
    );
  });
});
