export interface HarnessRequestResult {
  status: number;
  durationMs: number;
  ok: boolean;
  errorMessage?: string;
}

/**
 * Fires an anonymous request with X-Telemetry-Source: synthetic.
 * No Authorization header — exercises the anonymous code path.
 */
export async function sendSyntheticRequest(
  url: string,
  body: unknown,
): Promise<HarnessRequestResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telemetry-Source": "synthetic",
      },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      durationMs: Date.now() - startedAt,
      ok: response.ok,
      ...(response.ok ? {} : { errorMessage: `HTTP ${response.status}` }),
    };
  } catch (err) {
    return {
      status: 0,
      durationMs: Date.now() - startedAt,
      ok: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface HarnessPrompt {
  id: string;
  text: string;
  tags: string[];
}

export async function loadPrompts(): Promise<HarnessPrompt[]> {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "..", "fixtures", "prompts.json");
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as HarnessPrompt[];
}

/** Shared shape every driver returns. Defined here so drivers stay tiny. */
export interface DriverSummary {
  surface: string;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  avgDurationMs: number;
  errors: { promptId: string; message: string }[];
}

/** Aggregate a driver's per-request results into a summary. */
export function summarizeDriverResults(
  surface: string,
  results: { prompt: HarnessPrompt; res: HarnessRequestResult }[],
): DriverSummary {
  const totalCalls = results.length;
  const successCount = results.filter((r) => r.res.ok).length;
  const errorCount = totalCalls - successCount;
  const avgDurationMs =
    totalCalls > 0
      ? Math.round(
          results.reduce((s, r) => s + r.res.durationMs, 0) / totalCalls,
        )
      : 0;
  const errors = results
    .filter((r) => !r.res.ok)
    .map((r) => ({
      promptId: r.prompt.id,
      message: r.res.errorMessage ?? "unknown",
    }));
  return {
    surface,
    totalCalls,
    successCount,
    errorCount,
    avgDurationMs,
    errors,
  };
}
