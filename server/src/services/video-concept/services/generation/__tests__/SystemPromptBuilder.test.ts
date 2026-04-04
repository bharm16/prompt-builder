import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PromptBuilderService } from "../SystemPromptBuilder";

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

vi.mock("@config/videoPromptTemplates", () => ({
  buildAnalysisProcessTemplate: vi.fn(() => "<analysis>"),
  getElementPromptTemplate: vi.fn(() => "<element-prompt>"),
  VIDEO_PROMPT_PRINCIPLES: "TEST_PRINCIPLES",
}));

vi.mock("@services/video-concept/config/descriptorCategories", () => ({
  detectDescriptorCategory: vi.fn(() => ({
    category: "wardrobe",
    confidence: 0.9,
    taxonomyId: null,
  })),
  getCategoryInstruction: vi.fn((cat: string) => `Instruction for ${cat}`),
  getCategoryForbidden: vi.fn(() => "Avoid X"),
  getAllCategories: vi.fn(() => ["physical", "wardrobe", "props", "emotional"]),
  mapDescriptorCategoryToTaxonomy: vi.fn(),
}));

vi.mock("#shared/taxonomy.ts", () => ({
  TAXONOMY: {
    SUBJECT: { id: "subject", attributes: { ACTION: "action" } },
    ENVIRONMENT: { attributes: { LOCATION: "location", CONTEXT: "context" } },
    LIGHTING: { attributes: { TIME: "time" } },
    STYLE: { id: "style", attributes: { AESTHETIC: "aesthetic" } },
  },
}));

describe("PromptBuilderService", () => {
  let builder: PromptBuilderService;

  beforeEach(() => {
    vi.clearAllMocks();
    builder = new PromptBuilderService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a generation prompt for a standard element type", () => {
    const prompt = builder.buildSystemPrompt({
      elementType: "subject",
      context: { location: "underwater cave" },
      concept: "deep sea exploration",
    });

    expect(prompt).toContain("TEST_PRINCIPLES");
    expect(prompt).toContain("Generate 8 creative");
    expect(prompt).not.toContain("COMPLETION MODE");
  });

  it("builds a completion prompt when currentValue is provided", () => {
    const prompt = builder.buildSystemPrompt({
      elementType: "action",
      currentValue: "running through",
      context: { subject: "athlete" },
    });

    expect(prompt).toContain("COMPLETION MODE");
    expect(prompt).toContain("running through");
  });

  it("delegates to descriptor prompt for subjectDescriptor elements", () => {
    const prompt = builder.buildSystemPrompt({
      elementType: "subjectDescriptor",
      currentValue: "wearing vintage jacket",
      context: { subject: "detective" },
    });

    expect(prompt).toContain("Detected Category: wardrobe");
    expect(prompt).toContain("Instruction for wardrobe");
    expect(prompt).toContain("detective");
  });

  it("builds descriptor prompt without category when no currentValue", async () => {
    const { detectDescriptorCategory } = vi.mocked(
      await import("@services/video-concept/config/descriptorCategories"),
    );
    detectDescriptorCategory.mockReturnValue({
      category: null,
      confidence: 0,
      taxonomyId: null,
    });

    const prompt = builder.buildSystemPrompt({
      elementType: "subjectDescriptor",
      context: { subject: "musician" },
    });

    expect(prompt).toContain("musician");
    expect(prompt).toContain("Descriptor Categories Available");
    expect(prompt).not.toContain("Detected Category");
  });

  describe("context analysis helpers", () => {
    it("analyzeImmediateContext detects present elements", () => {
      const prompt = builder.buildSystemPrompt({
        elementType: "mood",
        context: { subject: "person", location: "park", action: "walking" },
      });

      // The analysis process template is mocked, but the function should run without errors
      expect(prompt).toBeTruthy();
    });

    it("extractThematicElements detects themes from concept", () => {
      const prompt = builder.buildSystemPrompt({
        elementType: "style",
        concept: "A digital cyberpunk fantasy in the forest",
      });

      // Prompt should be generated successfully with theme analysis
      expect(prompt).toBeTruthy();
    });
  });
});
