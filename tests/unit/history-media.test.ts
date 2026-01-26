import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  resolveHistoryThumbnail,
  hasVideoArtifact,
  isRecentEntry,
} from '@features/history/utils/historyMedia';
import type { PromptHistoryEntry } from '@hooks/types';

const createEntry = (overrides: Partial<PromptHistoryEntry> = {}): PromptHistoryEntry => ({
  input: 'input',
  output: 'output',
  ...overrides,
});

describe('historyMedia', () => {
  const baseTime = new Date('2024-05-10T12:00:00Z');

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
          { preview: { imageUrl: '   ' } },
          { preview: { imageUrl: '' } },
        ],
      });

      expect(resolveHistoryThumbnail(entry)).toBeNull();
    });

    it('returns false when timestamps are missing or invalid', () => {
      expect(isRecentEntry(createEntry({ timestamp: undefined }))).toBe(false);
      expect(isRecentEntry(createEntry({ timestamp: 'not-a-date' }))).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns the most recent valid preview image', () => {
      const entry = createEntry({
        versions: [
          { preview: { imageUrl: 'https://cdn.example.com/first.png' } },
          { preview: { imageUrl: '  ' } },
          { preview: { imageUrl: 'https://cdn.example.com/last.png' } },
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
          { video: { videoUrl: '   ' } },
          { video: { videoUrl: ' https://cdn.example.com/video.mp4 ' } },
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
