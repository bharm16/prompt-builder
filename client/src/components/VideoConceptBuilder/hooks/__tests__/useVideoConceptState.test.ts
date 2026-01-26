import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Dispatch } from 'react';

import { useVideoConceptState } from '../useVideoConceptState';
import type { VideoConceptAction } from '../types';

function dispatchAction(
  dispatch: Dispatch<VideoConceptAction>,
  action: VideoConceptAction
): void {
  act(() => {
    dispatch(action);
  });
}

describe('useVideoConceptState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('ignores non-string values in SET_ELEMENTS payload', () => {
      const { result } = renderHook(() => useVideoConceptState());
      const [, dispatch] = result.current;

      dispatchAction(dispatch, {
        type: 'SET_ELEMENTS',
        payload: {
          subject: 123 as unknown as string,
          action: undefined as unknown as string,
        },
      });

      expect(result.current[0].elements.subject).toBe('');
      expect(result.current[0].elements.action).toBe('');
    });

    it('no-ops when APPLY_ELEMENTS receives a falsy payload', () => {
      const { result } = renderHook(() => useVideoConceptState());
      const [, dispatch] = result.current;

      dispatchAction(dispatch, {
        type: 'APPLY_ELEMENTS',
        payload: null as unknown as { subject: string },
      });

      expect(result.current[0].elements.subject).toBe('');
    });
  });

  describe('edge cases', () => {
    it('decomposes subject string into base subject and descriptors', () => {
      const { result } = renderHook(() => useVideoConceptState());
      const [, dispatch] = result.current;

      dispatchAction(dispatch, {
        type: 'APPLY_ELEMENTS',
        payload: { subject: 'cat with hat, wearing coat' },
      });

      expect(result.current[0].elements.subject).toBe('cat');
      expect(result.current[0].elements.subjectDescriptor1).toBe('with hat');
      expect(result.current[0].elements.subjectDescriptor2).toBe('wearing coat');
    });

    it('normalizes subjectDescriptors array values when applying elements', () => {
      const { result } = renderHook(() => useVideoConceptState());
      const [, dispatch] = result.current;

      dispatchAction(dispatch, {
        type: 'APPLY_ELEMENTS',
        payload: { subjectDescriptors: [' with scarf', ',glowing eyes'] },
      });

      expect(result.current[0].elements.subjectDescriptor1).toBe('with scarf');
      expect(result.current[0].elements.subjectDescriptor2).toBe('glowing eyes');
    });
  });

  describe('core behavior', () => {
    it('updates composedElements when subject descriptors change', () => {
      const { result } = renderHook(() => useVideoConceptState());
      const [, dispatch] = result.current;

      dispatchAction(dispatch, {
        type: 'SET_ELEMENT',
        payload: { key: 'subject', value: 'cat' },
      });
      dispatchAction(dispatch, {
        type: 'SET_ELEMENT',
        payload: { key: 'subjectDescriptor1', value: 'with blue eyes' },
      });

      expect(result.current[0].composedElements?.subject).toBe('cat with blue eyes');
    });

    it('records history entries with timestamps and preserves concept on reset', () => {
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(999);
      const { result } = renderHook(() => useVideoConceptState('initial concept'));
      const [, dispatch] = result.current;

      dispatchAction(dispatch, {
        type: 'ADD_TO_HISTORY',
        payload: { element: 'subject', value: 'cat' },
      });

      expect(result.current[0].elementHistory).toEqual([
        { element: 'subject', value: 'cat', timestamp: 999 },
      ]);

      dispatchAction(dispatch, { type: 'RESET' });

      expect(result.current[0].concept).toBe('initial concept');
      dateSpy.mockRestore();
    });
  });
});
