import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTriggerAutocomplete } from '../hooks/useTriggerAutocomplete';
import { assetApi } from '../api/assetApi';
import { logger } from '@/services/LoggingService';

vi.mock('../api/assetApi', () => ({
  assetApi: {
    getSuggestions: vi.fn(),
  },
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('useTriggerAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('clears suggestions and logs warning when fetch fails', async () => {
      vi.mocked(assetApi.getSuggestions).mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useTriggerAutocomplete({ debounceMs: 10 }));

      act(() => {
        result.current.handleInputChange('Hello @ad', 9);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(logger.warn).toHaveBeenCalledWith('Failed to fetch asset suggestions', {
        error: 'fail',
      });
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('closes autocomplete when trigger is not detected', () => {
      const { result } = renderHook(() => useTriggerAutocomplete({ debounceMs: 0 }));

      act(() => {
        result.current.handleInputChange('Hello world', 5);
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.query).toBe('');
      expect(result.current.suggestions).toEqual([]);
    });

    it('keeps selected index within bounds for ArrowUp', async () => {
      vi.mocked(assetApi.getSuggestions).mockResolvedValueOnce([
        { id: '1', type: 'character', trigger: '@Ada', name: 'Ada' },
      ]);

      const { result } = renderHook(() => useTriggerAutocomplete({ debounceMs: 0 }));

      act(() => {
        result.current.handleInputChange('Hello @a', 8);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const event = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as ReactKeyboardEvent<Element>;
      const handled = result.current.handleKeyDown(event);

      expect(handled).toBe(true);
      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('core behavior', () => {
    it('opens autocomplete and positions it from caret rect', async () => {
      vi.mocked(assetApi.getSuggestions).mockResolvedValueOnce([
        { id: '1', type: 'character', trigger: '@Ada', name: 'Ada' },
      ]);

      const { result } = renderHook(() => useTriggerAutocomplete({ debounceMs: 0 }));

      act(() => {
        result.current.handleInputChange('Hi @ad', 6, null, {
          top: 10,
          left: 20,
          bottom: 30,
          right: 40,
          width: 20,
          height: 20,
          x: 20,
          y: 10,
          toJSON: () => ({}),
        } as DOMRect);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.position).toEqual({ top: 36, left: 20 });
      expect(result.current.suggestions).toHaveLength(1);
    });

    it('returns selected suggestion on Enter', async () => {
      vi.mocked(assetApi.getSuggestions).mockResolvedValueOnce([
        { id: '1', type: 'character', trigger: '@Ada', name: 'Ada' },
        { id: '2', type: 'style', trigger: '@Neo', name: 'Neo' },
      ]);

      const { result } = renderHook(() => useTriggerAutocomplete({ debounceMs: 0 }));

      act(() => {
        result.current.handleInputChange('Hello @a', 8);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as ReactKeyboardEvent<Element>;
      const response = result.current.handleKeyDown(event);

      expect(response).toEqual({ selected: { id: '1', type: 'character', trigger: '@Ada', name: 'Ada' } });
    });
  });
});
