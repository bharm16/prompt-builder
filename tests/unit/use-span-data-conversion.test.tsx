import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSpanDataConversion } from '@features/prompt-optimizer/PromptCanvas/hooks/useSpanDataConversion';
import { useHighlightSourceSelection } from '@features/span-highlighting/hooks/useHighlightSourceSelection';
import { convertHighlightSnapshotToSourceSelectionOptions } from '@features/prompt-optimizer/PromptCanvas/utils/spanDataConversion';

vi.mock('@features/span-highlighting/hooks/useHighlightSourceSelection', () => ({
  useHighlightSourceSelection: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/PromptCanvas/utils/spanDataConversion', () => ({
  convertHighlightSnapshotToSourceSelectionOptions: vi.fn(),
}));

const mockUseHighlightSourceSelection = vi.mocked(useHighlightSourceSelection);
const mockConvertHighlightSnapshotToSourceSelectionOptions = vi.mocked(
  convertHighlightSnapshotToSourceSelectionOptions
);

describe('useSpanDataConversion', () => {
  it('converts persisted highlights and forwards them to the selector', () => {
    const initialHighlights = { spans: [], signature: 'sig-1' };

    mockConvertHighlightSnapshotToSourceSelectionOptions.mockReturnValue({
      spans: [],
      signature: 'sig-1',
    });

    mockUseHighlightSourceSelection.mockReturnValue({
      spans: [],
      meta: null,
      signature: 'sig-1',
      cacheId: 'uuid-1',
      source: 'persisted',
    });

    const { result } = renderHook(() =>
      useSpanDataConversion({
        initialHighlights,
        promptUuid: 'uuid-1',
        displayedPrompt: 'Prompt',
        enableMLHighlighting: true,
        initialHighlightsVersion: 2,
      })
    );

    expect(mockConvertHighlightSnapshotToSourceSelectionOptions).toHaveBeenCalledWith(
      initialHighlights
    );
    expect(mockUseHighlightSourceSelection).toHaveBeenCalledWith({
      initialHighlights: { spans: [], signature: 'sig-1' },
      promptUuid: 'uuid-1',
      displayedPrompt: 'Prompt',
      enableMLHighlighting: true,
      initialHighlightsVersion: 2,
    });
    expect(result.current.convertedInitialHighlights).toEqual({ spans: [], signature: 'sig-1' });
    expect(result.current.memoizedInitialHighlights).toEqual(
      expect.objectContaining({ signature: 'sig-1', source: 'persisted' })
    );
  });
});
