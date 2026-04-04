import { describe, expect, it } from "vitest";
import {
  CANONICAL_PROMPT_MODEL_IDS,
  isCanonicalPromptModelId,
  resolveCanonicalPromptModelId,
} from "../videoModels";

describe("videoModels", () => {
  it("exports expected canonical ids", () => {
    expect(CANONICAL_PROMPT_MODEL_IDS).toEqual([
      "runway-gen45",
      "luma-ray3",
      "kling-2.1",
      "sora-2",
      "veo-3",
      "wan-2.2",
    ]);
  });

  it("resolves legacy aliases to canonical ids", () => {
    expect(resolveCanonicalPromptModelId("veo-4")).toBe("veo-3");
    expect(resolveCanonicalPromptModelId("kling-26")).toBe("kling-2.1");
    expect(resolveCanonicalPromptModelId("google/veo-3")).toBe("veo-3");
    expect(resolveCanonicalPromptModelId("kling-v2-1-master")).toBe(
      "kling-2.1",
    );
  });

  it("accepts canonical ids", () => {
    expect(resolveCanonicalPromptModelId("veo-3")).toBe("veo-3");
    expect(resolveCanonicalPromptModelId("kling-2.1")).toBe("kling-2.1");
    expect(isCanonicalPromptModelId("wan-2.2")).toBe(true);
  });

  it("returns null for unknown ids", () => {
    expect(resolveCanonicalPromptModelId("unknown-model")).toBeNull();
    expect(resolveCanonicalPromptModelId("")).toBeNull();
    expect(resolveCanonicalPromptModelId(null)).toBeNull();
  });
});
