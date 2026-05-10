import { logger } from "@infrastructure/Logger";
import type { IPostHogClient } from "@infrastructure/PostHogClient";
import { getRequestContext } from "@infrastructure/requestContext";
import type { LlmCallEventProperties, LlmCallSummary } from "./types";

/**
 * Emits one `llm.call.completed` event per LLM call recorded.
 *
 * Best-effort and fire-and-forget — failures inside the underlying PostHog
 * client are caught here and downgraded to a debug log. Telemetry must never
 * propagate into application code paths.
 *
 * `requestId` is read from the active AsyncLocalStorage request context (set
 * by `requestIdMiddleware`); when absent, the field is omitted entirely so
 * downstream PostHog consumers can distinguish in-request calls from those
 * fired outside any HTTP request scope.
 */
export class LlmCallTelemetryService {
  constructor(private readonly client: IPostHogClient) {}

  record(summary: LlmCallSummary): void {
    const userId = summary.userId ?? null;
    const distinctId = userId && userId.trim().length > 0 ? userId : "system";
    const ctx = getRequestContext();
    const requestId =
      typeof ctx?.requestId === "string" && ctx.requestId.length > 0
        ? ctx.requestId
        : undefined;

    const properties: LlmCallEventProperties = {
      executionType: summary.executionType,
      provider: summary.provider,
      model: summary.model,
      durationMs: Math.round(summary.durationMs),
      promptTokens: summary.promptTokens,
      completionTokens: summary.completionTokens,
      totalTokens: summary.totalTokens,
      finishReason: summary.finishReason,
      outcome: summary.outcome,
      ...(summary.errorMessage ? { errorMessage: summary.errorMessage } : {}),
      ...(requestId ? { requestId } : {}),
      userId,
    };

    try {
      this.client.capture({
        distinctId,
        event: "llm.call.completed",
        properties: { ...properties },
      });
    } catch (err) {
      logger.debug("LLM call telemetry emission failed (non-fatal)", {
        error: err instanceof Error ? err.message : String(err),
        executionType: summary.executionType,
      });
    }
  }
}
