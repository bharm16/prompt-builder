import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockLog = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: vi.fn(() => mockLog),
    startTimer: vi.fn(),
    endTimer: vi.fn(),
  },
}));

import { useDebugLogger } from '@hooks/useDebugLogger';

// We also want to test the pure functions findChangedProps and summarize.
// Since they are not exported, we test them indirectly through the hook.

describe('useDebugLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error and edge cases', () => {
    it('logError calls log.error with message and error', () => {
      const { result } = renderHook(() => useDebugLogger('TestComp'));
      const testError = new Error('something broke');

      act(() => {
        result.current.logError('Failure happened', testError);
      });

      expect(mockLog.error).toHaveBeenCalledWith('Failure happened', testError);
    });

    it('logError works without an error argument', () => {
      const { result } = renderHook(() => useDebugLogger('TestComp'));

      act(() => {
        result.current.logError('Just a message');
      });

      expect(mockLog.error).toHaveBeenCalledWith('Just a message', undefined);
    });

    it('does not log renders when logRenders is false', () => {
      renderHook(() =>
        useDebugLogger('TestComp', undefined, { logRenders: false, logMountUnmount: false }),
      );
      const renderCalls = mockLog.debug.mock.calls.filter(
        (call) => call[0] === 'Render',
      );
      expect(renderCalls).toHaveLength(0);
    });
  });

  describe('summarize behavior (tested via logState)', () => {
    it('summarizes functions as [Function: name]', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logState('handler', function myHandler() {});
      });

      const call = mockLog.debug.mock.calls.find((c) => c[0] === 'State change');
      expect(call?.[1]?.value).toBe('[Function: myHandler]');
    });

    it('summarizes anonymous functions as [Function: anonymous]', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logState('fn', () => {});
      });

      const call = mockLog.debug.mock.calls.find((c) => c[0] === 'State change');
      // Arrow functions may have empty name
      expect(call?.[1]?.value).toMatch(/\[Function:/);
    });

    it('truncates long strings to 100 chars with char count', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));
      const longString = 'x'.repeat(200);

      act(() => {
        result.current.logState('longVal', longString);
      });

      const call = mockLog.debug.mock.calls.find((c) => c[0] === 'State change');
      expect(call?.[1]?.value).toContain('... (200 chars)');
      expect((call?.[1]?.value as string).length).toBeLessThan(200);
    });

    it('summarizes arrays as [Array(n)]', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logState('list', [1, 2, 3]);
      });

      const call = mockLog.debug.mock.calls.find((c) => c[0] === 'State change');
      expect(call?.[1]?.value).toBe('[Array(3)]');
    });

    it('summarizes objects with many keys showing first 5 and count', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));
      const bigObj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 };

      act(() => {
        result.current.logState('big', bigObj);
      });

      const call = mockLog.debug.mock.calls.find((c) => c[0] === 'State change');
      expect(call?.[1]?.value).toContain('+2');
    });

    it('summarizes small objects showing all keys', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logState('small', { x: 1, y: 2 });
      });

      const call = mockLog.debug.mock.calls.find((c) => c[0] === 'State change');
      expect(call?.[1]?.value).toBe('{x, y}');
    });

    it('passes null and undefined through unchanged', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logState('n', null);
      });
      act(() => {
        result.current.logState('u', undefined);
      });

      const calls = mockLog.debug.mock.calls.filter((c) => c[0] === 'State change');
      expect(calls.find((c) => c[1]?.name === 'n')?.[1]?.value).toBeNull();
      expect(calls.find((c) => c[1]?.name === 'u')?.[1]?.value).toBeUndefined();
    });

    it('passes primitives (numbers, booleans) through unchanged', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logState('num', 42);
      });

      const call = mockLog.debug.mock.calls.find(
        (c) => c[0] === 'State change' && c[1]?.name === 'num',
      );
      expect(call?.[1]?.value).toBe(42);
    });
  });

  describe('logEffect behavior', () => {
    it('logs without deps when none provided', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logEffect('data fetch');
      });

      const call = mockLog.debug.mock.calls.find((c) => c[0] === 'Effect triggered');
      expect(call?.[1]?.description).toBe('data fetch');
      expect(call?.[1]?.deps).toBeUndefined();
    });

    it('logs array deps with summarized values', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logEffect('watch changes', ['a', [1, 2, 3]]);
      });

      const call = mockLog.debug.mock.calls.find((c) => c[0] === 'Effect triggered');
      expect(call?.[1]?.deps).toEqual(['a', '[Array(3)]']);
    });

    it('logs object deps as-is', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logEffect('sync', { userId: '123' });
      });

      const call = mockLog.debug.mock.calls.find((c) => c[0] === 'Effect triggered');
      expect(call?.[1]?.deps).toEqual({ userId: '123' });
    });
  });

  describe('logAction behavior', () => {
    it('logs action with payload', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logAction('SUBMIT', { formId: 'abc' });
      });

      expect(mockLog.info).toHaveBeenCalledWith(
        'Action dispatched',
        expect.objectContaining({ action: 'SUBMIT' }),
      );
    });

    it('logs action without payload', () => {
      const { result } = renderHook(() => useDebugLogger('Test'));

      act(() => {
        result.current.logAction('RESET');
      });

      expect(mockLog.info).toHaveBeenCalledWith(
        'Action dispatched',
        { action: 'RESET' },
      );
    });
  });

  describe('timer behavior', () => {
    it('startTimer prefixes operation with component name', async () => {
      const { logger } = vi.mocked(
        await import('@/services/LoggingService'),
      );
      const { result } = renderHook(() => useDebugLogger('MyComp'));

      act(() => {
        result.current.startTimer('fetchData');
      });

      expect(logger.startTimer).toHaveBeenCalledWith('MyComp:fetchData');
    });
  });
});
