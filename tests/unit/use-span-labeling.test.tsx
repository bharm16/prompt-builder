import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useSpanLabeling } from '@features/span-highlighting/hooks/useSpanLabeling';
import type { SpanLabelingCacheService } from '@features/span-highlighting/hooks/useSpanLabelingCache';
import type { LabeledSpan, SpanMeta, SpanLabelingResult } from '@features/span-highlighting/hooks/types';

const mockHashString = vi.fn((text: string) => `hash:${text}`);
const mockSanitizeText = vi.fn((text: unknown) => (typeof text === 'string' ? text : ''));

vi.mock('@features/span-highlighting/utils', () => ({
  hashString: (text: string) => mockHashString(text),
  sanitizeText: (text: unknown) => mockSanitizeText(text),
}));

vi.mock('@features/span-highlighting/utils/spanLabelingScheduler', () => ({
  createDisabledState: () => ({
    spans: [],
    meta: null,
    status: 'idle',
    error: null,
    signature: null,
  }),
  createLoadingState: (immediate: boolean, previousStatus: string) => ({
    spans: [],
    meta: null,
    status: previousStatus === 'success' && !immediate ? 'refreshing' : 'loading',
    error: null,
    signature: null,
  }),
  calculateEffectiveDebounce: (_payload: unknown, options: { debounceMs: number; immediate: boolean }) =>
    options.immediate || options.debounceMs === 0 ? 0 : options.debounceMs,
}));

let mockCacheService: SpanLabelingCacheService | null = null;

vi.mock('@features/span-highlighting/context/SpanLabelingContext', () => ({
  useSpanLabelingCacheService: () => mockCacheService,
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('@features/span-highlighting/api', () => ({
  SpanLabelingApi: {
    labelSpansStream: vi.fn(),
  },
}));

const createCacheService = (overrides: Partial<SpanLabelingCacheService> = {}): SpanLabelingCacheService => ({
  get: vi.fn(() => null),
  set: vi.fn(),
  ...overrides,
});

describe('useSpanLabeling', () => {
  const spans: LabeledSpan[] = [
    { start: 0, end: 5, category: 'subject', confidence: 0.9 },
  ];

  beforeEach(() => {
    mockCacheService = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockCacheService = null;
  });

  describe('error handling', () => {
    it('returns an idle state when disabled', () => {
      const onResult = vi.fn();
      mockCacheService = null;

      const { result } = renderHook(() =>
        useSpanLabeling({ text: 'Hello', enabled: false, onResult })
      );

      expect(result.current.status).toBe('idle');
      expect(result.current.spans).toEqual([]);
      expect(onResult).not.toHaveBeenCalled();
    });

    it('returns an idle state when text is empty', () => {
      const onResult = vi.fn();
      mockCacheService = null;

      const { result } = renderHook(() =>
        useSpanLabeling({ text: '   ', enabled: true, onResult })
      );

      expect(result.current.status).toBe('idle');
      expect(result.current.spans).toEqual([]);
      expect(onResult).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('hydrates state from a cache hit and normalizes metadata', async () => {
      mockCacheService = createCacheService({
        get: vi.fn(() => ({
          spans,
          meta: { version: '' } as SpanMeta,
          cacheId: 'cache-1',
          signature: 'sig-cache',
        })),
      });

      const onResult = vi.fn();

      const { result } = renderHook(() =>
        useSpanLabeling({
          text: 'Hello',
          enabled: true,
          onResult,
          useSmartDebounce: false,
          debounceMs: 0,
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      expect(result.current.meta?.version).toBe('v1');
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining<Partial<SpanLabelingResult>>({
          source: 'cache',
          signature: 'sig-cache',
          cacheId: 'cache-1',
        })
      );
    });
  });

  describe('core behavior', () => {
    it('uses matching initial data and emits an initial result', async () => {
      const text = 'Hello';
      const signature = `hash:${text}`;
      mockCacheService = createCacheService();
      const onResult = vi.fn();

      const { result } = renderHook(() =>
        useSpanLabeling({
          text,
          enabled: true,
          initialData: {
            spans,
            meta: {},
            signature,
          },
          onResult,
          useSmartDebounce: false,
          debounceMs: 0,
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      expect(result.current.signature).toBe(signature);
      expect(mockCacheService?.set).toHaveBeenCalledWith(
        expect.objectContaining({ text }),
        expect.objectContaining({ signature })
      );
      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining<Partial<SpanLabelingResult>>({
          source: 'initial',
          signature,
        })
      );
    });
  });
});
