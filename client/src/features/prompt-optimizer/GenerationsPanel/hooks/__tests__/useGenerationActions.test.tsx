import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ApiError } from '@/services/http/ApiError';
import { clearVideoInputSupportCache } from '../../utils/videoInputSupport';
import { useGenerationActions } from '../useGenerationActions';

const compileWanPromptMock = vi.fn();
const generateVideoPreviewMock = vi.fn();
const generateStoryboardPreviewMock = vi.fn();
const waitForVideoJobMock = vi.fn();
const getCapabilitiesMock = vi.fn();

vi.mock('@/services', () => ({
  capabilitiesApi: {
    getCapabilities: (...args: unknown[]) => getCapabilitiesMock(...args),
  },
}));

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

const getActions = (dispatch: ReturnType<typeof vi.fn>, type: string) =>
  dispatch.mock.calls
    .map((call) => call[0] as { type: string; payload?: unknown })
    .filter((action) => action.type === type);

beforeEach(() => {
  clearVideoInputSupportCache();
  getCapabilitiesMock.mockResolvedValue({
    provider: 'generic',
    model: 'wan-2.2',
    version: '1',
    fields: {},
  });
});

describe('useGenerationActions insufficient credits handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compileWanPromptMock.mockResolvedValue('compiled prompt');
    getCapabilitiesMock.mockResolvedValue({
      provider: 'generic',
      model: 'wan-2.2',
      version: '1',
      fields: {},
    });
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

describe('useGenerationActions cancellation behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCapabilitiesMock.mockResolvedValue({
      provider: 'generic',
      model: 'wan-2.2',
      version: '1',
      fields: {},
    });
  });

  it('marks in-flight draft generation as cancelled and aborts compile work', async () => {
    const dispatch = vi.fn();

    compileWanPromptMock.mockImplementation(
      (_prompt: string, signal: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    const { result } = renderHook(() => useGenerationActions(dispatch));

    let draftPromise: Promise<void> | undefined;
    act(() => {
      draftPromise = result.current.generateDraft('wan-2.2', 'A cinematic test prompt', {});
    });

    const addAction = getAction(dispatch, 'ADD_GENERATION') as
      | { payload: { id: string } }
      | undefined;
    expect(addAction?.payload.id).toBeDefined();

    const generationId = addAction?.payload.id;
    if (!generationId) {
      throw new Error('Expected generation id to be present');
    }

    await act(async () => {
      result.current.cancelGeneration(generationId);
      await draftPromise;
    });

    const updateActions = getActions(dispatch, 'UPDATE_GENERATION') as Array<{
      payload?: { id?: string; updates?: { status?: string; error?: string } };
    }>;

    expect(
      updateActions.some(
        (action) =>
          action.payload?.id === generationId &&
          action.payload?.updates?.status === 'failed' &&
          action.payload?.updates?.error === 'Cancelled'
      )
    ).toBe(true);
    expect(compileWanPromptMock).toHaveBeenCalled();
    expect((compileWanPromptMock.mock.calls[0]?.[1] as AbortSignal).aborted).toBe(true);
    expect(generateVideoPreviewMock).not.toHaveBeenCalled();
  });
});

describe('useGenerationActions dispatch-model capability filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compileWanPromptMock.mockResolvedValue('compiled prompt');
    generateVideoPreviewMock.mockResolvedValue({
      success: true,
      videoUrl: 'https://example.com/output.mp4',
    });
  });

  it('drops end/reference/extend fields when dispatch model does not support them', async () => {
    getCapabilitiesMock.mockResolvedValue({
      provider: 'generic',
      model: 'wan-2.2',
      version: '1',
      fields: {},
    });

    const dispatch = vi.fn();
    const { result } = renderHook(() => useGenerationActions(dispatch));

    await act(async () => {
      await result.current.generateDraft('wan-2.2', 'A test prompt', {
        endImage: { url: 'https://example.com/end.png' },
        referenceImages: [
          { url: 'https://example.com/ref.png', type: 'asset' },
        ],
        extendVideoUrl: 'https://example.com/source.mp4',
      });
    });

    const requestOptions = generateVideoPreviewMock.mock.calls[0]?.[3] as
      | Record<string, unknown>
      | undefined;

    expect(requestOptions).toBeDefined();
    expect(requestOptions).not.toHaveProperty('endImage');
    expect(requestOptions).not.toHaveProperty('referenceImages');
    expect(requestOptions).not.toHaveProperty('extendVideoUrl');
    expect(getCapabilitiesMock).toHaveBeenCalledWith('generic', 'wan-2.2');
  });

  it('includes end/reference/extend fields when dispatch model supports them', async () => {
    getCapabilitiesMock.mockResolvedValue({
      provider: 'generic',
      model: 'google/veo-3',
      version: '1',
      fields: {
        last_frame: { type: 'bool', default: true },
        reference_images: { type: 'bool', default: true },
        extend_video: { type: 'bool', default: true },
      },
    });

    const dispatch = vi.fn();
    const { result } = renderHook(() => useGenerationActions(dispatch));

    await act(async () => {
      await result.current.generateRender('google/veo-3', 'Render prompt', {
        endImage: { url: 'https://example.com/end.png' },
        referenceImages: [
          { url: 'https://example.com/ref-1.png', type: 'asset' },
          { url: 'https://example.com/ref-2.png', type: 'style' },
        ],
        extendVideoUrl: 'https://example.com/source.mp4',
      });
    });

    const requestOptions = generateVideoPreviewMock.mock.calls[0]?.[3] as
      | {
          endImage?: string;
          referenceImages?: Array<{ url: string; type: 'asset' | 'style' }>;
          extendVideoUrl?: string;
        }
      | undefined;

    expect(requestOptions?.endImage).toBe('https://example.com/end.png');
    expect(requestOptions?.referenceImages).toEqual([
      { url: 'https://example.com/ref-1.png', type: 'asset' },
      { url: 'https://example.com/ref-2.png', type: 'style' },
    ]);
    expect(requestOptions?.extendVideoUrl).toBe('https://example.com/source.mp4');
    expect(getCapabilitiesMock).toHaveBeenCalledWith('generic', 'google/veo-3');
  });

  it('caches capability lookups per dispatch model', async () => {
    getCapabilitiesMock.mockResolvedValue({
      provider: 'generic',
      model: 'wan-2.2',
      version: '1',
      fields: {},
    });

    const dispatch = vi.fn();
    const { result } = renderHook(() => useGenerationActions(dispatch));

    await act(async () => {
      await result.current.generateDraft('wan-2.2', 'Prompt one', {});
      await result.current.generateDraft('wan-2.2', 'Prompt two', {});
    });

    expect(getCapabilitiesMock).toHaveBeenCalledTimes(1);
    expect(getCapabilitiesMock).toHaveBeenCalledWith('generic', 'wan-2.2');
  });
});
