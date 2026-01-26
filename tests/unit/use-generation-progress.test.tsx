import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useGenerationProgress } from '@features/prompt-optimizer/GenerationsPanel/hooks/useGenerationProgress';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';

const createGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 'gen-1',
  tier: 'draft',
  status: 'pending',
  model: 'wan-2.2',
  prompt: 'Prompt',
  promptVersionId: 'version-1',
  createdAt: 0,
  completedAt: null,
  mediaType: 'video',
  mediaUrls: [],
  thumbnailUrl: null,
  error: null,
  ...overrides,
});

describe('useGenerationProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('marks failed generations correctly', () => {
      const generation = createGeneration({ status: 'failed' });
      const { result } = renderHook(() => useGenerationProgress(generation));

      expect(result.current.isFailed).toBe(true);
      expect(result.current.progressPercent).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns a completed state without starting an interval', () => {
      const generation = createGeneration({ status: 'completed' });
      const { result } = renderHook(() => useGenerationProgress(generation));

      expect(result.current.isCompleted).toBe(true);
      expect(result.current.progressPercent).toBe(100);
    });
  });

  describe('core behavior', () => {
    it('updates progress while generating', () => {
      const generation = createGeneration({ status: 'generating' });
      const { result } = renderHook(() => useGenerationProgress(generation));

      const initialProgress = result.current.progressPercent;

      act(() => {
        vi.setSystemTime(10_000);
        vi.advanceTimersByTime(400);
      });

      expect(result.current.progressPercent).not.toBe(initialProgress);
      expect(result.current.isGenerating).toBe(true);
    });
  });
});
