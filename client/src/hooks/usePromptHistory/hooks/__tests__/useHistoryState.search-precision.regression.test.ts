/**
 * Regression test: Sessions search must not match output prompt content.
 *
 * Searching "alt" returned unrelated sessions like "Car Chase" because
 * the filter matched substring occurrences in the full optimized output
 * prompt text (e.g., "alternative lighting"). Search should only match
 * the session title and input prompt, not the output.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHistoryState } from '../useHistoryState';
import type { PromptHistoryEntry } from '@/features/prompt-optimizer/types/domain/prompt-session';

const buildEntry = (
  id: string,
  input: string,
  output: string,
  title?: string
): PromptHistoryEntry =>
  ({
    id,
    uuid: `uuid-${id}`,
    input,
    output,
    title: title ?? '',
    mode: 'video',
    targetModel: 'sora-2',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }) as unknown as PromptHistoryEntry;

describe('regression: session search does not match output field', () => {
  it('excludes entries where only the output contains the query', () => {
    const entries = [
      buildEntry('1', 'A car chase through the city', 'Alternative angle of a dramatic car chase with cinematic lighting'),
      buildEntry('2', 'An altar in a cathedral', 'A stone altar bathed in golden light'),
      buildEntry('3', 'Man staring out a window', 'A melancholic scene with alternative color grading'),
    ];

    const { result } = renderHook(() => useHistoryState());

    act(() => {
      result.current.setHistory(entries);
      result.current.setSearchQuery('alt');
    });

    const filtered = result.current.filteredHistory;
    const ids = filtered.map((e: PromptHistoryEntry) => e.id);

    // "altar" contains "alt" in input — should match
    expect(ids).toContain('2');
    // "car chase" and "man staring" only have "alt" in output — should NOT match
    expect(ids).not.toContain('1');
    expect(ids).not.toContain('3');
  });
});
