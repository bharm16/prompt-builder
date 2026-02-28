/**
 * Small synonym clusters for visual-language deduplication.
 * The first term in each cluster is the canonical representative.
 */
export const VISUAL_SYNONYM_CLUSTERS: ReadonlyArray<readonly string[]> = [
  ['whimsical', 'playful', 'mischievous', 'impish', 'elfin'],
  ['charm', 'energy', 'spirit', 'vibe', 'aura'],
  ['gentle', 'soft', 'delicate', 'tender', 'subtle'],
  ['vibrant', 'vivid', 'rich', 'saturated', 'intense'],
  ['cinematic', 'filmic', 'movie-like'],
  ['moody', 'atmospheric', 'brooding'],
  ['glow', 'radiance', 'luminescence'],
  ['dramatic', 'striking', 'bold'],
];

const synonymLookup = new Map<string, string>();
for (const cluster of VISUAL_SYNONYM_CLUSTERS) {
  const representative = cluster[0];
  if (!representative) continue;
  for (const token of cluster) {
    synonymLookup.set(token, representative);
  }
}

export function normalizeVisualSynonym(token: string): string {
  return synonymLookup.get(token) ?? token;
}
