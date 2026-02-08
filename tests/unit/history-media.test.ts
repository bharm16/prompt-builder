import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  resolveHistoryThumbnail,
  hasVideoArtifact,
  isRecentEntry,
} from '@features/history/utils/historyMedia';
import type { PromptHistoryEntry, PromptVersionEntry } from '@hooks/types';

const createEntry = (overrides: Partial<PromptHistoryEntry> = {}): PromptHistoryEntry => ({
  input: 'input',
  output: 'output',
  ...overrides,
});

const createVersionEntry = (overrides: Partial<PromptVersionEntry> = {}): PromptVersionEntry => {
  const base: PromptVersionEntry = {
    versionId: 'v1',
    signature: 'sig',
    prompt: 'prompt',
    timestamp: '2024-05-01T00:00:00.000Z',
  };
  return { ...base, ...overrides };
};

describe('historyMedia', () => {
  const baseTime = new Date('2024-05-10T12:00:00Z');
  const generatedAt = '2024-05-01T00:00:00.000Z';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('returns null when no preview images are available', () => {
      const entry = createEntry({
        versions: [
          createVersionEntry({ preview: { generatedAt, imageUrl: '   ' } }),
          createVersionEntry({ versionId: 'v2', preview: { generatedAt, imageUrl: '' } }),
        ],
      });

      expect(resolveHistoryThumbnail(entry)).toBeNull();
    });

    it('returns false when timestamps are missing or invalid', () => {
      expect(isRecentEntry(createEntry())).toBe(false);
      expect(isRecentEntry(createEntry({ timestamp: 'not-a-date' }))).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns the most recent valid preview image', () => {
      const entry = createEntry({
        versions: [
          createVersionEntry({ preview: { generatedAt, imageUrl: 'https://cdn.example.com/first.png' } }),
          createVersionEntry({ versionId: 'v2', preview: { generatedAt, imageUrl: '  ' } }),
          createVersionEntry({ versionId: 'v3', preview: { generatedAt, imageUrl: 'https://cdn.example.com/last.png' } }),
        ],
      });

      expect(resolveHistoryThumbnail(entry)).toBe('https://cdn.example.com/last.png');
    });

    it('treats future timestamps as not recent', () => {
      const future = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000).toISOString();

      expect(isRecentEntry(createEntry({ timestamp: future }))).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('detects video artifacts with trimmed URLs', () => {
      const entry = createEntry({
        versions: [
          createVersionEntry({ video: { generatedAt, videoUrl: '   ' } }),
          createVersionEntry({ versionId: 'v2', video: { generatedAt, videoUrl: ' https://cdn.example.com/video.mp4 ' } }),
        ],
      });

      expect(hasVideoArtifact(entry)).toBe(true);
    });

    it('identifies entries within the recent window', () => {
      const recent = new Date(baseTime.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const older = new Date(baseTime.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

      expect(isRecentEntry(createEntry({ timestamp: recent }))).toBe(true);
      expect(isRecentEntry(createEntry({ timestamp: older }))).toBe(false);
    });
  });
});
