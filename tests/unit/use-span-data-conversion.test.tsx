import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSpanDataConversion } from '@features/prompt-optimizer/PromptCanvas/hooks/useSpanDataConversion';
import { useHighlightSourceSelection } from '@features/span-highlighting/hooks/useHighlightSourceSelection';
import {
  convertSpansDataToSpanData,
  convertHighlightSnapshotToSpanData,
  convertHighlightSnapshotToSourceSelectionOptions,
} from '@features/prompt-optimizer/PromptCanvas/utils/spanDataConversion';

vi.mock('@features/span-highlighting/hooks/useHighlightSourceSelection', () => ({
  useHighlightSourceSelection: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/PromptCanvas/utils/spanDataConversion', () => ({
  convertSpansDataToSpanData: vi.fn(),
  convertHighlightSnapshotToSpanData: vi.fn(),
  convertHighlightSnapshotToSourceSelectionOptions: vi.fn(),
}));

const mockUseHighlightSourceSelection = vi.mocked(useHighlightSourceSelection);
const mockConvertSpansDataToSpanData = vi.mocked(convertSpansDataToSpanData);
const mockConvertHighlightSnapshotToSpanData = vi.mocked(convertHighlightSnapshotToSpanData);
const mockConvertHighlightSnapshotToSourceSelectionOptions = vi.mocked(
  convertHighlightSnapshotToSourceSelectionOptions
);

describe('useSpanDataConversion', () => {
  it('converts spans and forwards options to highlight selection hook', () => {
    const draftSpans = { spans: [], meta: null, source: 'draft', timestamp: 1 };
    const refinedSpans = { spans: [], meta: null, source: 'refined', timestamp: 2 };
    const initialHighlights = { spans: [], signature: 'sig-1' };

    mockConvertSpansDataToSpanData
      .mockReturnValueOnce({ spans: [], source: 'draft' })
      .mockReturnValueOnce({ spans: [], source: 'refined' });
    mockConvertHighlightSnapshotToSourceSelectionOptions.mockReturnValue({
      spans: [],
      signature: 'sig-1',
    });
    mockConvertHighlightSnapshotToSpanData.mockReturnValue({ spans: [], source: 'initial' });

    mockUseHighlightSourceSelection.mockReturnValue({
      spans: [],
      meta: null,
      signature: 'sig-1',
      cacheId: 'uuid-1',
      source: 'persisted',
    });

    const { result } = renderHook(() =>
      useSpanDataConversion({
        draftSpans,
        refinedSpans,
        initialHighlights,
        isDraftReady: true,
        isRefining: false,
        promptUuid: 'uuid-1',
        displayedPrompt: 'Prompt',
        enableMLHighlighting: true,
        initialHighlightsVersion: 2,
      })
    );

    expect(mockConvertSpansDataToSpanData).toHaveBeenCalledWith(draftSpans);
    expect(mockConvertSpansDataToSpanData).toHaveBeenCalledWith(refinedSpans);
    expect(mockConvertHighlightSnapshotToSourceSelectionOptions).toHaveBeenCalledWith(initialHighlights);
    expect(mockUseHighlightSourceSelection).toHaveBeenCalledWith({
      draftSpans: { spans: [], source: 'draft' },
      refinedSpans: { spans: [], source: 'refined' },
      isDraftReady: true,
      isRefining: false,
      initialHighlights: { spans: [], signature: 'sig-1' },
      promptUuid: 'uuid-1',
      displayedPrompt: 'Prompt',
      enableMLHighlighting: true,
      initialHighlightsVersion: 2,
    });

    expect(result.current.convertedDraftSpans).toEqual({ spans: [], source: 'draft' });
    expect(result.current.convertedRefinedSpans).toEqual({ spans: [], source: 'refined' });
    expect(result.current.convertedInitialHighlights).toEqual({ spans: [], signature: 'sig-1' });
    expect(result.current.memoizedInitialHighlights).toEqual(
      expect.objectContaining({ signature: 'sig-1', source: 'persisted' })
    );
  });
});
