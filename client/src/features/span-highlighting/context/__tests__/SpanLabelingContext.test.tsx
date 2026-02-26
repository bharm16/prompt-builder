import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  SpanLabelingProvider,
  useSpanLabelingCacheService,
} from '../SpanLabelingContext';
import { spanLabelingCache } from '@features/span-highlighting/services/SpanLabelingCache';

describe('SpanLabelingContext', () => {
  it('provides default singleton cache service when no override is passed', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SpanLabelingProvider>{children}</SpanLabelingProvider>
    );

    const { result } = renderHook(() => useSpanLabelingCacheService(), { wrapper });

    expect(result.current).toBe(spanLabelingCache);
  });

  it('injects custom cache service through provider', () => {
    const customService = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SpanLabelingProvider cacheService={customService}>{children}</SpanLabelingProvider>
    );

    const { result } = renderHook(() => useSpanLabelingCacheService(), { wrapper });

    expect(result.current).toBe(customService);
  });

  it('supports explicitly disabling cache service by providing null', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SpanLabelingProvider cacheService={null}>{children}</SpanLabelingProvider>
    );

    const { result } = renderHook(() => useSpanLabelingCacheService(), { wrapper });

    expect(result.current).toBeNull();
  });
});
