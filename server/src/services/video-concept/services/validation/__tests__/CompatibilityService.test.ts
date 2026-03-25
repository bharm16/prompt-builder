import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CacheService } from "@services/cache/CacheService";
import type { AIService } from "@services/prompt-optimization/types";
import { StructuredOutputEnforcer } from "@utils/StructuredOutputEnforcer";
import { CompatibilityService } from "../CompatibilityService";

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

const createService = (): {
  service: CompatibilityService;
  aiService: { execute: ReturnType<typeof vi.fn> };
} => {
  const aiService = {
    execute: vi.fn(),
  };

  const cacheService = {} as CacheService;

  return {
    service: new CompatibilityService(
      aiService as unknown as AIService,
      cacheService,
    ),
    aiService,
  };
};

describe("CompatibilityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("caches semantic compatibility scores by suggestion and context", async () => {
    const { service, aiService } = createService();
    aiService.execute.mockResolvedValue({
      text: "0.81",
      metadata: {},
    });

    const suggestion = {
      text: "low tracking shot",
      explanation: "Keeps the movement grounded",
    };
    const existingElements = {
      subject: "runner",
      environment: "city street",
    };

    const first = await service.scoreSemanticCompatibility(
      suggestion,
      existingElements,
    );
    const second = await service.scoreSemanticCompatibility(
      suggestion,
      existingElements,
    );

    expect(first).toBe(0.81);
    expect(second).toBe(0.81);
    expect(aiService.execute).toHaveBeenCalledTimes(1);
  });

  it("clamps parsed scores and falls back to neutral for invalid numbers", async () => {
    const { service, aiService } = createService();
    aiService.execute
      .mockResolvedValueOnce({ text: "1.7", metadata: {} })
      .mockResolvedValueOnce({ text: "-0.2", metadata: {} })
      .mockResolvedValueOnce({ text: "not-a-number", metadata: {} });

    await expect(
      service.scoreSemanticCompatibility(
        { text: "option-a", explanation: "first" },
        { subject: "runner" },
      ),
    ).resolves.toBe(1);
    await expect(
      service.scoreSemanticCompatibility(
        { text: "option-b", explanation: "second" },
        { subject: "runner" },
      ),
    ).resolves.toBe(0);
    await expect(
      service.scoreSemanticCompatibility(
        { text: "option-c", explanation: "third" },
        { subject: "runner" },
      ),
    ).resolves.toBe(0.5);
  });

  it("returns a neutral score when semantic scoring throws", async () => {
    const { service, aiService } = createService();
    aiService.execute.mockRejectedValue(new Error("provider timeout"));

    const score = await service.scoreSemanticCompatibility(
      { text: "option-a", explanation: "first" },
      { subject: "runner" },
    );

    expect(score).toBe(0.5);
  });

  it("filters suggestions by the hardcoded 0.6 threshold when at least four survive", async () => {
    const { service } = createService();
    const scoreSpy = vi
      .spyOn(service, "scoreSemanticCompatibility")
      .mockImplementation(async (suggestion) => {
        const scores: Record<string, number> = {
          a: 0.61,
          b: 0.95,
          c: 0.8,
          d: 0.6,
          e: 0.2,
        };

        return scores[suggestion.text] ?? 0;
      });

    const result = await service.filterBySemanticCompatibility(
      [
        { text: "a", explanation: "a" },
        { text: "b", explanation: "b" },
        { text: "c", explanation: "c" },
        { text: "d", explanation: "d" },
        { text: "e", explanation: "e" },
      ],
      {
        elementType: "camera",
        context: { subject: "runner" },
      },
    );

    expect(result.map((suggestion) => suggestion.text)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(scoreSpy).toHaveBeenCalledTimes(5);
  });

  it("falls back to the top 8 scores when fewer than four suggestions survive filtering", async () => {
    const { service } = createService();
    vi.spyOn(service, "scoreSemanticCompatibility").mockImplementation(
      async (suggestion) => {
        const scores: Record<string, number> = {
          a: 0.9,
          b: 0.58,
          c: 0.57,
          d: 0.56,
          e: 0.55,
          f: 0.54,
          g: 0.53,
          h: 0.52,
          i: 0.51,
          j: 0.1,
        };

        return scores[suggestion.text] ?? 0;
      },
    );

    const suggestions = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(
      (text) => ({
        text,
        explanation: text,
      }),
    );

    const result = await service.filterBySemanticCompatibility(suggestions, {
      elementType: "camera",
      context: { subject: "runner" },
    });

    expect(result).toHaveLength(8);
    expect(result.map((suggestion) => suggestion.text)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ]);
  });

  it("short-circuits compatibility checks when the value or existing elements are missing", async () => {
    const { service } = createService();
    const enforceSpy = vi.spyOn(StructuredOutputEnforcer, "enforceJSON");

    await expect(
      service.checkCompatibility({
        elementType: "camera",
        value: "",
        existingElements: { subject: "runner" },
      }),
    ).resolves.toEqual({ score: 1, feedback: "No conflicts detected" });

    await expect(
      service.checkCompatibility({
        elementType: "camera",
        value: "low angle",
        existingElements: {},
      }),
    ).resolves.toEqual({ score: 1, feedback: "No conflicts detected" });

    expect(enforceSpy).not.toHaveBeenCalled();
  });

  it("returns structured compatibility results from the enforcer", async () => {
    const { service, aiService } = createService();
    const enforceSpy = vi
      .spyOn(StructuredOutputEnforcer, "enforceJSON")
      .mockResolvedValue({
        score: 0.4,
        feedback: "The angle clashes with the subject pose",
        conflicts: ["camera angle mismatch"],
        suggestions: ["Use a tracking shot instead"],
      });

    const result = await service.checkCompatibility({
      elementType: "camera",
      value: "extreme overhead shot",
      existingElements: {
        subject: "runner",
        environment: "neon alley",
      },
    });

    expect(result).toEqual({
      score: 0.4,
      feedback: "The angle clashes with the subject pose",
      conflicts: ["camera angle mismatch"],
      suggestions: ["Use a tracking shot instead"],
    });
    expect(enforceSpy).toHaveBeenCalledWith(
      aiService,
      expect.stringContaining('New Element: camera = "extreme overhead shot"'),
      expect.objectContaining({
        operation: "video_compatibility_check",
      }),
    );
  });

  it("returns the deterministic fallback when compatibility checks fail", async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockRejectedValue(
      new Error("schema mismatch"),
    );

    const result = await service.checkCompatibility({
      elementType: "camera",
      value: "overhead shot",
      existingElements: {
        subject: "runner",
      },
    });

    expect(result).toEqual({
      score: 0.5,
      feedback: "Unable to determine compatibility",
    });
  });
});
