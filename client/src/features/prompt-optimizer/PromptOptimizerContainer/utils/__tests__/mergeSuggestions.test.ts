import { describe, expect, it } from 'vitest';
import type { SuggestionItem } from '@features/prompt-optimizer/PromptCanvas/types';
import { mergeSuggestions } from '../mergeSuggestions';

describe('mergeSuggestions', () => {
  it('deduplicates by lowercased trimmed text and preserves order', () => {
    const existing: SuggestionItem[] = [
      { text: 'Keep subject centered' },
      { text: '  Add camera motion  ' },
    ];
    const incoming: SuggestionItem[] = [
      { text: 'add camera motion' },
      { text: 'Increase depth of field' },
      { text: ' keep subject centered ' },
    ];

    const result = mergeSuggestions(existing, incoming);

    expect(result.map((item) => item.text)).toEqual([
      'Keep subject centered',
      '  Add camera motion  ',
      'Increase depth of field',
    ]);
  });

  it('skips empty or whitespace-only suggestions', () => {
    const existing: SuggestionItem[] = [{ text: '' }, { text: '   ' }];
    const incoming: SuggestionItem[] = [{ text: 'real' }, { text: '\n\t' }];

    const result = mergeSuggestions(existing, incoming);

    expect(result).toEqual([{ text: 'real' }]);
  });

  it('handles mixed valid and invalid entries', () => {
    const existing: SuggestionItem[] = [{}, { text: 'valid one' }];
    const incoming: SuggestionItem[] = [{ text: undefined }, { text: 'VALID ONE' }, { text: 'valid two' }];

    const result = mergeSuggestions(existing, incoming);

    expect(result).toEqual([{ text: 'valid one' }, { text: 'valid two' }]);
  });
});
