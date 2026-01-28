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
        { id: 'target', start: 0, end: 5, displayStart: 0, displayEnd: 5 },
        { id: 'shift', start: 6, end: 11, displayStart: 6, displayEnd: 11 },
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
      targetSpanId: 'target',
    });

    expect(result).not.toBeNull();
    expect(result?.spans).toEqual([
      { id: 'target', start: 0, end: 3, displayStart: 0, displayEnd: 3 },
      { id: 'shift', start: 4, end: 9, displayStart: 4, displayEnd: 9 },
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
        { id: 'target', start: 0, end: 5 },
        { id: 'overlap', start: 3, end: 7 },
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
      targetSpanId: 'target',
    });

    expect(result?.spans).toHaveLength(1);
    expect(result?.spans[0]?.id).toBe('target');
  });
});
