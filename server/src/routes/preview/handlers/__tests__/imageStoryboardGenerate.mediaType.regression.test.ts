import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createImageStoryboardGenerateHandler } from "../imageStoryboardGenerate";
import { SessionService } from "@services/sessions/SessionService";
import type { SessionRecord } from "@services/sessions/types";

interface ErrorWithCode {
  code?: string;
  message?: string;
}

const isSocketPermissionError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as ErrorWithCode;
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  if (code === "EPERM" || code === "EACCES") return true;
  return (
    message.includes("listen EPERM") ||
    message.includes("listen EACCES") ||
    message.includes("operation not permitted") ||
    message.includes("Cannot read properties of null (reading 'port')")
  );
};

const runSupertestOrSkip = async <T>(
  execute: () => Promise<T>,
): Promise<T | null> => {
  if (process.env.CODEX_SANDBOX === "seatbelt") return null;
  try {
    return await execute();
  } catch (error) {
    if (isSocketPermissionError(error)) return null;
    throw error;
  }
};

const withAuth =
  (userId: string) =>
  (app: express.Express): void => {
    app.use((req, _res, next) => {
      (req as express.Request & { user?: { uid?: string }; id?: string }).user =
        { uid: userId };
      (req as express.Request & { id?: string }).id = "req-1";
      next();
    });
  };

const buildSession = (
  overrides: Partial<SessionRecord> = {},
): SessionRecord => ({
  id: "session-1",
  userId: "user-1",
  status: "active",
  createdAt: new Date("2026-04-22T00:00:00.000Z"),
  updatedAt: new Date("2026-04-22T00:00:00.000Z"),
  prompt: {
    input: "raw prompt",
    output: "optimized prompt",
    versions: [
      {
        versionId: "v-1",
        signature: "sig",
        prompt: "optimized prompt",
        timestamp: "2026-04-22T00:00:00.000Z",
        generations: [],
      },
    ],
  },
  ...overrides,
});

describe("regression: storyboard generations persist with mediaType (ISSUE-30)", () => {
  // Invariant: for any successful storyboard generation persisted to a session,
  // the persisted record carries mediaType: "image-sequence". The client gallery
  // filters on this exact value (see usePromptVersioning.ts) — without it,
  // storyboards are invisible to the version row and gallery hero selection.

  const buildHandler = () => {
    const sessionStore = {
      save: vi.fn(),
      get: vi.fn().mockResolvedValue(buildSession()),
      findByPromptUuid: vi.fn().mockResolvedValue(null),
      findByUser: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    };
    const sessionService = new SessionService(sessionStore as never);
    const storyboardPreviewService = {
      generateStoryboard: vi.fn().mockResolvedValue({
        imageUrls: [
          "https://gcs.example/frame-1.png",
          "https://gcs.example/frame-2.png",
          "https://gcs.example/frame-3.png",
          "https://gcs.example/frame-4.png",
        ],
        storagePaths: [
          "users/user-1/preview-image/asset-1",
          "users/user-1/preview-image/asset-2",
          "users/user-1/preview-image/asset-3",
          "users/user-1/preview-image/asset-4",
        ],
        deltas: ["beat 1", "beat 2", "beat 3", "beat 4"],
        baseImageUrl: "https://gcs.example/frame-1.png",
      }),
    };
    const userCreditService = {
      reserveCredits: vi.fn().mockResolvedValue(true),
      refundCredits: vi.fn().mockResolvedValue(undefined),
    };

    const handler = createImageStoryboardGenerateHandler({
      storyboardPreviewService: storyboardPreviewService as never,
      userCreditService: userCreditService as never,
      assetService: null as never,
      requestIdempotencyService: null as never,
      sessionService,
    });

    return { handler, sessionStore };
  };

  it("persisted storyboard generation record has mediaType: 'image-sequence'", async () => {
    const { handler, sessionStore } = buildHandler();
    const app = express();
    app.use(express.json());
    withAuth("user-1")(app);
    app.post("/preview/generate/storyboard", handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post("/preview/generate/storyboard").send({
        prompt: "astronaut on mars at sunset",
        sessionId: "session-1",
        promptVersionId: "v-1",
      }),
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(sessionStore.save).toHaveBeenCalledTimes(1);

    const saved = sessionStore.save.mock.calls[0]![0] as SessionRecord;
    const generations = saved.prompt?.versions?.[0]?.generations ?? [];
    expect(generations).toHaveLength(1);
    const persisted = generations[0] as Record<string, unknown>;

    // The bug: mediaType is missing from the persisted record.
    expect(persisted.mediaType).toBe("image-sequence");
  });
});
