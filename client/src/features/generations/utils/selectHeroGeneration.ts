import type { Generation } from "../types";

interface SelectHeroGenerationInput {
  generations: Generation[];
  activeGenerationId: string | null;
  heroOverrideGenerationId: string | null;
}

const isStoryboard = (generation: Generation): boolean =>
  generation.mediaType === "image-sequence";

/**
 * Choose the generation that should occupy the canvas hero slot.
 *
 * Selection precedence:
 *  1. Explicit override id (must point to a non-storyboard generation).
 *  2. Active selection id (must point to a non-storyboard generation).
 *  3. Default: latest non-storyboard generation, with render-tier preferred
 *     over draft-tier when both are present.
 *
 * Storyboards (mediaType === "image-sequence") never occupy the hero — they
 * surface only inside the storyboard viewer.
 */
export function selectHeroGeneration({
  generations,
  activeGenerationId,
  heroOverrideGenerationId,
}: SelectHeroGenerationInput): Generation | null {
  if (generations.length === 0) return null;

  const nonStoryboard = generations.filter((g) => !isStoryboard(g));
  if (nonStoryboard.length === 0) return null;

  if (heroOverrideGenerationId) {
    const overrideMatch = nonStoryboard.find(
      (g) => g.id === heroOverrideGenerationId,
    );
    if (overrideMatch) return overrideMatch;
  }

  if (activeGenerationId) {
    const activeMatch = nonStoryboard.find((g) => g.id === activeGenerationId);
    if (activeMatch) return activeMatch;
  }

  // Default fallback: prefer the latest render-tier generation, since users
  // pay materially more for render output than for draft previews. Only fall
  // back to draft-tier when no render exists.
  const renders = nonStoryboard.filter((g) => g.tier === "render");
  if (renders.length > 0) {
    return renders[renders.length - 1] ?? null;
  }
  return nonStoryboard[nonStoryboard.length - 1] ?? null;
}
