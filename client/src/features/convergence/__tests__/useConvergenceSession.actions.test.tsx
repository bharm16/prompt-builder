import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useConvergenceSessionActions } from '../hooks/useConvergenceSession.actions';
import { initialState } from '../hooks/useConvergenceSession.state';
import type { ConvergenceState } from '../hooks/useConvergenceSession.types';
import type { GeneratedImage, LockedDimension, FinalizeSessionResponse } from '../types';
import { getOptionsForDimension } from '../hooks/useConvergenceSession.options';
import { convergenceApi } from '../api/convergenceApi';
import { handleApiError } from '../hooks/useConvergenceSession.errorHandler';

vi.mock('../api/convergenceApi', () => ({
  convergenceApi: {
    startSession: vi.fn(),
    setStartingPoint: vi.fn(),
    selectOption: vi.fn(),
    regenerate: vi.fn(),
    generateCameraMotion: vi.fn(),
    selectCameraMotion: vi.fn(),
    generateSubjectMotion: vi.fn(),
    generateFinalFrame: vi.fn(),
    regenerateFinalFrame: vi.fn(),
    finalizeSession: vi.fn(),
    abandonSession: vi.fn(),
  },
}));

vi.mock('../hooks/useConvergenceSession.errorHandler', () => ({
  handleApiError: vi.fn(),
}));

const mockApi = vi.mocked(convergenceApi);
const mockHandleApiError = vi.mocked(handleApiError);

const createState = (overrides: Partial<ConvergenceState> = {}): ConvergenceState => ({
  ...initialState,
  regenerationCounts: new Map(initialState.regenerationCounts),
  imageHistory: new Map(initialState.imageHistory),
  ...overrides,
});

const createImage = (optionId: string): GeneratedImage => ({
  id: `img-${optionId}`,
  url: `https://example.com/${optionId}.png`,
  dimension: 'direction',
  optionId,
  prompt: optionId,
  generatedAt: new Date('2024-01-01T00:00:00Z'),
});

// ============================================================================
// useConvergenceSession.actions
// ============================================================================

