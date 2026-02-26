import type { Generation } from '../types';

export const getGenerationProgressPercent = (
  generation: Generation,
  now: number
): number | null => {
  if (generation.status === 'completed') return 100;
  if (generation.status !== 'pending' && generation.status !== 'generating') return null;

  const expectedMs =
    generation.mediaType === 'image-sequence'
      ? 18_000
      : generation.tier === 'render'
        ? 65_000
        : 35_000;
  const elapsedMs = Math.max(0, now - generation.createdAt);
  const timePercent = Math.max(
    0,
    Math.min(95, Math.floor((elapsedMs / expectedMs) * 100))
  );

  const totalSlots = generation.mediaType === 'image-sequence' ? 4 : 1;
  const urlPercent = Math.max(
    0,
    Math.min(
      99,
      Math.round((Math.min(generation.mediaUrls.length, totalSlots) / totalSlots) * 100)
    )
  );

  const serverPercent =
    typeof generation.serverProgress === 'number'
      ? Math.max(0, Math.min(99, generation.serverProgress))
      : 0;

  return Math.max(timePercent, urlPercent, serverPercent);
};
