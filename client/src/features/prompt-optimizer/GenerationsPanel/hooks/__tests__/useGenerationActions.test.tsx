import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ApiError } from '@/services/http/ApiError';
import { useGenerationActions } from '../useGenerationActions';

const compileWanPromptMock = vi.fn();
const generateVideoPreviewMock = vi.fn();
const generateStoryboardPreviewMock = vi.fn();
const waitForVideoJobMock = vi.fn();

vi.mock('../../api', () => ({
  compileWanPrompt: (...args: unknown[]) => compileWanPromptMock(...args),
  generateVideoPreview: (...args: unknown[]) => generateVideoPreviewMock(...args),
  generateStoryboardPreview: (...args: unknown[]) => generateStoryboardPreviewMock(...args),
  waitForVideoJob: (...args: unknown[]) => waitForVideoJobMock(...args),
}));

const getAction = (dispatch: ReturnType<typeof vi.fn>, type: string) =>
  dispatch.mock.calls
    .map((call) => call[0] as { type: string })
    .find((action) => action.type === type);

describe('useGenerationActions insufficient credits handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compileWanPromptMock.mockResolvedValue('compiled prompt');
  });

  it('removes draft generation and reports insufficient credits on 402', async () => {
    const dispatch = vi.fn();
    const onInsufficientCredits = vi.fn();
    generateVideoPreviewMock.mockRejectedValue(
      new ApiError('Insufficient credits', 402, { code: 'INSUFFICIENT_CREDITS' })
    );

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, { onInsufficientCredits })
    );

    await act(async () => {
      await result.current.generateDraft('wan-2.2', 'A test prompt', {});
    });

    const addAction = getAction(dispatch, 'ADD_GENERATION') as
      | { payload: { id: string } }
      | undefined;
    const removeAction = getAction(dispatch, 'REMOVE_GENERATION') as
      | { payload: { id: string } }
      | undefined;
    expect(addAction).toBeDefined();
    expect(removeAction).toBeDefined();
    expect(removeAction?.payload.id).toBe(addAction?.payload.id);
    expect(onInsufficientCredits).toHaveBeenCalledWith(5, 'WAN 2.2 preview');
  });

  it('removes storyboard generation and reports insufficient credits on 402', async () => {
    const dispatch = vi.fn();
    const onInsufficientCredits = vi.fn();
    generateStoryboardPreviewMock.mockRejectedValue(
      new ApiError('Insufficient credits', 402, { code: 'INSUFFICIENT_CREDITS' })
    );

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, { onInsufficientCredits })
    );

    await act(async () => {
      await result.current.generateStoryboard('Storyboard prompt', {});
    });

    const addAction = getAction(dispatch, 'ADD_GENERATION') as
      | { payload: { id: string } }
      | undefined;
    const removeAction = getAction(dispatch, 'REMOVE_GENERATION') as
      | { payload: { id: string } }
      | undefined;
    expect(addAction).toBeDefined();
    expect(removeAction).toBeDefined();
    expect(removeAction?.payload.id).toBe(addAction?.payload.id);
    expect(onInsufficientCredits).toHaveBeenCalledWith(4, 'Storyboard');
  });

  it('removes render generation and reports insufficient credits on 402', async () => {
    const dispatch = vi.fn();
    const onInsufficientCredits = vi.fn();
    generateVideoPreviewMock.mockRejectedValue(
      new ApiError('Insufficient credits', 402, { code: 'INSUFFICIENT_CREDITS' })
    );

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, { onInsufficientCredits })
    );

    await act(async () => {
      await result.current.generateRender('sora-2', 'Render prompt', {});
    });

    const addAction = getAction(dispatch, 'ADD_GENERATION') as
      | { payload: { id: string } }
      | undefined;
    const removeAction = getAction(dispatch, 'REMOVE_GENERATION') as
      | { payload: { id: string } }
      | undefined;
    expect(addAction).toBeDefined();
    expect(removeAction).toBeDefined();
    expect(removeAction?.payload.id).toBe(addAction?.payload.id);
    expect(onInsufficientCredits).toHaveBeenCalledWith(80, 'Sora render');
  });

  it('keeps normal error flow for non-402 failures', async () => {
    const dispatch = vi.fn();
    const onInsufficientCredits = vi.fn();
    generateVideoPreviewMock.mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() =>
      useGenerationActions(dispatch, { onInsufficientCredits })
    );

    await act(async () => {
      await result.current.generateRender('sora-2', 'Render prompt', {});
    });

    expect(getAction(dispatch, 'REMOVE_GENERATION')).toBeUndefined();
    expect(onInsufficientCredits).not.toHaveBeenCalled();
    const updateActions = dispatch.mock.calls
      .map((call) => call[0] as { type: string; payload?: { updates?: { status?: string } } })
      .filter((action) => action.type === 'UPDATE_GENERATION');
    expect(updateActions.some((action) => action.payload?.updates?.status === 'failed')).toBe(
      true
    );
  });
});