describe('useConvergenceSessionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('dispatches a generic error when starting point mode lacks a session', async () => {
      const dispatch = vi.fn();
      const state = createState();

      const { result } = renderHook(() => useConvergenceSessionActions(state, dispatch));

      await act(async () => {
        await result.current.setStartingPoint('quick');
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'GENERIC_ERROR',
        payload: 'No active session',
      });
      expect(mockApi.setStartingPoint).not.toHaveBeenCalled();
    });

    it('dispatches a generic error when upload mode is missing an image', async () => {
      const dispatch = vi.fn();
      const state = createState({ sessionId: 'session-1' });

      const { result } = renderHook(() => useConvergenceSessionActions(state, dispatch));

      await act(async () => {
        await result.current.setStartingPoint('upload');
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'GENERIC_ERROR',
        payload: 'Please upload an image',
      });
      expect(mockApi.setStartingPoint).not.toHaveBeenCalled();
    });

    it('dispatches cancel generation when startSession is aborted', async () => {
      const dispatch = vi.fn();
      const state = createState();
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      mockApi.startSession.mockRejectedValueOnce(abortError);

      const { result } = renderHook(() => useConvergenceSessionActions(state, dispatch));

      await act(async () => {
        await result.current.startSession('Test intent');
      });

      expect(dispatch).toHaveBeenCalledWith({ type: 'CANCEL_GENERATION' });
      expect(mockHandleApiError).not.toHaveBeenCalled();
    });

    it('prevents regeneration outside of dimension steps', async () => {
      const dispatch = vi.fn();
      const state = createState({ sessionId: 'session-1', step: 'intent' });

      const { result } = renderHook(() => useConvergenceSessionActions(state, dispatch));

      await act(async () => {
        await result.current.regenerate();
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'GENERIC_ERROR',
        payload: 'Cannot regenerate at this step',
      });
      expect(mockApi.regenerate).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('restores cached images when selecting the same option', async () => {
      const dispatch = vi.fn();
      const cachedImage = createImage('mood-a');
      const cachedImages = [cachedImage];
      const imageHistory = new Map(initialState.imageHistory);
      imageHistory.set('mood', cachedImages);

      const state = createState({
        sessionId: 'session-1',
        direction: 'cinematic',
        imageHistory,
      });

      const { result } = renderHook(() => useConvergenceSessionActions(state, dispatch));

      await act(async () => {
        await result.current.selectOption('direction', 'cinematic');
      });

      expect(mockApi.selectOption).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith({
        type: 'RESTORE_CACHED_IMAGES',
        payload: {
          dimension: 'mood',
          images: cachedImages,
          options: getOptionsForDimension('mood'),
        },
      });
    });

    it('filters locked dimensions when jumping backward in the flow', () => {
      const dispatch = vi.fn();
      const lockedDimensions: LockedDimension[] = [
        {
          type: 'direction',
          optionId: 'cinematic',
          label: 'Cinematic',
          promptFragments: ['cinematic'],
        },
        {
          type: 'framing',
          optionId: 'wide',
          label: 'Wide',
          promptFragments: ['wide'],
        },
      ];

      const state = createState({
        sessionId: 'session-1',
        lockedDimensions,
        startingPointMode: null,
      });

      const { result } = renderHook(() => useConvergenceSessionActions(state, dispatch));

      act(() => {
        result.current.jumpToStep('mood');
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'JUMP_TO_STEP',
        payload: {
          step: 'mood',
          lockedDimensions: [lockedDimensions[0]],
        },
      });
    });
  });

  describe('core behavior', () => {
    it('dispatches start session success with mapped options', async () => {
      const dispatch = vi.fn();
      const state = createState();
      const sessionImage = createImage('cinematic');

      mockApi.startSession.mockResolvedValueOnce({
        sessionId: 'session-1',
        images: [sessionImage],
        currentDimension: 'direction',
        options: [
          { id: 'cinematic', label: 'Cinematic' },
          { id: 'social', label: 'Social' },
        ],
        estimatedCost: 24,
      });

      const { result } = renderHook(() => useConvergenceSessionActions(state, dispatch));

      await act(async () => {
        await result.current.startSession('A test prompt');
      });

      expect(dispatch).toHaveBeenCalledWith({
        type: 'START_SESSION_SUCCESS',
        payload: {
          sessionId: 'session-1',
          images: [sessionImage],
          options: [
            { id: 'cinematic', label: 'Cinematic' },
            { id: 'social', label: 'Social' },
          ],
        },
      });
    });

    it('returns finalize results and dispatches success', async () => {
      const dispatch = vi.fn();
      const state = createState({ sessionId: 'session-1' });
      let finalizeResult: FinalizeSessionResponse | null = null;

      const lockedDimensions: LockedDimension[] = [
        {
          type: 'direction',
          optionId: 'cinematic',
          label: 'Cinematic',
          promptFragments: ['cinematic'],
        },
      ];

      mockApi.finalizeSession.mockResolvedValueOnce({
        sessionId: 'session-1',
        finalPrompt: 'Final prompt',
        lockedDimensions,
        previewImageUrl: 'https://example.com/preview.png',
        cameraMotion: 'static',
        subjectMotion: 'none',
        totalCreditsConsumed: 12,
        generationCosts: { total: 12 },
      });

      const { result } = renderHook(() => useConvergenceSessionActions(state, dispatch));

      await act(async () => {
        finalizeResult = await result.current.finalize();
      });

      expect(finalizeResult).toEqual({
        sessionId: 'session-1',
        finalPrompt: 'Final prompt',
        lockedDimensions,
        previewImageUrl: 'https://example.com/preview.png',
        cameraMotion: 'static',
        subjectMotion: 'none',
        totalCreditsConsumed: 12,
        generationCosts: { total: 12 },
      });
      expect(dispatch).toHaveBeenCalledWith({
        type: 'FINALIZE_SUCCESS',
        payload: {
          finalPrompt: 'Final prompt',
          lockedDimensions,
        },
      });
    });
  });
});
