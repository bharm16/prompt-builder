import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    startTimer: vi.fn(),
    endTimer: vi.fn(),
  },
}));

// We need to test normalizeSpans which is not exported, but we can test it
// indirectly through runSingleStageOptimization.
// However, let's test the exported functions directly.
import {
  runSingleStageOptimization,
  runTwoStageOptimization,
} from '@hooks/utils/promptOptimizationFlow';
import type {
  PromptOptimizerActions,
  SingleStageOptimizationOptions,
  TwoStageOptimizationOptions,
} from '@hooks/utils/promptOptimizationFlow';

function createMockActions(): PromptOptimizerActions {
  return {
    setDraftPrompt: vi.fn(),
    setOptimizedPrompt: vi.fn(),
    setDisplayedPrompt: vi.fn(),
    setGenericOptimizedPrompt: vi.fn(),
    setIsDraftReady: vi.fn(),
    setIsRefining: vi.fn(),
    setIsProcessing: vi.fn(),
    setDraftSpans: vi.fn(),
    setRefinedSpans: vi.fn(),
    setQualityScore: vi.fn(),
    setPreviewPrompt: vi.fn(),
    setPreviewAspectRatio: vi.fn(),
  };
}

function createMockToast() {
  return { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
}

function createMockLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('runSingleStageOptimization', () => {
  describe('error cases', () => {
    it('propagates errors from analyzeAndOptimize', async () => {
      const actions = createMockActions();
      const analyzeAndOptimize = vi.fn().mockRejectedValue(new Error('API down'));

      await expect(
        runSingleStageOptimization({
          promptToOptimize: 'test prompt',
          selectedMode: 'video',
          context: null,
          brainstormContext: null,
          abortController: new AbortController(),
          actions,
          toast: createMockToast(),
          log: createMockLog() as any,
          analyzeAndOptimize,
          calculateQualityScore: vi.fn(),
        }),
      ).rejects.toThrow('API down');
    });
  });

  describe('edge cases', () => {
    it('uses empty string when response has neither prompt nor optimizedPrompt', async () => {
      const actions = createMockActions();
      const analyzeAndOptimize = vi.fn().mockResolvedValue({});
      const calculateQualityScore = vi.fn().mockReturnValue(42);

      const result = await runSingleStageOptimization({
        promptToOptimize: 'test',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        actions,
        toast: createMockToast(),
        log: createMockLog() as any,
        analyzeAndOptimize,
        calculateQualityScore,
      });

      expect(actions.setOptimizedPrompt).toHaveBeenCalledWith('');
      expect(result?.optimized).toBe('');
      expect(result?.score).toBe(42);
    });

    it('extracts genericPrompt from metadata when present', async () => {
      const actions = createMockActions();
      const analyzeAndOptimize = vi.fn().mockResolvedValue({
        prompt: 'optimized result',
        metadata: { genericPrompt: 'generic version' },
      });

      await runSingleStageOptimization({
        promptToOptimize: 'test',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        actions,
        toast: createMockToast(),
        log: createMockLog() as any,
        analyzeAndOptimize,
        calculateQualityScore: vi.fn().mockReturnValue(85),
      });

      expect(actions.setGenericOptimizedPrompt).toHaveBeenCalledWith('generic version');
    });
  });

  describe('core behavior', () => {
    it('calls setOptimizedPrompt and setQualityScore with correct values', async () => {
      const actions = createMockActions();
      const analyzeAndOptimize = vi.fn().mockResolvedValue({
        prompt: 'Cinematic wide shot of a cowboy',
      });
      const calculateQualityScore = vi.fn().mockReturnValue(88);

      const result = await runSingleStageOptimization({
        promptToOptimize: 'a cowboy',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        actions,
        toast: createMockToast(),
        log: createMockLog() as any,
        analyzeAndOptimize,
        calculateQualityScore,
      });

      expect(actions.setOptimizedPrompt).toHaveBeenCalledWith('Cinematic wide shot of a cowboy');
      expect(actions.setQualityScore).toHaveBeenCalledWith(88);
      expect(calculateQualityScore).toHaveBeenCalledWith('a cowboy', 'Cinematic wide shot of a cowboy');
      expect(result).toEqual({ optimized: 'Cinematic wide shot of a cowboy', score: 88 });
    });

    it('shows success toast for score >= 80', async () => {
      const toast = createMockToast();
      const analyzeAndOptimize = vi.fn().mockResolvedValue({ prompt: 'great' });

      await runSingleStageOptimization({
        promptToOptimize: 'test',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        actions: createMockActions(),
        toast,
        log: createMockLog() as any,
        analyzeAndOptimize,
        calculateQualityScore: vi.fn().mockReturnValue(85),
      });

      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('85'));
    });

    it('shows warning toast for score < 60', async () => {
      const toast = createMockToast();
      const analyzeAndOptimize = vi.fn().mockResolvedValue({ prompt: 'ok' });

      await runSingleStageOptimization({
        promptToOptimize: 'test',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        actions: createMockActions(),
        toast,
        log: createMockLog() as any,
        analyzeAndOptimize,
        calculateQualityScore: vi.fn().mockReturnValue(45),
      });

      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('45'));
    });

    it('shows i2v conflict toast when conflicts present in flexible mode', async () => {
      const toast = createMockToast();
      const analyzeAndOptimize = vi.fn().mockResolvedValue({
        prompt: 'result',
        i2v: {
          conflicts: [{ field: 'color', description: 'mismatch' }],
          appliedMode: 'flexible',
        },
      });

      await runSingleStageOptimization({
        promptToOptimize: 'test',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        actions: createMockActions(),
        toast,
        log: createMockLog() as any,
        analyzeAndOptimize,
        calculateQualityScore: vi.fn().mockReturnValue(70),
      });

      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('1 visual conflict'));
    });
  });
});

