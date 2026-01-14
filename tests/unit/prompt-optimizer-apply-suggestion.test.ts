import { describe, expect, it, vi } from 'vitest';

import { applySuggestionToPrompt } from '@features/prompt-optimizer/utils/applySuggestion';
import { relocateQuote } from '@utils/textQuoteRelocator';

vi.mock('@utils/textQuoteRelocator', () => ({
  relocateQuote: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({ warn: vi.fn() }),
  },
}));

const mockRelocateQuote = vi.mocked(relocateQuote);

describe('applySuggestionToPrompt', () => {
  it('returns null when prompt or suggestion is empty', () => {
    expect(
      applySuggestionToPrompt({
        prompt: 'Hello',
        suggestionText: '',
      })
    ).toEqual({ updatedPrompt: null });
  });

  it('applies suggestion using relocated match', () => {
    mockRelocateQuote.mockReturnValue({ start: 6, end: 11, exact: true });

    const result = applySuggestionToPrompt({
      prompt: 'Hello world',
      suggestionText: 'there',
      highlight: 'world',
      spanMeta: { idempotencyKey: 'key-1' },
    });

    expect(result).toEqual({
      updatedPrompt: 'Hello there',
      replacementTarget: 'world',
      idempotencyKey: 'key-1',
      matchStart: 6,
      matchEnd: 11,
    });
  });

  it('returns null when relocation fails', () => {
    mockRelocateQuote.mockReturnValue(null);

    const result = applySuggestionToPrompt({
      prompt: 'Hello world',
      suggestionText: 'there',
      highlight: 'world',
    });

    expect(result).toEqual({ updatedPrompt: null });
  });

  it('returns null when suggestion does not change prompt', () => {
    mockRelocateQuote.mockReturnValue({ start: 0, end: 5, exact: true });

    const result = applySuggestionToPrompt({
      prompt: 'Hello',
      suggestionText: 'Hello',
    });

    expect(result).toEqual({ updatedPrompt: null });
  });
});
