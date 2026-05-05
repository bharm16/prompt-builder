import type { Generation } from "@features/generations/types";

export type ShotStatus = "queued" | "rendering" | "ready" | "mixed" | "failed";

export interface Shot {
  /** `promptVersionId`, or `__legacy:<generation.id>` for un-grouped rows. */
  id: string;
  /** First 80ch of sanitized prompt from the earliest tile. */
  promptSummary: string;
  /** Model id from the earliest tile. */
  modelId: string;
  /** ms epoch — earliest variant's createdAt; used for sort order. */
  createdAt: number;
  /** Generations in this shot, ordered by createdAt ascending. */
  tiles: Generation[];
  /** Aggregate status across all variants. */
  status: ShotStatus;
}

const PROMPT_SUMMARY_MAX = 80;

function summarize(prompt: string | null | undefined): string {
  const trimmed = (prompt ?? "").trim();
  if (trimmed.length <= PROMPT_SUMMARY_MAX) return trimmed;
  return `${trimmed.slice(0, PROMPT_SUMMARY_MAX - 1)}…`;
}

function aggregateStatus(tiles: ReadonlyArray<Generation>): ShotStatus {
  const states = tiles.map((t) => t.status);
  if (states.every((s) => s === "completed")) return "ready";
  if (states.every((s) => s === "failed")) return "failed";
  if (states.some((s) => s === "generating")) return "rendering";
  if (states.some((s) => s === "pending")) return "queued";
  // Mix of completed + failed (the only remaining combo)
  return "mixed";
}

export function groupShots(generations: ReadonlyArray<Generation>): Shot[] {
  const buckets = new Map<string, Generation[]>();

  for (const gen of generations) {
    const key = gen.promptVersionId ?? `__legacy:${gen.id}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(gen);
    else buckets.set(key, [gen]);
  }

  const shots: Shot[] = [];
  for (const [id, tiles] of buckets) {
    tiles.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const earliest = tiles[0];
    // Buckets are only created when a generation is pushed, so `earliest` is
    // always defined — but the type system can't see that. Skip empty buckets.
    if (!earliest) continue;
    shots.push({
      id,
      promptSummary: summarize(earliest.prompt),
      modelId: earliest.model,
      createdAt: Math.min(...tiles.map((t) => t.createdAt ?? 0)),
      tiles,
      status: aggregateStatus(tiles),
    });
  }

  shots.sort((a, b) => b.createdAt - a.createdAt);
  return shots;
}
