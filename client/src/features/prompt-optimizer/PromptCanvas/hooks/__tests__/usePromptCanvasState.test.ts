import { describe, expect, it } from 'vitest';
import {
  initialPromptCanvasState,
  promptCanvasReducer,
} from '../usePromptCanvasState';

describe('usePromptCanvasState reducer', () => {
  it('exposes expected initial state', () => {
    expect(initialPromptCanvasState).toMatchObject({
      showExportMenu: false,
      showLegend: false,
      rightPaneMode: 'refine',
      showHighlights: true,
      selectedSpanId: null,
      promptState: 'generated',
    });
  });

  it('MERGE_STATE returns same reference when payload does not change values', () => {
    const state = initialPromptCanvasState;
    const next = promptCanvasReducer(state, {
      type: 'MERGE_STATE',
      payload: { showLegend: false, promptState: 'generated' },
    });

    expect(next).toBe(state);
  });

  it('MERGE_STATE updates changed fields only', () => {
    const state = initialPromptCanvasState;
    const next = promptCanvasReducer(state, {
      type: 'MERGE_STATE',
      payload: { showLegend: true, selectedSpanId: 'span-1' },
    });

    expect(next).toEqual({
      ...state,
      showLegend: true,
      selectedSpanId: 'span-1',
    });
  });

  it('increments visual and video request ids', () => {
    const afterVisual = promptCanvasReducer(initialPromptCanvasState, {
      type: 'INCREMENT_VISUAL_REQUEST_ID',
    });
    const afterVideo = promptCanvasReducer(afterVisual, {
      type: 'INCREMENT_VIDEO_REQUEST_ID',
    });

    expect(afterVisual.visualGenerateRequestId).toBe(1);
    expect(afterVideo.videoGenerateRequestId).toBe(1);
  });

  it('returns unchanged state for unknown actions', () => {
    const state = initialPromptCanvasState;
    const next = promptCanvasReducer(
      state,
      { type: 'UNKNOWN_ACTION' } as never
    );

    expect(next).toBe(state);
  });
});
