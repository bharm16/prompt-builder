import React, { useEffect, useMemo, useRef, useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';

import { useSuggestionFetch } from '@features/prompt-optimizer/PromptOptimizerContainer/hooks/useSuggestionFetch';
import { useTextSelection } from '@features/prompt-optimizer/PromptCanvas/hooks/useTextSelection';
import { fetchEnhancementSuggestions } from '@features/prompt-optimizer/api/enhancementSuggestionsApi';
import type { SuggestionsData } from '@features/prompt-optimizer/PromptCanvas/types';
import type { Toast } from '@hooks/types';
import { createCanonicalText } from '../../client/src/utils/canonicalText';

vi.mock('@features/prompt-optimizer/api/enhancementSuggestionsApi', () => ({
  fetchEnhancementSuggestions: vi.fn().mockResolvedValue({
    suggestions: ['stub'],
    isPlaceholder: false,
  }),
  enhancementSuggestionsApi: {
    fetchEnhancementSuggestions: vi.fn(),
  },
}));

const promptText = 'The park is sunny today.';
const spanContext = [
  {
    id: 'span-1',
    start: 4,
    end: 8,
    role: 'environment.location',
    category: 'environment.location',
    quote: 'park',
    confidence: 0.9,
  },
  {
    id: 'span-2',
    start: 12,
    end: 17,
    role: 'style.aesthetic',
    category: 'style.aesthetic',
    quote: 'sunny',
    confidence: 0.7,
  },
];

function SuggestionFlowHarness(): React.ReactElement {
  const editorRef = useRef<HTMLDivElement>(null);
  const [suggestionsData, setSuggestionsData] = useState<SuggestionsData | null>(null);
  const toast = useMemo(
    () =>
      ({
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
      }) as Toast,
    []
  );

  const promptOptimizer = useMemo(
    () => ({
      displayedPrompt: promptText,
      inputPrompt: promptText,
      setDisplayedPrompt: vi.fn(),
      setOptimizedPrompt: vi.fn(),
    }),
    []
  );

  const parseResult = useMemo(
    () => ({
      canonical: createCanonicalText(promptText),
      spans: spanContext,
      meta: null,
      status: 'success' as const,
      error: null,
      displayText: promptText,
    }),
    []
  );

  const { fetchEnhancementSuggestions: triggerFetch } = useSuggestionFetch({
    promptOptimizer,
    selectedMode: 'video',
    suggestionsData,
    setSuggestionsData,
    stablePromptContext: null,
    toast,
    handleSuggestionClick: async () => {},
  });

  const { handleHighlightClick } = useTextSelection({
    selectedMode: 'video',
    editorRef,
    displayedPrompt: promptText,
    parseResult,
    onFetchSuggestions: triggerFetch,
  });

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    editorRef.current.innerHTML = [
      'The ',
      '<span class="value-word" ',
      'data-span-id="span-1" ',
      'data-category="environment.location" ',
      'data-start="4" ',
      'data-end="8" ',
      'data-quote="park" ',
      'data-confidence="0.9"',
      '>park</span>',
      ' is sunny today.',
    ].join('');
  }, []);

  return <div ref={editorRef} onClick={handleHighlightClick} />;
}

describe('Suggestion flow', () => {
  const fetchMock = vi.mocked(fetchEnhancementSuggestions);

  beforeEach(() => {
    fetchMock.mockClear();
  });

  it('passes normalized span context to suggestion API on highlight click', async () => {
    const { container } = render(<SuggestionFlowHarness />);
    const highlight = container.querySelector('.value-word');
    expect(highlight).not.toBeNull();

    fireEvent.click(highlight as Element);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const payload = fetchMock.mock.calls[0]?.[0];
    expect(payload?.highlightedText).toBe('park');
    expect(payload?.allLabeledSpans).toEqual([
      {
        text: 'park',
        role: 'environment.location',
        category: 'environment.location',
        confidence: 0.9,
        start: 4,
        end: 8,
      },
      {
        text: 'sunny',
        role: 'style.aesthetic',
        category: 'style.aesthetic',
        confidence: 0.7,
        start: 12,
        end: 17,
      },
    ]);
    expect(payload?.nearbySpans).toEqual([
      expect.objectContaining({
        text: 'sunny',
        position: 'after',
        start: 12,
        end: 17,
      }),
    ]);
  });
});
