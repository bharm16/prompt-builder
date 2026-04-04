import { describe, expect, it, vi } from "vitest";
import { PromptLintGateService } from "../PromptLintGateService";

describe("PromptLintGateService", () => {
  const service = new PromptLintGateService({
    getModelConstraints: (modelId) =>
      modelId === "wan-2.2"
        ? { wordLimits: { min: 30, max: 60 }, triggerBudgetWords: 10 }
        : undefined,
  });

  it("fails lint for technical specs markdown artifacts", () => {
    const lint = service.evaluate(
      "Scene text\n\n**TECHNICAL SPECS**\n- Duration: 8s",
    );
    expect(lint.ok).toBe(false);
    expect(lint.errors.some((error) => error.includes("technical specs"))).toBe(
      true,
    );
  });

  it("sanitizes markdown artifacts during enforcement", () => {
    const result = service.enforce({
      prompt: "Scene text\n\n**ALTERNATIVE APPROACHES**\n- Variation 1: ...",
    });
    expect(result.prompt).toBe("Scene text");
    expect(result.repaired).toBe(true);
  });

  it("returns unchanged model-specific prompts that exceed the budget and reports lint", () => {
    const longPrompt = new Array(120).fill("word").join(" ");
    const logError = vi.fn();
    (service as unknown as { log: { error: typeof logError } }).log = {
      error: logError,
    } as never;

    const result = service.enforce({
      prompt: longPrompt,
      modelId: "wan-2.2",
    });

    expect(result.prompt).toBe(longPrompt);
    expect(result.lint.ok).toBe(false);
    expect(result.lint.errors).toContain(
      "Prompt too long for wan-2.2 (120 words > 60).",
    );
    expect(logError).toHaveBeenCalled();
  });
});
