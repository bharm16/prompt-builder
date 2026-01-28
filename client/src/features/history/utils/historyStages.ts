import type { PromptHistoryEntry } from '@hooks/types';
import type { PromptRowStage } from '../types';

export function resolveEntryStage(entry: PromptHistoryEntry): PromptRowStage {
  const hasInput = typeof entry.input === 'string' && entry.input.trim().length > 0;
  const hasOutput = typeof entry.output === 'string' && entry.output.trim().length > 0;
  if (!hasInput && !hasOutput) return 'draft';
  if (hasInput && !hasOutput) return 'draft';
  if (!hasOutput) return 'error';
  if (entry.highlightCache) return 'generated';
  return 'optimized';
}

export function formatModelLabel(
  targetModel: string | null | undefined
): string | null {
  if (!targetModel || !targetModel.trim()) return null;
  const normalized = targetModel.trim().replace(/\s+/g, ' ');
  const veoMatch = normalized.match(/(veo[-\s]?\d+(?:\.\d+)?)/i);
  if (veoMatch?.[1]) {
    return veoMatch[1].replace(/\s+/g, '-').toLowerCase();
  }
  if (normalized.length <= 14) return normalized;
  return normalized.split(' ')[0] ?? normalized;
}

export function normalizeProcessingLabel(label: string): string | null {
  const raw = label.trim();
  if (!raw) return null;
  if (raw.endsWith('...')) return raw;
  return `${raw}...`;
}
