import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePreviewGenerationState } from '@features/prompt-optimizer/PromptCanvas/hooks/usePreviewGenerationState';

describe('usePreviewGenerationState', () => {
  it('initializes with all previews set to false', () => {
    const { result } = renderHook(() => usePreviewGenerationState());

    expect(result.current.previewLoading).toEqual({
      visual: false,
      video: false,
      railVideo: false,
    });
  });

  it('updates preview loading flags', () => {
    const { result } = renderHook(() => usePreviewGenerationState());

    act(() => {
      result.current.setVisualPreviewGenerating(true);
      result.current.setVideoPreviewGenerating(true);
      result.current.setRailVideoPreviewGenerating(true);
    });

    expect(result.current.previewLoading).toEqual({
      visual: true,
      video: true,
      railVideo: true,
    });
  });
});
