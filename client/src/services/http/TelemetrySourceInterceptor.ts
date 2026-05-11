import type { ApiClient } from "../ApiClient";

interface BuiltRequest {
  url: string;
  init: RequestInit;
}

function getMode(): string | undefined {
  return (import.meta as { env?: { MODE?: string } }).env?.MODE;
}

/**
 * Pure helper — used by the interceptor below and exported for unit testing.
 * Adds X-Telemetry-Source: user when this build's MODE is "production".
 * Server-side middleware resolves to "dev" / "ci" / "unknown" otherwise.
 *
 * Accepts an optional `mode` override for test isolation.
 */
export function applyTelemetrySourceHeader(
  payload: BuiltRequest,
  mode?: string,
): BuiltRequest {
  const resolvedMode = mode ?? getMode();
  if (resolvedMode !== "production") {
    return payload;
  }
  const existing = (payload.init.headers ?? {}) as Record<string, string>;
  return {
    url: payload.url,
    init: {
      ...payload.init,
      headers: {
        ...existing,
        "X-Telemetry-Source": "user",
      },
    },
  };
}

export function setupTelemetrySource(apiClient: ApiClient): void {
  apiClient.addRequestInterceptor(applyTelemetrySourceHeader);
}
