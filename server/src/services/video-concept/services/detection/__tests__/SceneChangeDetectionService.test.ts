import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIService } from "@services/prompt-optimization/types";
import type { CacheService } from "@services/cache/CacheService";
import { StructuredOutputEnforcer } from "@utils/StructuredOutputEnforcer";
import {
  SceneChangeDetectionService,
  type SceneChangeResult,
} from "../SceneChangeDetectionService";

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

vi.mock("@utils/TemperatureOptimizer", () => ({
  TemperatureOptimizer: {
    getOptimalTemperature: vi.fn(() => 0.3),
  },
}));

const createService = (): {
  service: SceneChangeDetectionService;
  aiService: AIService;
  cacheService: CacheService;
} => {
  const aiService = {
    execute: vi.fn(),
  } as unknown as AIService;

  const cacheService = {
    getConfig: vi.fn(() => ({ ttl: 300, namespace: "scene-detection" })),
    generateKey: vi.fn(() => "test-cache-key"),
    get: vi.fn(() => null),
    set: vi.fn(),
  } as unknown as CacheService;

  return {
    service: new SceneChangeDetectionService(aiService, cacheService),
    aiService,
    cacheService,
  };
};

describe("SceneChangeDetectionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns cached result on cache hit", async () => {
    const { service, cacheService } = createService();
    const cachedResult: SceneChangeResult = {
      isSceneChange: true,
      confidence: "high",
      reasoning: "Completely different environment",
      suggestedUpdates: { lighting: "underwater caustics" },
    };
    vi.mocked(cacheService.get).mockResolvedValue(cachedResult);

    const enforceSpy = vi.spyOn(StructuredOutputEnforcer, "enforceJSON");

    const result = await service.detectSceneChange({
      changedField: "location",
      newValue: "underwater cave",
      oldValue: "coffee shop",
      fullPrompt: "A barista making coffee",
      affectedFields: ["lighting", "mood"],
    });

    expect(result).toEqual(cachedResult);
    expect(enforceSpy).not.toHaveBeenCalled();
  });

  it("detects scene change via LLM and caches result", async () => {
    const { service, cacheService } = createService();
    const llmResult: SceneChangeResult = {
      isSceneChange: true,
      confidence: "high",
      reasoning: "Indoor to outdoor transition",
      suggestedUpdates: { lighting: "natural sunlight", mood: "open and free" },
    };
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockResolvedValue(
      llmResult,
    );

    const result = await service.detectSceneChange({
      changedField: "location",
      newValue: "mountain summit",
      oldValue: "office cubicle",
      fullPrompt: "A worker at their desk",
      affectedFields: ["lighting", "mood"],
    });

    expect(result).toEqual(llmResult);
    expect(cacheService.set).toHaveBeenCalledWith(
      "test-cache-key",
      llmResult,
      expect.objectContaining({ ttl: 300 }),
    );
  });

  it("calls enforceJSON with correct operation and schema", async () => {
    const { service } = createService();
    const enforceSpy = vi
      .spyOn(StructuredOutputEnforcer, "enforceJSON")
      .mockResolvedValue({
        isSceneChange: false,
        confidence: "low",
        reasoning: "Minor refinement",
        suggestedUpdates: {},
      });

    await service.detectSceneChange({
      changedField: "location",
      newValue: "vintage coffee shop",
      oldValue: "coffee shop",
      fullPrompt: "A barista making coffee",
      affectedFields: ["mood"],
    });

    expect(enforceSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("vintage coffee shop"),
      expect.objectContaining({
        operation: "video_scene_change_detection",
        schema: expect.objectContaining({
          type: "object",
          required: [
            "isSceneChange",
            "confidence",
            "reasoning",
            "suggestedUpdates",
          ],
        }),
      }),
    );
  });
});