describe('runTwoStageOptimization', () => {
  describe('error cases', () => {
    it('propagates errors from optimizeWithFallback', async () => {
      const optimizeWithFallback = vi.fn().mockRejectedValue(new Error('Stream failed'));

      await expect(
        runTwoStageOptimization({
          promptToOptimize: 'test',
          selectedMode: 'video',
          context: null,
          brainstormContext: null,
          abortController: new AbortController(),
          requestId: 1,
          requestIdRef: { current: 1 },
          refinedSpans: null,
          actions: createMockActions(),
          toast: createMockToast(),
          log: createMockLog() as any,
          optimizeWithFallback,
          calculateQualityScore: vi.fn(),
        }),
      ).rejects.toThrow('Stream failed');
    });
  });

  describe('edge cases', () => {
    it('returns null when aborted before completion', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const optimizeWithFallback = vi.fn().mockResolvedValue({
        refined: 'result',
        usedFallback: false,
      });

      const result = await runTwoStageOptimization({
        promptToOptimize: 'test',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController,
        requestId: 1,
        requestIdRef: { current: 1 },
        refinedSpans: null,
        actions: createMockActions(),
        toast: createMockToast(),
        log: createMockLog() as any,
        optimizeWithFallback,
        calculateQualityScore: vi.fn().mockReturnValue(75),
      });

      expect(result).toBeNull();
    });

    it('returns null when requestId is stale', async () => {
      const requestIdRef = { current: 2 };

      const optimizeWithFallback = vi.fn().mockResolvedValue({
        refined: 'result',
        usedFallback: false,
      });

      const result = await runTwoStageOptimization({
        promptToOptimize: 'test',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        requestId: 1,
        requestIdRef,
        refinedSpans: null,
        actions: createMockActions(),
        toast: createMockToast(),
        log: createMockLog() as any,
        optimizeWithFallback,
        calculateQualityScore: vi.fn().mockReturnValue(75),
      });

      expect(result).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('returns optimized result with calculated score', async () => {
      const optimizeWithFallback = vi.fn().mockResolvedValue({
        refined: 'refined prompt output',
        usedFallback: false,
      });
      const calculateQualityScore = vi.fn().mockReturnValue(92);

      const result = await runTwoStageOptimization({
        promptToOptimize: 'raw input',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        requestId: 1,
        requestIdRef: { current: 1 },
        refinedSpans: null,
        actions: createMockActions(),
        toast: createMockToast(),
        log: createMockLog() as any,
        optimizeWithFallback,
        calculateQualityScore,
      });

      expect(result).toEqual({ optimized: 'refined prompt output', score: 92 });
      expect(calculateQualityScore).toHaveBeenCalledWith('raw input', 'refined prompt output');
    });

    it('shows fallback warning toast when usedFallback is true', async () => {
      const toast = createMockToast();
      const optimizeWithFallback = vi.fn().mockResolvedValue({
        refined: 'fallback result',
        usedFallback: true,
      });

      await runTwoStageOptimization({
        promptToOptimize: 'test',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        requestId: 1,
        requestIdRef: { current: 1 },
        refinedSpans: null,
        actions: createMockActions(),
        toast,
        log: createMockLog() as any,
        optimizeWithFallback,
        calculateQualityScore: vi.fn().mockReturnValue(70),
      });

      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Fast optimization unavailable'));
    });

    it('sets previewPrompt from metadata', async () => {
      const actions = createMockActions();
      const optimizeWithFallback = vi.fn().mockResolvedValue({
        refined: 'result',
        usedFallback: false,
        metadata: { previewPrompt: 'preview text', aspectRatio: '16:9' },
      });

      await runTwoStageOptimization({
        promptToOptimize: 'test',
        selectedMode: 'video',
        context: null,
        brainstormContext: null,
        abortController: new AbortController(),
        requestId: 1,
        requestIdRef: { current: 1 },
        refinedSpans: null,
        actions,
        toast: createMockToast(),
        log: createMockLog() as any,
        optimizeWithFallback,
        calculateQualityScore: vi.fn().mockReturnValue(80),
      });

      expect(actions.setPreviewPrompt).toHaveBeenCalledWith('preview text');
      expect(actions.setPreviewAspectRatio).toHaveBeenCalledWith('16:9');
    });
  });
});
