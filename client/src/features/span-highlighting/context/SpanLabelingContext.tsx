import React, { createContext, useContext, type ReactNode } from 'react';
import { spanLabelingCache } from '../services/SpanLabelingCache.ts';
import type { SpanLabelingCacheService } from '../hooks/useSpanLabelingCache.ts';

const SpanLabelingContext = createContext<SpanLabelingCacheService | null>(spanLabelingCache);

interface SpanLabelingProviderProps {
  children: ReactNode;
  cacheService?: SpanLabelingCacheService | null;
}

/**
 * Span Labeling Context Provider
 *
 * Provides cache service via context for dependency injection.
 * Allows mocking cache in tests by providing a different service.
 */
export function SpanLabelingProvider({
  children,
  cacheService = spanLabelingCache,
}: SpanLabelingProviderProps): React.ReactElement {
  return (
    <SpanLabelingContext.Provider value={cacheService}>
      {children}
    </SpanLabelingContext.Provider>
  );
}

/**
 * Hook to access span labeling cache service from context
 */
export function useSpanLabelingCacheService(): SpanLabelingCacheService | null {
  return useContext(SpanLabelingContext);
}





