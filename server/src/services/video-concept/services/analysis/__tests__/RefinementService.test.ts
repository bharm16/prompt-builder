import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIService } from "@services/prompt-optimization/types";
import { StructuredOutputEnforcer } from "@utils/StructuredOutputEnforcer";
import { RefinementService } from "../RefinementService";

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
  service: RefinementService;
  aiService: AIService;
} => {
  const aiService = {
    execute: vi.fn(),
  } as unknown as AIService;

  return {
    service: new RefinementService(aiService),
    aiService,
  };
};

describe("RefinementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("short-circuits when fewer than 2 elements are filled", async () => {
    const { service } = createService();
    const enforceSpy = vi.spyOn(StructuredOutputEnforcer, "enforceJSON");

    const result = await service.getRefinementSuggestions({
      elements: { subject: "a cat", action: "" },
    });

    expect(result.refinements).toEqual({});
    expect(enforceSpy).not.toHaveBeenCalled();
  });

  it("generates refinements when 2+ elements are filled", async () => {
    const { service } = createService();
    const mockRefinements = {
      subject: ["a sleek tabby cat", "a curious orange kitten"],
      action: ["stretching lazily", "pouncing playfully"],
    };
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockResolvedValue(
      mockRefinements,
    );

    const result = await service.getRefinementSuggestions({
      elements: { subject: "a cat", action: "playing", mood: "" },
    });

    expect(result.refinements).toEqual(mockRefinements);
    expect(StructuredOutputEnforcer.enforceJSON).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("subject: a cat"),
      expect.objectContaining({ operation: "video_refinements" }),
    );
  });

  it("returns empty refinements on LLM failure", async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockRejectedValue(
      new Error("parse error"),
    );

    const result = await service.getRefinementSuggestions({
      elements: { subject: "a cat", action: "playing" },
    });

    expect(result.refinements).toEqual({});
  });
});
