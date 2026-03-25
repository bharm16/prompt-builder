import { beforeEach, describe, expect, it, vi } from "vitest";

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    warn: vi.fn(),
  },
}));

vi.mock("@infrastructure/Logger", () => ({
  logger: loggerMock,
}));

vi.mock("@interfaces/IAIClient", () => ({
  AIClientError: class AIClientError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = "AIClientError";
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("@config/modelConfig", () => ({
  ModelConfig: {
    video_prompt_rewrite: {
      client: "gemini",
      model: "gemini-2.5-flash",
      temperature: 0.4,
      maxTokens: 8192,
      timeout: 45000,
      strictClient: true,
    },
  },
  DEFAULT_CONFIG: {
    client: "openai",
    model: "gpt-4o-mini",
    temperature: 0,
    maxTokens: 512,
    timeout: 10000,
  },
}));

import { ExecutionPlanResolver } from "../ExecutionPlan";

describe("regression: strict-client execution plans fail closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("for any strict Gemini operation, available qwen/openai clients must not remap the plan", () => {
    const resolver = new ExecutionPlanResolver({
      hasClient: (name: string) => name === "openai" || name === "qwen",
      hasAnyClient: () => true,
      getAvailableClients: () => ["openai", "qwen"],
    } as never);

    const plan = resolver.resolve("video_prompt_rewrite");

    expect(plan.primaryConfig.client).toBe("gemini");
    expect(plan.primaryConfig.model).toBe("gemini-2.5-flash");
    expect(plan.fallback).toBeNull();
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "Strict client unavailable; operation will not be remapped or auto-fallbacked",
      {
        operation: "video_prompt_rewrite",
        requiredClient: "gemini",
      },
    );
  });
});
