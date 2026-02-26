import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { updateHighlightSnapshotForSuggestion } from '@features/prompt-optimizer/utils/updateHighlightSnapshot';
import { createHighlightSignature } from '@features/span-highlighting';
import type { HighlightSnapshot } from '@features/prompt-optimizer/PromptCanvas/types';

vi.mock('@features/span-highlighting', () => ({
  createHighlightSignature: vi.fn(),
}));

const mockCreateHighlightSignature = vi.mocked(createHighlightSignature);

describe('updateHighlightSnapshotForSuggestion', () => {
  beforeEach(() => {
    mockCreateHighlightSignature.mockReturnValue('signature');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates target span and shifts following spans', () => {
    const snapshot: HighlightSnapshot = {
      spans: [
        {
          start: 0,
          end: 5,
          category: 'subject',
          confidence: 0.9,
        },
        {
          start: 6,
          end: 11,
          category: 'subject',
          confidence: 0.8,
        },
      ],
      meta: null,
      signature: 'old',
    };

    const result = updateHighlightSnapshotForSuggestion({
      snapshot,
      matchStart: 0,
      matchEnd: 5,
      replacementText: 'hey',
      nextPrompt: 'hey world',
      targetStart: 0,
      targetEnd: 5,
      targetCategory: 'subject',
    });

    expect(result).not.toBeNull();
    expect(result?.spans).toEqual([
      {
        start: 0,
        end: 3,
        category: 'subject',
        confidence: 0.9,
      },
      {
        start: 4,
        end: 9,
        category: 'subject',
        confidence: 0.8,
      },
    ]);
    expect(result?.signature).toBe('signature');
    expect(result?.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result?.meta).toEqual(
      expect.objectContaining({
        version: expect.any(String),
        localUpdate: true,
      })
    );
  });

  it('returns null for invalid inputs', () => {
    const snapshot: HighlightSnapshot = {
      spans: [],
      meta: null,
      signature: 'old',
    };

    expect(
      updateHighlightSnapshotForSuggestion({
        snapshot,
        matchStart: null,
        matchEnd: 5,
        replacementText: 'hey',
        nextPrompt: 'hey',
      })
    ).toBeNull();
  });

  it('drops overlapping spans that are not the target', () => {
    const snapshot: HighlightSnapshot = {
      spans: [
        { start: 0, end: 5, category: 'subject', confidence: 0.9 },
        { start: 3, end: 7, category: 'subject', confidence: 0.8 },
      ],
      meta: null,
      signature: 'old',
    };

    const result = updateHighlightSnapshotForSuggestion({
      snapshot,
      matchStart: 0,
      matchEnd: 5,
      replacementText: 'hello',
      nextPrompt: 'hello world',
      targetStart: 0,
      targetEnd: 5,
      targetCategory: 'subject',
    });

    expect(result?.spans).toHaveLength(1);
    expect(result?.spans[0]?.start).toBe(0);
    expect(result?.spans[0]?.end).toBe(5);
  });
});
