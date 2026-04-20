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

  it("applies i2v pre-blocking before running the V2 engine", async () => {
    const { service } = createService({
      enhancementConfig: {
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
});
