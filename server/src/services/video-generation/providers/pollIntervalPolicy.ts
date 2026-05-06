/**
 * Suggests a client poll interval (ms) based on the provider and how long
 * the job has been running. Values reflect realistic provider pacing so the
 * client doesn't burn Firestore reads on long-running jobs.
 *
 * Callers pass the provider name (as stored on VideoJobRecord.provider).
 * Unknown providers fall back to a conservative default.
 */

const FAST_PHASE_MS = 60_000; // first minute: fastest polling
const MID_PHASE_MS = 4 * 60_000; // up to 4 min: medium polling

interface ProviderPollCadence {
  fast: number;
  mid: number;
  slow: number;
}

const CADENCE: Record<string, ProviderPollCadence> = {
  // OpenAI Sora: ~60–120s typical
  openai: { fast: 2_000, mid: 3_000, slow: 5_000 },
  // Gemini Veo: ~2–5 min typical
  gemini: { fast: 3_000, mid: 5_000, slow: 8_000 },
  // Luma Ray: ~2–4 min typical
  luma: { fast: 3_000, mid: 5_000, slow: 8_000 },
  // Kling: ~3–7 min typical
  kling: { fast: 4_000, mid: 6_000, slow: 10_000 },
  // Replicate (Wan, etc.): ~4–10 min typical
  replicate: { fast: 4_000, mid: 6_000, slow: 10_000 },
};

const DEFAULT_CADENCE: ProviderPollCadence = {
  fast: 2_000,
  mid: 5_000,
  slow: 8_000,
};

export function getSuggestedPollIntervalMs(
  provider: string | undefined,
  elapsedMs: number,
): number {
  const cadence = (provider && CADENCE[provider]) || DEFAULT_CADENCE;
  if (elapsedMs < FAST_PHASE_MS) return cadence.fast;
  if (elapsedMs < MID_PHASE_MS) return cadence.mid;
  return cadence.slow;
}
