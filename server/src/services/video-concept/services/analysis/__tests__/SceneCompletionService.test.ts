import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIService } from "@services/prompt-optimization/types";
import { StructuredOutputEnforcer } from "@utils/StructuredOutputEnforcer";
import { SceneCompletionService } from "../SceneCompletionService";

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
  service: SceneCompletionService;
  aiService: AIService;
} => {
  const aiService = {
    execute: vi.fn(),
  } as unknown as AIService;

  return {
    service: new SceneCompletionService(aiService),
    aiService,
  };
};

describe("SceneCompletionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("short-circuits when no empty elements exist", async () => {
    const { service } = createService();
    const enforceSpy = vi.spyOn(StructuredOutputEnforcer, "enforceJSON");

    const existingElements = {
      subject: "a cat",
      action: "sleeping",
      location: "sunny windowsill",
    };

    const result = await service.completeScene({
      existingElements,
      concept: "peaceful afternoon",
    });

    expect(result.suggestions).toEqual(existingElements);
    expect(enforceSpy).not.toHaveBeenCalled();
  });

  it("fills empty elements with LLM suggestions", async () => {
    const { service } = createService();
    const llmSuggestions = {
      mood: "cozy and tranquil",
      style: "warm documentary",
    };
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockResolvedValue(
      llmSuggestions,
    );

    const existingElements = {
      subject: "a cat",
      action: "sleeping",
      mood: "",
      style: "",
    };

    const result = await service.completeScene({
      existingElements,
      concept: "peaceful afternoon",
    });

    expect(result.suggestions).toEqual({
      subject: "a cat",
      action: "sleeping",
      mood: "cozy and tranquil",
      style: "warm documentary",
    });
  });

  it("returns existing elements unchanged on LLM failure", async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockRejectedValue(
      new Error("timeout"),
    );

    const existingElements = {
      subject: "a cat",
      mood: "",
    };

    const result = await service.completeScene({
      existingElements,
      concept: "test",
    });

    expect(result.suggestions).toEqual(existingElements);
  });
});
