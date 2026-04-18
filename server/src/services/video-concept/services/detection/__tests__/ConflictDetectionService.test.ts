import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIExecutionPort as AIService } from "@services/ai-model/ports/AIExecutionPort";
import { StructuredOutputEnforcer } from "@utils/StructuredOutputEnforcer";
import {
  ConflictDetectionService,
  type Conflict,
} from "../ConflictDetectionService";

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
  service: ConflictDetectionService;
  aiService: AIService;
} => {
  const aiService = {
    execute: vi.fn(),
  } as unknown as AIService;

  return {
    service: new ConflictDetectionService(aiService),
    aiService,
  };
};

describe("ConflictDetectionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("short-circuits when fewer than two elements are filled", async () => {
    const { service } = createService();
    const enforceSpy = vi.spyOn(StructuredOutputEnforcer, "enforceJSON");

    const result = await service.detectConflicts({
      elements: {
        subjectDescriptor1: "wearing formal tuxedo",
        subjectDescriptor2: "",
        environment: "",
      },
    });

    expect(result).toEqual({ conflicts: [] });
    expect(enforceSpy).not.toHaveBeenCalled();
  });

  it("merges LLM conflicts with descriptor heuristics", async () => {
    const { service, aiService } = createService();
    const llmConflicts: Conflict[] = [
      {
        elements: ["environment", "lighting"],
        severity: "high",
        message: "Storm lighting clashes with the tranquil beach mood",
        resolution: "Align the mood and lighting direction",
      },
    ];
    const enforceSpy = vi
      .spyOn(StructuredOutputEnforcer, "enforceJSON")
      .mockResolvedValue(llmConflicts);

    const result = await service.detectConflicts({
      elements: {
        subjectDescriptor1: "wearing formal tuxedo",
        subjectDescriptor2: "casual torn jacket",
        environment: "stormy beach at night",
      },
    });

    expect(result.conflicts).toHaveLength(2);
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Storm lighting clashes with the tranquil beach mood",
        }),
        expect.objectContaining({
          severity: "medium",
          message: expect.stringContaining("Wardrobe style mismatch"),
        }),
      ]),
    );
    expect(enforceSpy).toHaveBeenCalledWith(
      aiService,
      expect.stringContaining(
        "subjectDescriptor1 (wardrobe category): wearing formal tuxedo",
      ),
      expect.objectContaining({
        operation: "video_conflict_detection",
        isArray: true,
      }),
    );
  });

  it("detects modern versus vintage descriptor conflicts heuristically", async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockResolvedValue([]);

    const result = await service.detectConflicts({
      elements: {
        subjectDescriptor1: "wearing modern digital jacket",
        subjectDescriptor2: "wearing vintage antique coat",
      },
    });

    expect(result.conflicts).toEqual([
      expect.objectContaining({
        severity: "low",
        message: expect.stringContaining("Era mismatch"),
        resolution: expect.stringContaining("steampunk"),
      }),
    ]);
  });

  it("returns an empty result when structured output enforcement fails", async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, "enforceJSON").mockRejectedValue(
      new Error("bad json"),
    );

    const result = await service.detectConflicts({
      elements: {
        subjectDescriptor1: "wearing formal tuxedo",
        subjectDescriptor2: "casual torn jacket",
        environment: "city rooftop",
      },
    });

    expect(result).toEqual({ conflicts: [] });
  });
});
