import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnhancementService } from "../EnhancementService";
import type {
  AIService,
  BrainstormBuilder,
  CategoryAligner,
  DiversityEnforcer,
  PromptBuilder,
  ValidationService,
  VideoService,
  Suggestion,
} from "../services/types";

const mockEnforceJSON = vi.hoisted(() => vi.fn());
const mockCacheGet = vi.hoisted(() => vi.fn(async () => null));
const mockCacheSet = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@utils/StructuredOutputEnforcer", () => ({
  StructuredOutputEnforcer: {
    enforceJSON: mockEnforceJSON,
  },
}));

function createService(options?: {
  enhancementConfig?: {
    defaultEngine: "v1" | "v2";
    legacyV1Enabled: boolean;
    policyVersion: string;
  };
}) {
  const aiService = {
    getOperationConfig: vi.fn(() => ({
      temperature: 0.6,
      client: "groq",
      model: "llama-3.1-8b-instant",
    })),
    execute: vi.fn(),
  } as unknown as AIService;

  const videoPromptService = {
    isVideoPrompt: vi.fn(() => true),
    countWords: vi.fn(
      (text: string) => text.trim().split(/\s+/).filter(Boolean).length,
    ),
    detectVideoPhraseRole: vi.fn(() => "camera.movement"),
    getVideoReplacementConstraints: vi.fn(() => ({
      minWords: 2,
      maxWords: 12,
      maxSentences: 1,
      mode: "concise",
    })),
    detectTargetModel: vi.fn(() => "sora-2"),
    detectPromptSection: vi.fn(() => "main"),
    getCategoryFocusGuidance: vi.fn(() => [
      "Preserve subject continuity",
      "Avoid lighting changes",
    ]),
    getVideoFallbackConstraints: vi.fn(() => null),
  } as unknown as VideoService;

  const brainstormBuilder = {
    buildBrainstormSignature: vi.fn(() => null),
  } as unknown as BrainstormBuilder;

  const promptBuilder = {
    buildPlaceholderPrompt: vi.fn(() => "placeholder prompt"),
    buildRewritePrompt: vi.fn(() => "rewrite prompt"),
    buildCustomPrompt: vi.fn(() => "custom prompt"),
  } as unknown as PromptBuilder;

  const validationService = {
    sanitizeSuggestions: vi.fn(
      (
        suggestions: Suggestion[] | string[],
        context: {
          highlightedText?: string;
          highlightedCategory?: string | null;
        },
      ) => {
        const seen = new Set<string>();
        const normalizedHighlight = (context.highlightedText || "")
          .trim()
          .toLowerCase();
        const expectedCategory = context.highlightedCategory
          ?.trim()
          .toLowerCase();

        return (suggestions as Suggestion[])
          .filter((item) => item && typeof item.text === "string")
          .filter((item) => {
            if (!expectedCategory || typeof item.category !== "string") {
              return true;
            }
            return item.category.trim().toLowerCase() === expectedCategory;
          })
          .filter(
            (item) => item.text.trim().toLowerCase() !== normalizedHighlight,
          )
          .filter((item) => {
            const key = item.text.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      },
    ),
    groupSuggestionsByCategory: vi.fn((suggestions: Suggestion[]) => [
      { category: "camera.movement", suggestions },
    ]),
    validateSuggestions: vi.fn((suggestions: Suggestion[]) => suggestions),
  } as unknown as ValidationService;

  const diversityEnforcer = {
    ensureDiverseSuggestions: vi.fn(
      async (suggestions: Suggestion[]) => suggestions,
    ),
    filterOriginalEchoes: vi.fn((suggestions: Suggestion[]) => suggestions),
  } as unknown as DiversityEnforcer;

  const categoryAligner = {
    enforceCategoryAlignment: vi.fn(
      (
        suggestions: Suggestion[],
        params: { highlightedCategory?: string },
      ) => ({
        suggestions: suggestions.map((item) => ({
          ...item,
          category: params.highlightedCategory || item.category,
        })),
        fallbackApplied: false,
        context: {
          baseCategory: params.highlightedCategory,
        },
      }),
    ),
  } as unknown as CategoryAligner;

  const cacheService = {
    getConfig: vi.fn(() => ({ ttl: 60, namespace: "enhancement" })),
    get: mockCacheGet,
    set: mockCacheSet,
    generateKey: vi.fn(() => "custom-key"),
  } as any;

  const service = new EnhancementService({
    aiService,
    videoPromptService,
    brainstormBuilder,
    promptBuilder,
    validationService,
    diversityEnforcer,
    categoryAligner,
    metricsService: null,
    cacheService,
    enhancementConfig: options?.enhancementConfig ?? {
      defaultEngine: "v1",
      legacyV1Enabled: true,
      policyVersion: "2026-03-v2a",
    },
  });

  return {
    service,
    promptBuilder,
    categoryAligner,
    validationService,
  };
}

describe("EnhancementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceJSON.mockResolvedValue([
      { text: "tracking shot", category: "lighting.quality" },
      { text: "Dolly in toward subject", category: "camera.movement" },
      { text: "Dolly in toward subject", category: "camera.movement" },
      { text: "Crane reveal over crowd", category: "camera.movement" },
      { text: "Handheld push through smoke", category: "camera.movement" },
      { text: "Locked-off wide master", category: "camera.framing" },
    ]);
  });

  it("keeps suggestions in highlighted taxonomy category and removes original + duplicates", async () => {
    const { service, categoryAligner } = createService();

    const result = await service.getEnhancementSuggestions({
      highlightedText: "tracking shot",
      contextBefore: "A cinematic runner in rain, ",
      contextAfter: ", at night.",
      fullPrompt: "A cinematic runner in rain, tracking shot, at night.",
      originalUserPrompt: "runner in rain",
      highlightedCategory: "camera.movement",
      highlightedCategoryConfidence: 0.92,
      allLabeledSpans: [],
      nearbySpans: [],
      editHistory: [],
    });

    expect(categoryAligner.enforceCategoryAlignment).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        highlightedCategory: "camera.movement",
      }),
    );

    const flatSuggestions = result.suggestions as Suggestion[];
    const suggestionTexts = flatSuggestions.map((item) => item.text);
    expect(suggestionTexts).not.toContain("tracking shot");
    expect(new Set(suggestionTexts).size).toBe(suggestionTexts.length);
    expect(suggestionTexts.length).toBeGreaterThan(1);
    for (const suggestion of flatSuggestions) {
      expect(suggestion.category).toBe("camera.movement");
    }
  });

  it("propagates span-context inputs to rewrite prompt generation", async () => {
    const { service, promptBuilder, validationService } = createService();

    await service.getEnhancementSuggestions({
      highlightedText: "tracking shot",
      contextBefore: "A cinematic runner in rain, ",
      contextAfter: ", at night.",
      fullPrompt: "A cinematic runner in rain, tracking shot, at night.",
      originalUserPrompt: "runner in rain",
      highlightedCategory: "camera.movement",
      highlightedCategoryConfidence: 0.95,
      allLabeledSpans: [
        {
          text: "runner",
          role: "subject",
          category: "subject.identity",
          confidence: 0.9,
        },
        {
          text: "neon rain",
          role: "lighting",
          category: "lighting.quality",
          confidence: 0.88,
        },
      ],
      nearbySpans: [
        {
          text: "midnight street",
          role: "location",
          category: "location.setting",
          distance: 8,
          position: "after",
          confidence: 0.7,
        },
      ],
      editHistory: [
        {
          original: "wide shot",
          replacement: "tracking shot",
          category: "camera.movement",
          timestamp: 1739300000,
        },
      ],
    });

    expect(promptBuilder.buildRewritePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        spanAnchors: expect.stringContaining("subject"),
        nearbySpanHints: expect.stringContaining("location"),
        focusGuidance: expect.arrayContaining(["Preserve subject continuity"]),
      }),
    );

    expect(validationService.sanitizeSuggestions).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        highlightedText: "tracking shot",
        highlightedCategory: "camera.movement",
        isVideoPrompt: true,
      }),
    );
  });

  it("fails closed and regenerates when category-invalid suggestions are fully sanitized away", async () => {
    const { service, validationService } = createService();

    mockEnforceJSON
      .mockResolvedValueOnce([
        {
          text: "amber backlight casting soft halos",
          category: "lighting.timeOfDay",
        },
        { text: "warm backlight with flare", category: "lighting.timeOfDay" },
      ])
      .mockResolvedValueOnce([
        { text: "misty blue hour", category: "lighting.timeOfDay" },
        { text: "late afternoon haze", category: "lighting.timeOfDay" },
        { text: "cool dusk glow", category: "lighting.timeOfDay" },
      ]);

    validationService.sanitizeSuggestions = vi.fn(
      (
        suggestions: Suggestion[] | string[],
        context: { highlightedCategory?: string | null },
      ) => {
        const items = suggestions as Suggestion[];
        if (context.highlightedCategory === "lighting.timeOfDay") {
          return items.filter((item) =>
            /\b(blue hour|afternoon|dusk)\b/i.test(item.text),
          );
        }
        return items;
      },
    );

    const result = await service.getEnhancementSuggestions({
      highlightedText: "golden hour sunlight",
      contextBefore: "Warm, ",
      contextAfter: " streams through the car windows.",
      fullPrompt: "Warm, golden hour sunlight streams through the car windows.",
      originalUserPrompt: "golden hour toddler in car",
      highlightedCategory: "lighting.timeOfDay",
      highlightedCategoryConfidence: 0.95,
      allLabeledSpans: [],
      nearbySpans: [],
      editHistory: [],
    });

    expect(mockEnforceJSON.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(
      (result.suggestions as Suggestion[]).map((item) => item.text),
    ).toEqual(["misty blue hour", "late afternoon haze", "cool dusk glow"]);
  });

  it("applies i2v pre-blocking before running the V2 engine", async () => {
    const { service } = createService({
      enhancementConfig: {
        defaultEngine: "v2",
        legacyV1Enabled: false,
        policyVersion: "2026-03-v2a",
      },
    });

    const result = await service.getEnhancementSuggestions({
      highlightedText: "tracking",
      contextBefore: "A runner moves through smoke, ",
      contextAfter: ", under neon lights.",
      fullPrompt: "A runner moves through smoke, tracking, under neon lights.",
      originalUserPrompt: "runner through smoke",
      highlightedCategory: "camera.movement",
      highlightedCategoryConfidence: 0.95,
      requestedEngineVersion: "v2",
      i2vContext: {
        lockMap: {
          "camera.movement": "hard",
        } as never,
        observation: {
          subject: { description: "runner" },
          framing: { shotType: "medium shot", angle: "eye-level" },
          lighting: { quality: "soft", timeOfDay: "dusk" },
          motion: { recommended: ["pan-left"], risky: [] },
        } as never,
      },
      allLabeledSpans: [],
      nearbySpans: [],
      editHistory: [],
    });

    expect(result.suggestions).toEqual([]);
    expect(result.metadata?.i2v).toBeDefined();
  });

  it("applies the shared i2v post-filter after V2 generation", async () => {
    const { service } = createService({
      enhancementConfig: {
        defaultEngine: "v2",
        legacyV1Enabled: false,
        policyVersion: "2026-03-v2a",
      },
    });

    const result = await service.getEnhancementSuggestions({
      highlightedText: "tracking",
      contextBefore: "A runner moves through smoke, ",
      contextAfter: ", under neon lights.",
      fullPrompt: "A runner moves through smoke, tracking, under neon lights.",
      originalUserPrompt: "runner through smoke",
      highlightedCategory: "camera.movement",
      highlightedCategoryConfidence: 0.95,
      requestedEngineVersion: "v2",
      debug: true,
      i2vContext: {
        lockMap: {} as never,
        observation: {
          subject: { description: "runner" },
          framing: { shotType: "medium shot", angle: "eye-level" },
          lighting: { quality: "soft", timeOfDay: "dusk" },
          motion: { recommended: ["pan-left"], risky: ["pan"] },
        } as never,
      },
      allLabeledSpans: [],
      nearbySpans: [],
      editHistory: [],
    });

    const flatSuggestions = result.suggestions as Suggestion[];
    expect(flatSuggestions.length).toBeGreaterThan(0);
    expect(flatSuggestions.some((item) => /\bpan\b/i.test(item.text))).toBe(
      false,
    );
    expect(result._debug?.engineVersion).toBe("v2");
  });

  it("defaults to V2 and ignores requested V1 when legacy mode is disabled", async () => {
    const { service, promptBuilder } = createService({
      enhancementConfig: {
        defaultEngine: "v2",
        legacyV1Enabled: false,
        policyVersion: "2026-03-v2a",
      },
    });

    const result = await service.getEnhancementSuggestions({
      highlightedText: "tracking",
      contextBefore: "A runner moves through smoke, ",
      contextAfter: ", under neon lights.",
      fullPrompt: "A runner moves through smoke, tracking, under neon lights.",
      originalUserPrompt: "runner through smoke",
      highlightedCategory: "camera.movement",
      highlightedCategoryConfidence: 0.95,
      requestedEngineVersion: "v1",
      debug: true,
      allLabeledSpans: [],
      nearbySpans: [],
      editHistory: [],
    });

    expect(promptBuilder.buildRewritePrompt).not.toHaveBeenCalled();
    expect(result._debug?.engineVersion).toBe("v2");
  });
});
