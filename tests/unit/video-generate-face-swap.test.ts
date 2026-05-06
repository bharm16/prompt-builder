import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVideoCost } from "@config/modelCosts";
import { buildRefundKey } from "@services/credits/refundGuard";

const { scheduleInlineMock } = vi.hoisted(() => ({
  scheduleInlineMock: vi.fn(),
}));

vi.mock("@routes/preview/inlineProcessor", () => ({
  scheduleInlineVideoPreviewProcessing: scheduleInlineMock,
}));

import { createVideoGenerateHandler } from "@routes/preview/handlers/videoGenerate";
import { runSupertestOrSkip } from "./test-helpers/supertestSafeRequest";

const createApp = (
  handler: express.RequestHandler,
  userId: string | null = "user-123",
  requestId?: string,
): express.Express => {
  const app = express();
  app.use((req, _res, next) => {
    if (requestId) {
      (req as express.Request & { id?: string }).id = requestId;
    }
    const requestWithUser = req as express.Request & {
      user?: { uid?: string } | undefined;
    };
    if (userId) {
      requestWithUser.user = { uid: userId };
    } else {
      delete requestWithUser.user;
    }
    next();
  });
  app.use(express.json());
  app.post("/preview/video/generate", handler);
  return app;
};

// Adapter: delegates the atomic method to the existing createJob + reserveCredits mocks
// so tests written against the legacy 2-step API keep their assertions intact.
const buildAtomicReservation = (
  createJob: ReturnType<typeof vi.fn>,
): ((
  input: Record<string, unknown>,
  deps: {
    creditService: {
      reserveCredits: (uid: string, cost: number) => Promise<boolean>;
    };
    cost: number;
  },
) => Promise<
  { reserved: true; job: unknown } | { reserved: false; reason: string }
>) => {
  return async (input, { creditService, cost }) => {
    const ok = await creditService.reserveCredits(input.userId as string, cost);
    if (!ok) {
      return { reserved: false, reason: "insufficient_credits" };
    }
    const job = await createJob(input);
    return { reserved: true, job };
  };
};

