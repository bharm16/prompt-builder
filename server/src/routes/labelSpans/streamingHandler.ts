import type { Response } from "express";
import { logger } from "@infrastructure/Logger";
import { labelSpansStream } from "@llm/span-labeling/SpanLabelingService";
import { getCurrentSpanProvider } from "@llm/span-labeling/services/LlmClientFactory";
import type { AIModelService } from "@services/ai-model/AIModelService";
import type { SpanLabelingCacheService } from "@services/cache/SpanLabelingCacheService";
import type {
  LabelSpansParams,
  SpanLike,
  ValidationPolicy,
} from "@llm/span-labeling/types";
import { toPublicSpan } from "./transform";

interface StreamHandlerInput {
  res: Response;
  payload: LabelSpansParams;
  aiService: AIModelService;
  requestId?: string;
  userId?: string;
  /** Optional cache service — when provided, completed stream results are
   *  written to the same cache the blocking route uses, so subsequent
   *  identical requests (streaming or blocking) get a hit. */
  spanLabelingCache?: SpanLabelingCacheService | null;
  /** Raw text for cache key computation. */
  text?: string;
  /** Validation policy for cache key. */
  policy?: ValidationPolicy | null;
  /** Template version for cache key. */
  templateVersion?: string | null;
}

export async function handleLabelSpansStreamRequest({
  res,
  payload,
  aiService,
  requestId,
  userId,
  spanLabelingCache = null,
  text = "",
  policy = null,
  templateVersion = null,
}: StreamHandlerInput): Promise<void> {
  const operation = "labelSpansStream";
  let clientClosed = false;

  res.on("close", () => {
    clientClosed = true;
  });

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Collect spans for cache backfill when stream completes successfully.
  const collectedSpans: SpanLike[] = [];
  let streamCompleted = false;

  try {
    const stream = labelSpansStream(payload, aiService);
    for await (const span of stream) {
      if (clientClosed || res.writableEnded || res.destroyed) {
        break;
      }
      collectedSpans.push(span);
      res.write(JSON.stringify(toPublicSpan(span)) + "\n");
    }

    // Stream exhausted normally — mark as completed for cache backfill.
    if (!clientClosed) {
      streamCompleted = true;
    }

    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  } catch (error) {
    logger.error("Operation failed.", error as Error, {
      operation,
      requestId,
      userId,
    });
    if (clientClosed || res.writableEnded || res.destroyed) {
      return;
    }
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorPayload = {
      error: "Streaming failed",
      message: errorMessage,
      degraded: collectedSpans.length > 0,
      partialCount: collectedSpans.length,
    };
    if (!res.headersSent) {
      res.status(502).json(errorPayload);
      return;
    }
    try {
      res.write(JSON.stringify(errorPayload) + "\n");
    } finally {
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    }
  }

  // Cache backfill: write the completed result so subsequent identical
  // requests (streaming or blocking) get a cache hit.
  if (
    streamCompleted &&
    spanLabelingCache &&
    collectedSpans.length > 0 &&
    text
  ) {
    try {
      const ttl = text.length > 2000 ? 300 : 3600;
      const provider = getCurrentSpanProvider();
      await spanLabelingCache.set(
        text,
        policy ?? null,
        templateVersion ?? null,
        {
          spans: collectedSpans,
          meta: { version: "stream-backfill", notes: "" },
        },
        { ttl, provider },
      );
      logger.debug("Stream cache backfill completed", {
        operation,
        requestId,
        spanCount: collectedSpans.length,
        textLength: text.length,
        ttl,
      });
    } catch (cacheError) {
      // Non-fatal — log and move on.
      logger.warn("Stream cache backfill failed", {
        operation,
        requestId,
        error: (cacheError as Error).message,
      });
    }
  }
}
