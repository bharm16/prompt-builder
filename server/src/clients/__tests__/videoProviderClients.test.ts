import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVideoProviderSdks,
  type VideoProviderClientConfig,
} from "@clients/videoProviderClients";
import { DEFAULT_KLING_BASE_URL } from "@services/video-generation/providers/klingProvider";
import { DEFAULT_VEO_BASE_URL } from "@services/video-generation/providers/veoProvider";

const openAIInstances: Array<{ apiKey: string }> = [];
const replicateInstances: Array<{ auth: string }> = [];
const lumaInstances: Array<{ authToken: string }> = [];

vi.mock("openai", () => ({
  default: class MockOpenAI {
    apiKey: string;
    constructor(opts: { apiKey: string }) {
      this.apiKey = opts.apiKey;
      openAIInstances.push({ apiKey: opts.apiKey });
    }
  },
}));

vi.mock("replicate", () => ({
  default: class MockReplicate {
    auth: string;
    constructor(opts: { auth: string }) {
      this.auth = opts.auth;
      replicateInstances.push({ auth: opts.auth });
    }
  },
}));

vi.mock("lumaai", () => ({
  LumaAI: class MockLumaAI {
    authToken: string;
    constructor(opts: { authToken: string }) {
      this.authToken = opts.authToken;
      lumaInstances.push({ authToken: opts.authToken });
    }
  },
}));

function makeLog(): { warn: ReturnType<typeof vi.fn> } {
  return { warn: vi.fn() };
}

const fullConfig: VideoProviderClientConfig = {
  replicateApiToken: "rep-token",
  openAIKey: "openai-key",
  lumaApiKey: "luma-key",
  klingApiKey: "kling-key",
  geminiApiKey: "gemini-key",
};

beforeEach(() => {
  openAIInstances.length = 0;
  replicateInstances.length = 0;
  lumaInstances.length = 0;
});

describe("createVideoProviderSdks", () => {
  it("constructs every SDK when all keys are present", () => {
    const log = makeLog();
    const sdks = createVideoProviderSdks(fullConfig, log);

    expect(sdks.replicate).not.toBeNull();
    expect(sdks.openai).not.toBeNull();
    expect(sdks.luma).not.toBeNull();
    expect(sdks.klingApiKey).toBe("kling-key");
    expect(sdks.geminiApiKey).toBe("gemini-key");
    expect(replicateInstances).toEqual([{ auth: "rep-token" }]);
    expect(openAIInstances).toEqual([{ apiKey: "openai-key" }]);
    expect(lumaInstances).toEqual([{ authToken: "luma-key" }]);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("leaves openai null and warns when openAIKey is missing", () => {
    const log = makeLog();
    const sdks = createVideoProviderSdks(
      { ...fullConfig, openAIKey: undefined },
      log,
    );

    expect(sdks.openai).toBeNull();
    expect(sdks.replicate).not.toBeNull();
    expect(sdks.luma).not.toBeNull();
    expect(sdks.klingApiKey).toBe("kling-key");
    expect(sdks.geminiApiKey).toBe("gemini-key");
    expect(log.warn).toHaveBeenCalledWith(
      "OPENAI_API_KEY not provided, Sora video generation will be disabled",
    );
  });

  it("leaves replicate null and warns when replicateApiToken is missing", () => {
    const log = makeLog();
    const sdks = createVideoProviderSdks(
      { ...fullConfig, replicateApiToken: undefined },
      log,
    );

    expect(sdks.replicate).toBeNull();
    expect(sdks.openai).not.toBeNull();
    expect(sdks.luma).not.toBeNull();
    expect(log.warn).toHaveBeenCalledWith(
      "REPLICATE_API_TOKEN not provided, Replicate-based video generation will be disabled",
    );
  });

  it("leaves luma null and warns when lumaApiKey is missing", () => {
    const log = makeLog();
    const sdks = createVideoProviderSdks(
      { ...fullConfig, lumaApiKey: undefined },
      log,
    );

    expect(sdks.luma).toBeNull();
    expect(log.warn).toHaveBeenCalledWith(
      "LUMA_API_KEY or LUMAAI_API_KEY not provided, Luma video generation will be disabled",
    );
  });

  it("leaves klingApiKey null and warns when missing", () => {
    const log = makeLog();
    const sdks = createVideoProviderSdks(
      { ...fullConfig, klingApiKey: undefined },
      log,
    );

    expect(sdks.klingApiKey).toBeNull();
    expect(log.warn).toHaveBeenCalledWith(
      "KLING_API_KEY not provided, Kling video generation will be disabled",
    );
  });

  it("leaves geminiApiKey null and warns when missing", () => {
    const log = makeLog();
    const sdks = createVideoProviderSdks(
      { ...fullConfig, geminiApiKey: undefined },
      log,
    );

    expect(sdks.geminiApiKey).toBeNull();
    expect(log.warn).toHaveBeenCalledWith(
      "GEMINI_API_KEY not provided, Veo video generation will be disabled",
    );
  });

  it("uses provider defaults when no base URLs are provided", () => {
    const log = makeLog();
    const sdks = createVideoProviderSdks(fullConfig, log);

    expect(sdks.klingBaseUrl).toBe(DEFAULT_KLING_BASE_URL);
    expect(sdks.geminiBaseUrl).toBe(DEFAULT_VEO_BASE_URL);
  });

  it("trims trailing slashes off configured base URLs", () => {
    const log = makeLog();
    const sdks = createVideoProviderSdks(
      {
        ...fullConfig,
        klingBaseUrl: "https://kling.example.com//",
        geminiBaseUrl: "https://gemini.example.com/v1//",
      },
      log,
    );

    expect(sdks.klingBaseUrl).toBe("https://kling.example.com");
    expect(sdks.geminiBaseUrl).toBe("https://gemini.example.com/v1");
  });

  it("emits a separate warn line for every missing key", () => {
    const log = makeLog();
    createVideoProviderSdks({}, log);

    expect(log.warn).toHaveBeenCalledTimes(5);
  });
});
