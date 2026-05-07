import { describe, it, expect } from "vitest";
import { createVideoProviders } from "../VideoProviders";
import type { VideoProviderSdks } from "@clients/videoProviderClients";
import type { VideoModelId } from "@shared/videoModels";
import type { VideoAssetStore } from "@services/video-generation/storage";

const noopAssetStore = {} as unknown as VideoAssetStore;

const noopLog = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function fullSdks(): VideoProviderSdks {
  return {
    replicate: {} as VideoProviderSdks["replicate"],
    openai: {} as VideoProviderSdks["openai"],
    luma: {} as VideoProviderSdks["luma"],
    klingApiKey: "kling-key",
    klingBaseUrl: "https://kling.example.com",
    geminiApiKey: "gemini-key",
    geminiBaseUrl: "https://gemini.example.com/v1",
  };
}

describe("createVideoProviders(sdks) — injection contract", () => {
  it("reports every provider available when sdks are fully populated", () => {
    const providers = createVideoProviders(fullSdks());

    expect(providers.replicate.isAvailable()).toBe(true);
    expect(providers.openai.isAvailable()).toBe(true);
    expect(providers.luma.isAvailable()).toBe(true);
    expect(providers.kling.isAvailable()).toBe(true);
    expect(providers.gemini.isAvailable()).toBe(true);
  });

  it("returns isAvailable() false when an SDK slot is null", () => {
    const sdks: VideoProviderSdks = { ...fullSdks(), openai: null };
    const providers = createVideoProviders(sdks);

    expect(providers.openai.isAvailable()).toBe(false);
    expect(providers.replicate.isAvailable()).toBe(true);
  });

  it("throws the documented error when generate() is called on an unavailable openai provider", async () => {
    const providers = createVideoProviders({ ...fullSdks(), openai: null });

    await expect(
      providers.openai.generate(
        "prompt",
        "sora-2" as VideoModelId,
        {},
        noopAssetStore,
        noopLog,
      ),
    ).rejects.toThrow("Sora video generation requires OPENAI_API_KEY.");
  });

  it("throws the documented error when generate() is called on an unavailable replicate provider", async () => {
    const providers = createVideoProviders({ ...fullSdks(), replicate: null });

    await expect(
      providers.replicate.generate(
        "prompt",
        "wan-video/wan-2.2-t2v-fast" as VideoModelId,
        {},
        noopAssetStore,
        noopLog,
      ),
    ).rejects.toThrow(
      "Replicate API token is required for the selected video model.",
    );
  });

  it("throws the documented error when generate() is called on an unavailable luma provider", async () => {
    const providers = createVideoProviders({ ...fullSdks(), luma: null });

    await expect(
      providers.luma.generate(
        "prompt",
        "luma-ray3" as VideoModelId,
        {},
        noopAssetStore,
        noopLog,
      ),
    ).rejects.toThrow(
      "Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.",
    );
  });

  it("throws the documented error when generate() is called on an unavailable kling provider", async () => {
    const providers = createVideoProviders({
      ...fullSdks(),
      klingApiKey: null,
    });

    await expect(
      providers.kling.generate(
        "prompt",
        "kling-v2-1-master" as VideoModelId,
        {},
        noopAssetStore,
        noopLog,
      ),
    ).rejects.toThrow("Kling video generation requires KLING_API_KEY.");
  });

  it("throws the documented error when generate() is called on an unavailable gemini provider", async () => {
    const providers = createVideoProviders({
      ...fullSdks(),
      geminiApiKey: null,
    });

    await expect(
      providers.gemini.generate(
        "prompt",
        "google/veo-3" as VideoModelId,
        {},
        noopAssetStore,
        noopLog,
      ),
    ).rejects.toThrow("Veo video generation requires GEMINI_API_KEY.");
  });
});