describe("videoGenerate face swap preprocessing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("performs face swap when startImage and characterAssetId are provided", async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: "job-1",
      status: "queued",
      ...payload,
    }));

    const reserveCreditsMock = vi.fn(
      async (_userId: string, _amount: number) => true,
    );

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: "sora-2",
        }),
        getAvailabilityReport: () => ({ availableModels: [] }),
      } as never,
      videoJobStore: {
        createJob: createJobMock,
        createJobWithReservation: buildAtomicReservation(createJobMock),
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: null as never,
      faceSwapService: {
        swap: vi.fn(async () => ({
          swappedImageUrl: "https://images.example.com/swapped.webp",
          provider: "easel",
          durationMs: 1200,
        })),
        isAvailable: () => true,
      } as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: "https://images.example.com/face.webp",
        })),
      } as never,
    });

    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/video/generate").send({
        prompt: "A cinematic portrait shot.",
        model: "sora-2",
        startImage: "https://images.example.com/start.webp",
        characterAssetId: "char-123",
      }),
    );
    if (!response) return;

    expect(response.status).toBe(202);
    expect(response.body.faceSwapApplied).toBe(true);
    expect(response.body.faceSwapUrl).toBe(
      "https://images.example.com/swapped.webp",
    );
    expect(response.body.keyframeGenerated).toBe(false);

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | { request?: { options?: { startImage?: string } } }
      | undefined;
    expect(jobPayload?.request?.options?.startImage).toBe(
      "https://images.example.com/swapped.webp",
    );

    const faceSwapCall = reserveCreditsMock.mock.calls.find(
      (call) => call[1] === 2,
    );
    expect(faceSwapCall).toBeTruthy();

    const expectedVideoCost = getVideoCost("sora-2", 8);
    expect(response.body.creditsDeducted).toBe(expectedVideoCost + 2);
  });

  it("returns a 400 when face swap service is unavailable", async () => {
    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: "sora-2",
        }),
      } as never,
      videoJobStore: {
        createJob: vi.fn(),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: null as never,
      faceSwapService: null as never,
      assetService: null as never,
    });

    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/video/generate").send({
        prompt: "A cinematic portrait shot.",
        model: "sora-2",
        startImage: "https://images.example.com/start.webp",
        characterAssetId: "char-123",
      }),
    );
    if (!response) return;

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Face-swap not available");
  });

  it("generates a PuLID keyframe when only characterAssetId is provided", async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: "job-2",
      status: "queued",
      ...payload,
    }));

    const reserveCreditsMock = vi.fn(
      async (_userId: string, _amount: number) => true,
    );

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: "sora-2",
        }),
      } as never,
      videoJobStore: {
        createJob: createJobMock,
        createJobWithReservation: buildAtomicReservation(createJobMock),
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: {
        generateKeyframe: vi.fn(async () => ({
          imageUrl: "https://images.example.com/keyframe.webp",
          faceStrength: 0.7,
        })),
      } as never,
      faceSwapService: null as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: "https://images.example.com/face.webp",
          negativePrompt: null,
          faceEmbedding: null,
        })),
      } as never,
    });

    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/video/generate").send({
        prompt: "A cinematic portrait shot.",
        model: "sora-2",
        characterAssetId: "char-123",
      }),
    );
    if (!response) return;

    expect(response.status).toBe(202);
    expect(response.body.keyframeGenerated).toBe(true);
    expect(response.body.keyframeUrl).toBe(
      "https://images.example.com/keyframe.webp",
    );
    expect(response.body.faceSwapApplied).toBe(false);

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | { request?: { options?: { startImage?: string } } }
      | undefined;
    expect(jobPayload?.request?.options?.startImage).toBe(
      "https://images.example.com/keyframe.webp",
    );

    const keyframeCall = reserveCreditsMock.mock.calls.find(
      (call) => call[1] === 2,
    );
    expect(keyframeCall).toBeTruthy();
  });

  it("resolves @triggers and auto-selects characterAssetId when not provided", async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: "job-trigger",
      status: "queued",
      ...payload,
    }));
    const generateKeyframeMock = vi.fn(async () => ({
      imageUrl: "https://images.example.com/keyframe-trigger.webp",
      faceStrength: 0.7,
    }));
    const resolvePromptMock = vi.fn(async () => ({
      originalText: "@matt walks through a neon alley",
      expandedText: "Matt Harmon walks through a neon alley",
      assets: [{ id: "char-999" }],
      characters: [{ id: "char-999" }],
      styles: [],
      locations: [],
      objects: [],
      requiresKeyframe: true,
      negativePrompts: [],
      referenceImages: [],
    }));

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: "sora-2",
        }),
      } as never,
      videoJobStore: {
        createJob: createJobMock,
        createJobWithReservation: buildAtomicReservation(createJobMock),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: {
        generateKeyframe: generateKeyframeMock,
      } as never,
      faceSwapService: null as never,
      assetService: {
        resolvePrompt: resolvePromptMock,
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: "https://images.example.com/face.webp",
          negativePrompt: null,
          faceEmbedding: null,
        })),
      } as never,
    });

    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/video/generate").send({
        prompt: "@matt walks through a neon alley",
        model: "sora-2",
      }),
    );
    if (!response) return;

    expect(response.status).toBe(202);
    expect(response.body.keyframeGenerated).toBe(true);
    expect(resolvePromptMock).toHaveBeenCalledWith(
      "user-123",
      "@matt walks through a neon alley",
    );
    expect(generateKeyframeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Matt Harmon walks through a neon alley",
      }),
    );

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | {
          request?: {
            prompt?: string;
            options?: { characterAssetId?: string };
          };
        }
      | undefined;
    expect(jobPayload?.request?.prompt).toBe(
      "Matt Harmon walks through a neon alley",
    );
    expect(jobPayload?.request?.options?.characterAssetId).toBe("char-999");
  });

  it("uses the provided startImage directly when no characterAssetId is set", async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: "job-3",
      status: "queued",
      ...payload,
    }));

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: "sora-2",
        }),
      } as never,
      videoJobStore: {
        createJob: createJobMock,
        createJobWithReservation: buildAtomicReservation(createJobMock),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: null as never,
      faceSwapService: null as never,
      assetService: null as never,
    });

    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/video/generate").send({
        prompt: "A cinematic portrait shot.",
        model: "sora-2",
        startImage: "https://images.example.com/start.webp",
      }),
    );
    if (!response) return;

    expect(response.status).toBe(202);
    expect(response.body.keyframeGenerated).toBe(false);
    expect(response.body.faceSwapApplied).toBe(false);

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | { request?: { options?: { startImage?: string } } }
      | undefined;
    expect(jobPayload?.request?.options?.startImage).toBe(
      "https://images.example.com/start.webp",
    );
  });

  it("refunds face swap credits when preprocessing fails", async () => {
    const refundCreditsMock = vi.fn(async () => true);

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: "sora-2",
        }),
      } as never,
      videoJobStore: {
        createJob: vi.fn(),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never,
      keyframeService: null as never,
      faceSwapService: {
        swap: vi.fn(async () => {
          throw new Error("Fal swap down");
        }),
        isAvailable: () => true,
      } as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: "https://images.example.com/face.webp",
        })),
      } as never,
    });

    const app = createApp(handler, "user-123", "req-refund-1");

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/video/generate").send({
        prompt: "A cinematic portrait shot.",
        model: "sora-2",
        startImage: "https://images.example.com/start.webp",
        characterAssetId: "char-123",
      }),
    );
    if (!response) return;

    const expectedRefundKey = buildRefundKey([
      "preview-video",
      "req-refund-1",
      "user-123",
      "faceSwap",
    ]);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Face-swap failed");
    expect(refundCreditsMock).toHaveBeenCalledWith(
      "user-123",
      2,
      expect.objectContaining({
        refundKey: expectedRefundKey,
        reason: "video face-swap preprocessing failed",
      }),
    );
  });

  it("refunds keyframe credits when keyframe preprocessing fails", async () => {
    const refundCreditsMock = vi.fn(async () => true);

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: "sora-2",
        }),
      } as never,
      videoJobStore: {
        createJob: vi.fn(),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never,
      keyframeService: {
        generateKeyframe: vi.fn(async () => {
          throw new Error("pulid unavailable");
        }),
      } as never,
      faceSwapService: null as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: "https://images.example.com/face.webp",
          negativePrompt: null,
          faceEmbedding: null,
        })),
      } as never,
    });

    const app = createApp(handler, "user-123", "req-refund-kf-1");

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/video/generate").send({
        prompt: "A cinematic portrait shot.",
        model: "sora-2",
        characterAssetId: "char-123",
      }),
    );
    if (!response) return;

    const expectedRefundKey = buildRefundKey([
      "preview-video",
      "req-refund-kf-1",
      "user-123",
      "keyframe",
    ]);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: "Keyframe generation failed",
      code: "GENERATION_FAILED",
    });
    expect(refundCreditsMock).toHaveBeenCalledWith(
      "user-123",
      2,
      expect.objectContaining({
        refundKey: expectedRefundKey,
        reason: "video keyframe preprocessing failed",
      }),
    );
  });

  it("refunds face-swap credits (but not video credits — atomic tx rolls back) when queueing fails", async () => {
    const refundCreditsMock = vi.fn(async () => true);
    const queueFailingCreateJob = vi.fn(async () => {
      throw new Error("queue unavailable");
    });

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: "sora-2",
        }),
      } as never,
      videoJobStore: {
        createJob: queueFailingCreateJob,
        createJobWithReservation: async () => {
          throw new Error("queue unavailable");
        },
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never,
      keyframeService: null as never,
      faceSwapService: {
        swap: vi.fn(async () => ({
          swappedImageUrl: "https://images.example.com/swapped.webp",
          provider: "easel",
          durationMs: 400,
        })),
        isAvailable: () => true,
      } as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: "https://images.example.com/face.webp",
        })),
      } as never,
    });

    const app = createApp(handler, "user-123", "req-queue-fs-1");

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/video/generate").send({
        prompt: "Queue failure should refund all reserved credits.",
        model: "sora-2",
        startImage: "https://images.example.com/start.webp",
        characterAssetId: "char-123",
      }),
    );
    if (!response) return;

    const expectedFaceSwapRefundKey = buildRefundKey([
      "preview-video",
      "req-queue-fs-1",
      "user-123",
      "faceSwap",
    ]);
    const expectedVideoCost = getVideoCost("sora-2", 8);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: "Video generation failed",
      code: "GENERATION_FAILED",
      requestId: "req-queue-fs-1",
    });

    // Preprocessing (face-swap) credits ARE refunded — they were reserved in a
    // separate transaction that committed before queueing.
    expect(refundCreditsMock).toHaveBeenCalledWith(
      "user-123",
      2,
      expect.objectContaining({
        refundKey: expectedFaceSwapRefundKey,
        reason: "video queueing failed after face-swap reservation",
      }),
    );
    // Video credits are NOT refunded — the atomic reserve+create transaction
    // rolled back, so no debit occurred in the first place.
    expect(refundCreditsMock).not.toHaveBeenCalledWith(
      "user-123",
      expectedVideoCost,
      expect.anything(),
    );
  });

  it("refunds keyframe credits (but not video credits — atomic tx rolls back) when queueing fails", async () => {
    const refundCreditsMock = vi.fn(async () => true);

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: "sora-2",
        }),
      } as never,
      videoJobStore: {
        createJob: vi.fn(async () => {
          throw new Error("queue unavailable");
        }),
        createJobWithReservation: async () => {
          throw new Error("queue unavailable");
        },
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never,
      keyframeService: {
        generateKeyframe: vi.fn(async () => ({
          imageUrl: "https://images.example.com/keyframe.webp",
          faceStrength: 0.7,
        })),
      } as never,
      faceSwapService: null as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: "https://images.example.com/face.webp",
          negativePrompt: null,
          faceEmbedding: null,
        })),
      } as never,
    });

    const app = createApp(handler, "user-123", "req-queue-kf-1");

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/video/generate").send({
        prompt: "Queue failure should refund keyframe and video reserves.",
        model: "sora-2",
        characterAssetId: "char-123",
      }),
    );
    if (!response) return;

    const expectedKeyframeRefundKey = buildRefundKey([
      "preview-video",
      "req-queue-kf-1",
      "user-123",
      "keyframe",
    ]);
    const expectedVideoCost = getVideoCost("sora-2", 8);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: "Video generation failed",
      code: "GENERATION_FAILED",
      requestId: "req-queue-kf-1",
    });

    // Preprocessing (keyframe) credits ARE refunded.
    expect(refundCreditsMock).toHaveBeenCalledWith(
      "user-123",
      2,
      expect.objectContaining({
        refundKey: expectedKeyframeRefundKey,
        reason: "video queueing failed after keyframe reservation",
      }),
    );
    // Video credits are NOT refunded — atomic reserve+create transaction rolled back.
    expect(refundCreditsMock).not.toHaveBeenCalledWith(
      "user-123",
      expectedVideoCost,
      expect.anything(),
    );
  });
});
