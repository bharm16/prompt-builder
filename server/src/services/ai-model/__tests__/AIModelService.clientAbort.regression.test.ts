import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loggerMock,
  shouldUseSeedMock,
  hashStringMock,
  detectAndGetCapabilitiesMock,
  buildRequestOptionsMock,
  buildResponseFormatMock,
  resolvePlanMock,
  getConfigMock,
} = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  shouldUseSeedMock: vi.fn(),
  hashStringMock: vi.fn(),
  detectAndGetCapabilitiesMock: vi.fn(),
  buildRequestOptionsMock: vi.fn(),
  buildResponseFormatMock: vi.fn(),
  resolvePlanMock: vi.fn(),
  getConfigMock: vi.fn(),
}));

vi.mock("@infrastructure/Logger", () => ({
  logger: loggerMock,
}));

vi.mock("@config/modelConfig", () => ({
  ModelConfig: {
    optimize_standard: {},
  },
  shouldUseSeed: shouldUseSeedMock,
}));

vi.mock("@utils/hash", () => ({
  hashString: hashStringMock,
}));

vi.mock("@utils/provider/ProviderDetector", () => ({
  detectAndGetCapabilities: detectAndGetCapabilitiesMock,
}));

vi.mock("../request/RequestOptionsBuilder", () => ({
  buildRequestOptions: buildRequestOptionsMock,
}));

vi.mock("../request/ResponseFormatBuilder", () => ({
  buildResponseFormat: buildResponseFormatMock,
}));

vi.mock("../routing/ExecutionPlan", () => ({
  ExecutionPlanResolver: class {
    resolve(operation: string) {
      return resolvePlanMock(operation);
    }
    getConfig(operation: string) {
      return getConfigMock(operation);
    }
  },
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

import { AIModelService } from "../AIModelService";

const baseConfig = {
  client: "openai",
  model: "gpt-4o",
  temperature: 0.2,
  maxTokens: 1000,
  timeout: 20000,
};

describe("AIModelService client-abort regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldUseSeedMock.mockReturnValue(false);
    hashStringMock.mockReturnValue(12345);
    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: "openai",
      capabilities: {
        strictJsonSchema: true,
        developerRole: true,
        bookending: true,
      },
    });
    buildResponseFormatMock.mockReturnValue({ jsonMode: false });
    buildRequestOptionsMock.mockReturnValue({
      model: "gpt-4o",
      temperature: 0.2,
      maxTokens: 1000,
      timeout: 20000,
      jsonMode: false,
    });
    resolvePlanMock.mockReturnValue({
      primaryConfig: baseConfig,
      fallback: { client: "qwen", model: "qwen/qwen3-32b", timeout: 10000 },
    });
    getConfigMock.mockReturnValue(baseConfig);
  });

  it("for any client-aborted primary request, fallback must not execute", async () => {
    const clientAbortError = new Error("openai API request aborted by client");
    clientAbortError.name = "ClientAbortError";

    const primaryComplete = vi.fn().mockRejectedValue(clientAbortError);
    const fallbackComplete = vi
      .fn()
      .mockResolvedValue({ text: "fallback", metadata: {} });

    const service = new AIModelService({
      clients: {
        openai: { complete: primaryComplete } as never,
        qwen: { complete: fallbackComplete } as never,
      },
    });

    await expect(
      service.execute("optimize_standard", { systemPrompt: "prompt" }),
    ).rejects.toBe(clientAbortError);

    expect(fallbackComplete).not.toHaveBeenCalled();
  });

  it("for retryable non-abort errors, fallback still executes", async () => {
    const retryableError = new Error("openai 503");
    (retryableError as Error & { isRetryable?: boolean }).isRetryable = true;

    const primaryComplete = vi.fn().mockRejectedValue(retryableError);
    const fallbackComplete = vi
      .fn()
      .mockResolvedValue({ text: "fallback-ok", metadata: {} });

    const service = new AIModelService({
      clients: {
        openai: { complete: primaryComplete } as never,
        qwen: { complete: fallbackComplete } as never,
      },
    });

    const response = await service.execute("optimize_standard", {
      systemPrompt: "prompt",
    });

    expect(response.text).toBe("fallback-ok");
    expect(fallbackComplete).toHaveBeenCalledTimes(1);
  });
});
