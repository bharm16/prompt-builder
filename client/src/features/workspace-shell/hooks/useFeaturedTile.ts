import { useMemo } from "react";
import type { Generation } from "@features/generations/types";
import type { Shot } from "../utils/groupShots";
import { sanitizeText } from "@/features/span-highlighting";

export interface UseFeaturedTileInput {
  shots: ReadonlyArray<Shot>;
  heroGeneration: Generation | null;
  /** Current prompt-bar text — used to decide whether a failed hero stays featured. */
  currentPrompt: string;
}

const normalize = (s: string | null | undefined): string =>
  sanitizeText(typeof s === "string" ? s : "").trim();

/**
 * Selects the featured tile within the active (most-recent) shot.
 *
 * Rules (preserved from the legacy CanvasWorkspace.displayHeroGeneration memo):
 *   1. No shots → null.
 *   2. heroGeneration matches a tile in the active shot → that tile.
 *   3. heroGeneration is failed AND current prompt differs from the failed
 *      tile's prompt → fall through (the user retried with a new prompt;
 *      the old failure is no longer relevant).
 *   4. Otherwise prefer the first completed tile, then the first tile.
 */
export function useFeaturedTile({
  shots,
  heroGeneration,
  currentPrompt,
}: UseFeaturedTileInput): Generation | null {
  return useMemo(() => {
    if (shots.length === 0) return null;
    const active = shots[0];
    if (!active || active.tiles.length === 0) return null;

    if (heroGeneration) {
      const matched = active.tiles.find((t) => t.id === heroGeneration.id);
      if (matched) {
        if (matched.status === "failed") {
          const promptsMatch =
            normalize(currentPrompt) === normalize(matched.prompt);
          if (promptsMatch) {
            return matched;
          }
          // else fall through to the next-best tile.
        } else {
          return matched;
        }
      }
    }

    const firstCompleted = active.tiles.find((t) => t.status === "completed");
    if (firstCompleted) return firstCompleted;
    return active.tiles[0] ?? null;
  }, [shots, heroGeneration, currentPrompt]);
}
