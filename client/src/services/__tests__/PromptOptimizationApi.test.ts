import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../ApiClient';
import { PromptOptimizationApi } from '../PromptOptimizationApi';

const { streamWithFetch } = vi.hoisted(() => ({
  streamWithFetch: vi.fn(),
}));

vi.mock('../prompt-optimization/streamWithFetch', () => ({
  streamWithFetch,
}));

function createClient() {
  return {
    post: vi.fn(),
    getBaseUrl: vi.fn(() => '/api'),
  };
}

describe('PromptOptimizationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consumes streaming events and resolves when done is received', async () => {
    const client = createClient();
    const api = new PromptOptimizationApi(client as never);
    const onDraft = vi.fn();
    const onSpans = vi.fn();
    const onRefined = vi.fn();

    streamWithFetch.mockImplementation(async (options) => {
      options.onMessage('draft', { draft: 'draft output' });
      options.onMessage('spans', {
        spans: [{ start: 0, end: 5, category: 'subject.identity', confidence: 0.9 }],
        source: 'draft',
        meta: { cache: 'MISS' },
      });
      options.onMessage('refined', {
        refined: 'refined output',
        metadata: { previewPrompt: 'preview output' },
      });
      options.onMessage('done', { usedFallback: false });
      options.onComplete?.();
    });

    const result = await api.optimizeWithStreaming({
      prompt: 'input prompt',
      mode: 'video',
      onDraft,
      onSpans,
      onRefined,
    });

    expect(streamWithFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/optimize-stream',
        method: 'POST',
        body: expect.objectContaining({
          prompt: 'input prompt',
          mode: 'video',
        }),
      }),
      expect.any(Object)
    );
    expect(onDraft).toHaveBeenCalledWith('draft output');
    expect(onSpans).toHaveBeenCalledWith(
      [{ start: 0, end: 5, category: 'subject.identity', confidence: 0.9 }],
      'draft',
      { cache: 'MISS' }
    );
    expect(onRefined).toHaveBeenCalledWith('refined output', {
      previewPrompt: 'preview output',
    });
    expect(result).toEqual({
      draft: 'draft output',
      refined: 'refined output',
      spans: [{ start: 0, end: 5, category: 'subject.identity', confidence: 0.9 }],
      metadata: { previewPrompt: 'preview output' },
      usedFallback: false,
    });
  });

  it('rejects when stream completes without done event', async () => {
    const client = createClient();
    const api = new PromptOptimizationApi(client as never);
    const onError = vi.fn();

    streamWithFetch.mockImplementation(async (options) => {
      options.onMessage('draft', { draft: 'partial output' });
      options.onComplete?.();
    });

    await expect(
      api.optimizeWithStreaming({
        prompt: 'input prompt',
        mode: 'video',
        onError,
      })
    ).rejects.toThrow('Streaming ended before completion');

    expect(onError).toHaveBeenCalledTimes(1);
    const callbackError = onError.mock.calls[0]?.[0] as Error | undefined;
    expect(callbackError).toBeDefined();
    expect(callbackError?.message).toBe(
      'Streaming ended before completion'
    );
  });

  it('uses legacy optimization directly for startImage requests', async () => {
    const client = createClient();
    client.post.mockResolvedValue({
      prompt: 'image-refined prompt',
      metadata: { source: 'legacy' },
    });
    const api = new PromptOptimizationApi(client as never);
    const onRefined = vi.fn();

    const result = await api.optimizeWithFallback({
      prompt: 'input prompt',
      mode: 'video',
      startImage: 'https://example.com/start.png',
      onRefined,
    });

    expect(streamWithFetch).not.toHaveBeenCalled();
    expect(client.post).toHaveBeenCalledWith(
      '/optimize',
      expect.objectContaining({
        prompt: 'input prompt',
        mode: 'video',
        startImage: 'https://example.com/start.png',
      }),
      {}
    );
    expect(onRefined).toHaveBeenCalledWith('image-refined prompt', { source: 'legacy' });
    expect(result).toEqual({
      draft: 'image-refined prompt',
      refined: 'image-refined prompt',
      spans: [],
      metadata: { source: 'legacy' },
      usedFallback: true,
    });
  });

  it('falls back to legacy API when streaming fails with non-offline errors', async () => {
    const client = createClient();
    client.post.mockResolvedValue({
      prompt: 'legacy output',
      metadata: { provider: 'legacy' },
    });
    const api = new PromptOptimizationApi(client as never);
    const onRefined = vi.fn();

    streamWithFetch.mockImplementation(async (options) => {
      options.onError(Object.assign(new Error('Stream failure'), { status: 500 }));
    });

    const result = await api.optimizeWithFallback({
      prompt: 'input prompt',
      mode: 'video',
      onRefined,
    });

    expect(client.post).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      draft: 'legacy output',
      refined: 'legacy output',
      spans: [],
      metadata: { usedFallback: true, provider: 'legacy' },
      usedFallback: true,
    });
    expect(onRefined).toHaveBeenCalledWith('legacy output', {
      provider: 'legacy',
      usedFallback: true,
    });
  });

  it('routes unauthorized streaming failures to offline fallback and emits callbacks', async () => {
    const client = createClient();
    const api = new PromptOptimizationApi(client as never);
    const onDraft = vi.fn();
    const onSpans = vi.fn();
    const onRefined = vi.fn();

    streamWithFetch.mockImplementation(async (options) => {
      options.onError(Object.assign(new Error('Unauthorized'), { status: 401 }));
    });

    const result = await api.optimizeWithFallback({
      prompt: 'offline source prompt',
      mode: 'video',
      onDraft,
      onSpans,
      onRefined,
    });

    expect(client.post).not.toHaveBeenCalled();
    expect(result.usedFallback).toBe(true);
    expect(result.metadata?.offline).toBe(true);
    expect(result.metadata?.reason).toBe('unauthorized');
    expect(onDraft).toHaveBeenCalledTimes(1);
    expect(onSpans).toHaveBeenCalledWith([], 'offline-fallback', result.metadata);
    expect(onRefined).toHaveBeenCalledWith(result.refined, result.metadata);
  });

  it('throws AbortError immediately when signal is already aborted', async () => {
    const client = createClient();
    const api = new PromptOptimizationApi(client as never);
    const onError = vi.fn();
    const controller = new AbortController();
    controller.abort();

    await expect(
      api.optimizeWithFallback({
        prompt: 'input prompt',
        mode: 'video',
        signal: controller.signal,
        onError,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(streamWithFetch).not.toHaveBeenCalled();
  });

  it('uses offline fallback for optimizeLegacy auth failures', async () => {
    const client = createClient();
    client.post.mockRejectedValue(new ApiError('Unauthorized', 401));
    const api = new PromptOptimizationApi(client as never);

    const result = await api.optimizeLegacy({
      prompt: 'legacy prompt',
      mode: 'video',
    });

    expect(result.prompt).toContain('Offline Prompt Assistant');
    expect(result.optimizedPrompt).toContain('Offline Prompt Assistant');
    expect(result.metadata).toEqual(
      expect.objectContaining({
        offline: true,
        usedFallback: true,
        reason: 'unauthorized',
      })
    );
  });
});
