/**
 * FNV-1a hash for highlight-cache signatures.
 *
 * MUST produce byte-identical output to
 * client/src/features/span-highlighting/utils/hashing.ts. Migration scripts
 * write Firestore cache keys that the runtime client reads — divergence
 * means migrations are silently writing to keys the runtime never matches.
 *
 * Bumping the algorithm requires bumping the cache version on both sides.
 */
export function hashString(str: string): string {
  if (typeof str !== "string" || !str) return "0";

  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // FNV prime: 16777619
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(36);
}
