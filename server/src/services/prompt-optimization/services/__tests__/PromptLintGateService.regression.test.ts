import { describe, expect, it, vi } from "vitest";
import { PromptLintGateService } from "../PromptLintGateService";

describe("regression: model-specific lint is non-fatal for length only", () => {
  const createService = () =>
    new PromptLintGateService({
      getModelConstraints: (modelId) =>
        modelId === "wan-2.2"
          ? { wordLimits: { min: 30, max: 60 }, triggerBudgetWords: 10 }
          : undefined,
    });

  it("logs and returns unchanged model-specific prompts when only the word budget is exceeded", () => {
    const service = createService();
    const logError = vi.fn();
    (service as unknown as { log: { error: typeof logError } }).log = {
      error: logError,
    } as never;
    const longPrompt = new Array(75).fill("word").join(" ");

    const result = service.enforce({
      prompt: longPrompt,
      modelId: "wan-2.2",
    });

    expect(result.prompt).toBe(longPrompt);
    expect(result.lint.ok).toBe(false);
    expect(result.lint.errors).toEqual([
      "Prompt too long for wan-2.2 (75 words > 60).",
    ]);
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("still fails when non-length prompt artifacts survive sanitation", () => {
    const service = createService();

    expect(() =>
      service.enforce({
        prompt: "# Heading\nThis should still fail.",
        modelId: "wan-2.2",
      }),
    ).toThrow("Prompt lint gate failed");
  });
});
