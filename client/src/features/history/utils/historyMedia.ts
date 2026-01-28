import type { PromptHistoryEntry } from '@hooks/types';

export function resolveHistoryThumbnail(entry: PromptHistoryEntry): string | null {
  const versions = Array.isArray(entry.versions) ? entry.versions : [];
  for (let i = versions.length - 1; i >= 0; i -= 1) {
    const candidate = versions[i]?.preview?.imageUrl;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

export function hasVideoArtifact(entry: PromptHistoryEntry): boolean {
  const versions = Array.isArray(entry.versions) ? entry.versions : [];
  return versions.some((version) => {
    const url = version?.video?.videoUrl;
    return typeof url === 'string' && url.trim().length > 0;
  });
}

export function isRecentEntry(entry: PromptHistoryEntry, days: number = 7): boolean {
  if (!entry.timestamp) return false;
  const ms = Date.parse(entry.timestamp);
  if (Number.isNaN(ms)) return false;
  const diffMs = Date.now() - ms;
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}
