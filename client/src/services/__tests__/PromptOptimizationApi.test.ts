import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../ApiClient';
import { PromptOptimizationApi } from '../PromptOptimizationApi';

function createClient() {
  return {
    post: vi.fn(),
  };
}

describe('PromptOptimizationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts optimize requests to /optimize', async () => {
    const client = createClient();
    client.post.mockResolvedValue({
      prompt: 'optimized prompt',
      optimizedPrompt: 'optimized prompt',
      metadata: { previewPrompt: 'preview output' },
    });

    const api = new PromptOptimizationApi(client as never);
    const result = await api.optimize({
      prompt: 'input prompt',
      mode: 'video',
      targetModel: 'sora-2',
      skipCache: true,
    });

    expect(client.post).toHaveBeenCalledWith(
      '/optimize',
      expect.objectContaining({
        prompt: 'input prompt',
        mode: 'video',
        targetModel: 'sora-2',
        skipCache: true,
      }),
      {}
    );
    expect(result.prompt).toBe('optimized prompt');
  });

  it('uses offline fallback for optimize auth failures', async () => {
    const client = createClient();
    client.post.mockRejectedValue(new ApiError('Unauthorized', 401));
    const api = new PromptOptimizationApi(client as never);

    const result = await api.optimize({
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

  it('posts compile requests to /optimize-compile', async () => {
    const client = createClient();
    client.post.mockResolvedValue({ compiledPrompt: 'compiled output' });
    const api = new PromptOptimizationApi(client as never);

    const result = await api.compilePrompt({
      prompt: 'optimized prompt',
      targetModel: 'sora-2',
      context: { shots: 3 },
    });

    expect(client.post).toHaveBeenCalledWith(
      '/optimize-compile',
      {
        prompt: 'optimized prompt',
        targetModel: 'sora-2',
        context: { shots: 3 },
      },
      {}
    );
    expect(result.compiledPrompt).toBe('compiled output');
  });
});
