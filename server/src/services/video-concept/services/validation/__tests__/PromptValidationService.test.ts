import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIService } from "@services/prompt-optimization/types";
import { StructuredOutputEnforcer } from "@utils/StructuredOutputEnforcer";
import { PromptValidationService } from "../PromptValidationService";

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
  service: PromptValidationService;
  aiService: AIService;
} => {
  const aiService = {
    execute: vi.fn(),
  } as unknown as AIService;

  return {
    service: new PromptValidationService(aiService),
    aiService,
  };
};

describe("PromptValidationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the structured validation result from the enforcer", async () => {
    const { service, aiService } = createService();
    const validation = {
      score: 88,
      breakdown: {
        completeness: 25,
        specificity: 22,
        coherence: 21,
        visualPotential: 20,
      },
      feedback: ["Add more camera specificity"],
      strengths: ["Strong visual mood"],
      weaknesses: ["Camera angle is vague"],
    };
    const enforceSpy = vi
      .spyOn(StructuredOutputEnforcer, "enforceJSON")
      .mockResolvedValue(validation);

    const result = await service.validatePrompt({
      concept: "Runner in neon rain",
      elements: {
        subject: "runner",
        environment: "neon alley",
      },
    });

    expect(result).toEqual(validation);
    expect(enforceSpy).toHaveBeenCalledWith(
      aiService,
      expect.stringContaining("Concept: Runner in neon rain"),
      expect.objectContaining({
        operation: "video_prompt_validation",
      }),
    );
  });

  it("returns the deterministic fallback when validation fails", async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockRejectedValue(
      new Error("schema mismatch"),
    );

    const result = await service.validatePrompt({
      elements: {
        subject: "runner",
      },
    });

    expect(result).toEqual({
      score: 50,
      breakdown: {
        completeness: 0,
        specificity: 0,
        coherence: 0,
        visualPotential: 0,
      },
      feedback: ["Unable to validate"],
      strengths: [],
      weaknesses: [],
    });
  });

  it("returns no smart defaults when there are no existing dependencies", async () => {
    const { service } = createService();
    const enforceSpy = vi.spyOn(StructuredOutputEnforcer, "enforceJSON");

    const result = await service.getSmartDefaults({
      elementType: "camera",
      existingElements: {
        subject: "",
        environment: "",
      },
    });

    expect(result).toEqual({ defaults: [] });
    expect(enforceSpy).not.toHaveBeenCalled();
  });

  it("returns smart defaults from the enforcer when dependencies exist", async () => {
    const { service, aiService } = createService();
    const defaults = ["wide shot", "medium shot", "tracking shot"];
    const enforceSpy = vi
      .spyOn(StructuredOutputEnforcer, "enforceJSON")
      .mockResolvedValue(defaults);

    const result = await service.getSmartDefaults({
      elementType: "camera",
      existingElements: {
        subject: "runner",
        environment: "neon alley",
      },
    });

    expect(result).toEqual({ defaults });
    expect(enforceSpy).toHaveBeenCalledWith(
      aiService,
      expect.stringContaining("Suggest smart default values for camera"),
      expect.objectContaining({
        operation: "video_smart_defaults",
        isArray: true,
      }),
    );
  });

  it("returns an empty default list when smart default generation fails", async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockRejectedValue(
      new Error("provider unavailable"),
    );

    const result = await service.getSmartDefaults({
      elementType: "lighting",
      existingElements: {
        subject: "runner",
      },
    });

    expect(result).toEqual({ defaults: [] });
  });
});
