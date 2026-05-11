import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  TELEMETRY_SOURCE_HEADER,
  type TelemetrySource,
} from "#shared/types/telemetry.js";

export interface HarnessRequestResult {
  /** HTTP status code (200, 404, etc.) — or 0 if fetch itself threw (network error). */
  status: number;
  durationMs: number;
  ok: boolean;
  errorMessage?: string;
}

/**
 * Fires an anonymous request tagged as synthetic traffic. No Authorization
 * header — exercises the anonymous code path. Network failures (status: 0)
 * and HTTP errors (status: 4xx/5xx) both surface as `ok: false`; the harness
 * summary doesn't need to distinguish them.
 */
export async function sendSyntheticRequest(
  url: string,
  body: unknown,
): Promise<HarnessRequestResult> {
  const startedAt = Date.now();
  const sourceValue: TelemetrySource = "synthetic";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [TELEMETRY_SOURCE_HEADER]: sourceValue,
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
