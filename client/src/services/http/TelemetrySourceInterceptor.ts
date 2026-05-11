import { TELEMETRY_SOURCE_HEADER } from "#shared/types/telemetry";
import type { ApiClient } from "../ApiClient";

interface BuiltRequest {
  url: string;
  init: RequestInit;
}

/** Not covered by unit tests — `import.meta.env.MODE` is a Vite build-time
 *  replacement and isn't reachable via `vi.stubEnv` (which only touches
 *  `process.env`). Tests inject `mode` directly via the second parameter. */
function getMode(): string | undefined {
  return (import.meta as { env?: { MODE?: string } }).env?.MODE;
}

/**
 * Pure helper — used by the interceptor below and exported for unit testing.
 * Adds the telemetry-source header (value: "user") when this build's MODE is
 * "production". Server-side middleware resolves to "dev" / "ci" / "unknown"
 * otherwise. Accepts an optional `mode` override for test isolation.
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
        [TELEMETRY_SOURCE_HEADER]: "user",
      },
    },
  };
}

export function setupTelemetrySource(apiClient: ApiClient): void {
  apiClient.addRequestInterceptor(applyTelemetrySourceHeader);
}
