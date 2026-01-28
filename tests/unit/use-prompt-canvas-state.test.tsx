import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePromptCanvasState } from '@features/prompt-optimizer/PromptCanvas/hooks/usePromptCanvasState';

describe('usePromptCanvasState', () => {
  it('initializes with expected defaults', () => {
    const { result } = renderHook(() => usePromptCanvasState());

    expect(result.current.state.showExportMenu).toBe(false);
    expect(result.current.state.rightPaneMode).toBe('refine');
    expect(result.current.state.showHighlights).toBe(true);
    expect(result.current.state.visualGenerateRequestId).toBe(0);
    expect(result.current.state.videoGenerateRequestId).toBe(0);
  });

  it('merges state updates', () => {
    const { result } = renderHook(() => usePromptCanvasState());

    act(() => {
      result.current.setState({ showLegend: true, hoveredSpanId: 'span-1' });
    });

    expect(result.current.state.showLegend).toBe(true);
    expect(result.current.state.hoveredSpanId).toBe('span-1');
  });

  it('increments request ids', () => {
    const { result } = renderHook(() => usePromptCanvasState());

    act(() => {
      result.current.incrementVisualRequestId();
      result.current.incrementVideoRequestId();
    });

    expect(result.current.state.visualGenerateRequestId).toBe(1);
    expect(result.current.state.videoGenerateRequestId).toBe(1);
  });
});
