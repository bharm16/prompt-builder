import { beforeEach, describe, expect, it, vi } from "vitest";
import { FallbackRegenerationService } from "../FallbackRegenerationService";
import type { Suggestion, VideoService, AIService } from "../types";

const mockEnforceJSON = vi.hoisted(() => vi.fn());

vi.mock("@utils/StructuredOutputEnforcer", () => ({
  StructuredOutputEnforcer: {
    enforceJSON: mockEnforceJSON,
  },
}));

describe("FallbackRegenerationService regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attempts fallback regeneration even when isVideoPrompt is false if sanitized output is empty", async () => {
    mockEnforceJSON.mockResolvedValue([{ text: "gentle handheld drift" }]);

    const videoService = {
      getVideoFallbackConstraints: vi
        .fn()
        .mockReturnValueOnce({
          mode: "concise",
          minWords: 2,
          maxWords: 12,
          maxSentences: 1,
        })
        .mockReturnValueOnce(null),
    } as unknown as VideoService;

    const promptBuilder = {
      buildRewritePrompt: vi.fn(() => "rewrite prompt"),
    };

    const validationService = {
      sanitizeSuggestions: vi.fn((suggestions: Suggestion[]) => suggestions),
    };

    const diversityEnforcer = {
      ensureDiverseSuggestions: vi.fn(
        async (suggestions: Suggestion[]) => suggestions,
      ),
    };

    const service = new FallbackRegenerationService(
      videoService,
      promptBuilder,
      validationService,
      diversityEnforcer,
    );

    const result = await service.attemptFallbackRegeneration({
      sanitizedSuggestions: [],
      isVideoPrompt: false,
      isPlaceholder: false,
      regenerationDetails: {
        highlightWordCount: 2,
      },
      requestParams: {
        highlightedText: "close-up framing",
        contextBefore: "A baby sits quietly, ",
        contextAfter: ", as sunlight flickers.",
        fullPrompt:
          "A baby sits quietly, close-up framing, as sunlight flickers.",
        originalUserPrompt: "baby in car",
      },
      aiService: {} as AIService,
      schema: {
        type: "array",
        items: { required: ["text"] },
      },
      temperature: 0.6,
    });

    expect(promptBuilder.buildRewritePrompt).toHaveBeenCalledTimes(1);
    expect(result.usedFallback).toBe(true);
    expect(result.suggestions.map((item) => item.text)).toEqual([
      "gentle handheld drift",
    ]);
  });

  it("retries inside the same category family with sharper slot-form guidance before broad mode fallback", async () => {
    mockEnforceJSON
      .mockResolvedValueOnce([{ text: "soft background blur" }])
      .mockResolvedValueOnce([{ text: "low f-number" }]);

    const videoService = {
      getVideoFallbackConstraints: vi.fn().mockReturnValue(null),
    } as unknown as VideoService;

    const promptBuilder = {
      buildRewritePrompt: vi.fn(() => "rewrite prompt"),
    };

    const validationService = {
      sanitizeSuggestions: vi.fn(() => []),
      analyzeSuggestions: vi
        .fn()
        .mockReturnValueOnce({
          primary: [],
          deprioritized: [],
          rejected: [{ text: "soft background blur", reason: "slot_form" }],
        })
        .mockReturnValueOnce({
          primary: [{ text: "low f-number" }],
          deprioritized: [],
          rejected: [],
        }),
    };

    const diversityEnforcer = {
      ensureDiverseSuggestions: vi.fn(
        async (suggestions: Suggestion[]) => suggestions,
      ),
    };

    const service = new FallbackRegenerationService(
      videoService,
      promptBuilder,
      validationService,
      diversityEnforcer,
    );

    const result = await service.attemptFallbackRegeneration({
      sanitizedSuggestions: [],
      isVideoPrompt: true,
      isPlaceholder: false,
      videoConstraints: {
        mode: "phrase",
        minWords: 1,
        maxWords: 6,
      },
      regenerationDetails: {
        highlightWordCount: 2,
        highlightedCategory: "camera.lens",
      },
      requestParams: {
        highlightedText: "wide aperture",
        highlightedCategory: "camera.lens",
        fullPrompt:
          "The shallow depth of field, achieved with a wide aperture, renders the background in creamy bokeh.",
      },
      aiService: {} as AIService,
      schema: {
        type: "array",
        items: { required: ["text"] },
      },
      temperature: 0.2,
    });

    expect(result.suggestions.map((item) => item.text)).toEqual([
      "low f-number",
    ]);
    expect(promptBuilder.buildRewritePrompt).toHaveBeenCalledTimes(2);

    const calls = promptBuilder.buildRewritePrompt.mock
      .calls as unknown as Array<
      [{ videoConstraints: { mode?: string; extraRequirements?: string[] } }]
    >;
    const firstCall = calls[0]?.[0];
    const secondCall = calls[1]?.[0];
    expect(firstCall).toBeDefined();
    expect(secondCall).toBeDefined();
    expect(firstCall!.videoConstraints.mode).toBe("phrase");
    expect(secondCall!.videoConstraints.mode).toBe("phrase");
    expect(secondCall!.videoConstraints.extraRequirements).toEqual(
      expect.arrayContaining([
        expect.stringContaining("exact grammatical slot"),
      ]),
    );
    expect(videoService.getVideoFallbackConstraints).not.toHaveBeenCalled();
  });

  it("uses short-span in-category retries so empty blocking location spans can recover without falling back to micro", async () => {
    mockEnforceJSON
      .mockResolvedValueOnce([{ text: "sun-dappled autumn meadow" }])
      .mockResolvedValueOnce([{ text: "sunlit autumn meadow" }]);

    const videoService = {
      getVideoFallbackConstraints: vi.fn().mockReturnValue(null),
    } as unknown as VideoService;

    const promptBuilder = {
      buildRewritePrompt: vi.fn(() => "rewrite prompt"),
    };

    const validationService = {
      sanitizeSuggestions: vi.fn(() => []),
      analyzeSuggestions: vi
        .fn()
        .mockReturnValueOnce({
          primary: [],
          deprioritized: [],
          rejected: [
            { text: "sun-dappled autumn meadow", reason: "length_only" },
          ],
        })
        .mockReturnValueOnce({
          primary: [{ text: "sunlit autumn meadow" }],
          deprioritized: [],
          rejected: [],
        }),
    };

    const diversityEnforcer = {
      ensureDiverseSuggestions: vi.fn(
        async (suggestions: Suggestion[]) => suggestions,
      ),
    };

    const service = new FallbackRegenerationService(
      videoService,
      promptBuilder,
      validationService,
      diversityEnforcer,
    );

    const result = await service.attemptFallbackRegeneration({
      sanitizedSuggestions: [],
      isVideoPrompt: true,
      isPlaceholder: false,
      videoConstraints: {
        mode: "location",
        minWords: 6,
        maxWords: 9,
      },
      regenerationDetails: {
        highlightWordCount: 2,
        highlightedCategory: "environment.location",
      },
      requestParams: {
        highlightedText: "park view",
        highlightedCategory: "environment.location",
        fullPrompt:
          "with the soft blur of a park view visible through the car window",
      },
      aiService: {} as AIService,
      schema: {
        type: "array",
        items: { required: ["text"] },
      },
      temperature: 0.2,
    });

    expect(result.usedFallback).toBe(true);
    expect(result.suggestions.map((item) => item.text)).toEqual([
      "sunlit autumn meadow",
    ]);
    expect(promptBuilder.buildRewritePrompt).toHaveBeenCalledTimes(2);
    const calls = promptBuilder.buildRewritePrompt.mock
      .calls as unknown as Array<
      [{ videoConstraints: { mode?: string; maxWords?: number } }]
    >;
    expect(
      calls.every(([params]) => params.videoConstraints.mode === "location"),
    ).toBe(true);
    expect(
      calls.every(
        ([params]) =>
          (params.videoConstraints.maxWords ?? Number.POSITIVE_INFINITY) <= 5,
      ),
    ).toBe(true);
  });
});
