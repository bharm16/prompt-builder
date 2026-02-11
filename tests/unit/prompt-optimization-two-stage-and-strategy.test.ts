import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AIService } from '@services/prompt-optimization/types';
import { StrategyFactory } from '@services/prompt-optimization/services/StrategyFactory';
import { DraftGenerationService } from '@services/prompt-optimization/services/DraftGenerationService';
import { runTwoStageFlow } from '@services/prompt-optimization/workflows/twoStageFlow';

const createLogMock = () => {
  const log = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  log.child.mockReturnValue(log);
  return log;
};

describe('runTwoStageFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs draft first, then refines from draft output', async () => {
    const log = createLogMock();
    const onDraft = vi.fn();

    const shotInterpreter = {
      interpret: vi.fn().mockResolvedValue({ shot_type: 'wide' }),
    };
    const draftService = {
      supportsStreaming: vi.fn().mockReturnValue(true),
      generateDraft: vi.fn().mockResolvedValue('draft prompt'),
    };
    const optimize = vi.fn().mockResolvedValue({
      prompt: 'refined prompt',
      inputMode: 't2v',
      metadata: { source: 'openai-refine' },
    });

    const result = await runTwoStageFlow({
      request: {
        prompt: 'user prompt',
        mode: 'video',
        brainstormContext: { sessionId: 'abc' },
        onDraft,
      },
      log,
      shotInterpreter: shotInterpreter as never,
      draftService: draftService as never,
      optimize,
    });

    expect(draftService.generateDraft).toHaveBeenCalledWith(
      'user prompt',
      'video',
      { shot_type: 'wide' },
      null,
      undefined,
      undefined
    );
    expect(optimize).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'draft prompt',
        mode: 'video',
        brainstormContext: {
          sessionId: 'abc',
          originalUserPrompt: 'user prompt',
        },
      })
    );
    expect(onDraft).toHaveBeenCalledWith('draft prompt', null);
    expect(onDraft.mock.invocationCallOrder[0]).toBeLessThan(
      optimize.mock.invocationCallOrder[0] as number
    );
    expect(result).toEqual(
      expect.objectContaining({
        draft: 'draft prompt',
        refined: 'refined prompt',
        metadata: expect.objectContaining({
          usedTwoStage: true,
        }),
      })
    );
  });

  it('falls back to single-stage optimization when draft streaming is unavailable', async () => {
    const log = createLogMock();
    const draftService = {
      supportsStreaming: vi.fn().mockReturnValue(false),
      generateDraft: vi.fn(),
    };
    const optimize = vi.fn().mockResolvedValue({
      prompt: 'single-stage output',
      inputMode: 't2v',
      metadata: { source: 'single-stage' },
    });

    const result = await runTwoStageFlow({
      request: {
        prompt: 'user prompt',
        mode: 'video',
      },
      log,
      shotInterpreter: { interpret: vi.fn().mockResolvedValue(null) } as never,
      draftService: draftService as never,
      optimize,
    });

    expect(optimize).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'user prompt',
      })
    );
    expect(result).toEqual({
      draft: 'single-stage output',
      refined: 'single-stage output',
      metadata: {
        usedFallback: true,
        source: 'single-stage',
      },
    });
  });

  it('falls back to single-stage when draft generation fails', async () => {
    const log = createLogMock();
    const draftService = {
      supportsStreaming: vi.fn().mockReturnValue(true),
      generateDraft: vi.fn().mockRejectedValue(new Error('groq unavailable')),
    };
    const optimize = vi.fn().mockResolvedValue({
      prompt: 'fallback output',
      inputMode: 't2v',
      metadata: { source: 'fallback' },
    });

    const result = await runTwoStageFlow({
      request: {
        prompt: 'user prompt',
        mode: 'video',
      },
      log,
      shotInterpreter: { interpret: vi.fn().mockResolvedValue(null) } as never,
      draftService: draftService as never,
      optimize,
    });

    expect(result).toEqual(
      expect.objectContaining({
        draft: 'fallback output',
        refined: 'fallback output',
        usedFallback: true,
        error: 'groq unavailable',
      })
    );
    expect(optimize).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'user prompt',
      })
    );
  });

  it('throws AbortError when signal is already aborted', async () => {
    const signal = AbortSignal.abort();

    await expect(
      runTwoStageFlow({
        request: {
          prompt: 'user prompt',
          mode: 'video',
          signal,
        },
        log: createLogMock(),
        shotInterpreter: { interpret: vi.fn() } as never,
        draftService: {
          supportsStreaming: vi.fn().mockReturnValue(true),
          generateDraft: vi.fn(),
        } as never,
        optimize: vi.fn(),
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('forwards draft and refined chunk callbacks', async () => {
    const onDraftChunk = vi.fn();
    const onRefinedChunk = vi.fn();

    const draftService = {
      supportsStreaming: vi.fn().mockReturnValue(true),
      generateDraft: vi
        .fn()
        .mockImplementation(async (_prompt, _mode, _plan, _params, _signal, onChunk) => {
          onChunk?.('draft-delta');
          return 'draft';
        }),
    };
    const optimize = vi.fn().mockImplementation(async (request) => {
      request.onChunk?.('refined-delta');
      return {
        prompt: 'refined',
        inputMode: 't2v',
        metadata: { source: 'refined' },
      };
    });

    const result = await runTwoStageFlow({
      request: {
        prompt: 'user prompt',
        mode: 'video',
        onDraftChunk,
        onRefinedChunk,
      },
      log: createLogMock(),
      shotInterpreter: { interpret: vi.fn().mockResolvedValue(null) } as never,
      draftService: draftService as never,
      optimize,
    });

    expect(onDraftChunk).toHaveBeenCalledWith('draft-delta');
    expect(onRefinedChunk).toHaveBeenCalledWith('refined-delta');
    expect(result.refined).toBe('refined');
  });
});

describe('StrategyFactory', () => {
  const aiService: AIService = {
    execute: vi.fn(async () => ({ text: '', content: [], metadata: {} })),
    getAvailableClients: vi.fn(() => ['mock']),
  };

  it('selects the video strategy regardless of mode input', () => {
    const factory = new StrategyFactory(aiService, {});
    const strategy = factory.getStrategy();
    const explicit = factory.getStrategy('video');

    expect(strategy.name).toBe('video');
    expect(explicit.name).toBe('video');
  });

  it('reports supported modes and strategy presence', () => {
    const factory = new StrategyFactory(aiService, {});

    expect(factory.getSupportedModes()).toEqual(['video']);
    expect(factory.hasStrategy('video')).toBe(true);
    expect(factory.hasStrategy('unknown' as never)).toBe(false);
  });
});

describe('DraftGenerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reflects streaming support from AI service', () => {
    const ai: AIService = {
      execute: vi.fn(async () => ({ text: '', content: [], metadata: {} })),
      supportsStreaming: vi.fn(() => true),
    };

    const service = new DraftGenerationService(ai);
    expect(service.supportsStreaming()).toBe(true);
  });

  it('uses streaming draft generation when available', async () => {
    const onChunk = vi.fn();
    const ai: AIService = {
      execute: vi.fn(async () => ({ text: '', content: [], metadata: {} })),
      stream: vi.fn(async (_operation, options) => {
        options.onChunk('partial');
        return 'draft-streamed';
      }),
      supportsStreaming: vi.fn(() => true),
    };

    const service = new DraftGenerationService(ai);
    const result = await service.generateDraft(
      'user prompt',
      'video',
      null,
      null,
      undefined,
      onChunk
    );

    expect(ai.stream).toHaveBeenCalled();
    expect(onChunk).toHaveBeenCalledWith('partial');
    expect(result).toBe('draft-streamed');
  });

  it('uses execute fallback when streaming is unavailable', async () => {
    const ai: AIService = {
      execute: vi.fn(async () => ({
        text: '',
        content: [{ text: 'draft-execute' }],
        metadata: {},
      })),
      supportsStreaming: vi.fn(() => false),
    };

    const service = new DraftGenerationService(ai);
    const result = await service.generateDraft('user prompt', 'video', null, null);

    expect(ai.execute).toHaveBeenCalled();
    expect(result).toBe('draft-execute');
  });

  it('embeds generation constraints in the draft system prompt', async () => {
    const ai: AIService = {
      execute: vi.fn(async () => ({ text: 'draft', content: [], metadata: {} })),
      supportsStreaming: vi.fn(() => false),
    };

    const service = new DraftGenerationService(ai);
    await service.generateDraft(
      'user prompt',
      'video',
      null,
      {
        aspect_ratio: '16:9',
        duration_s: 6,
        fps: 24,
        audio: false,
      }
    );

    const call = (ai.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(call.systemPrompt).toContain('Aspect Ratio: 16:9');
    expect(call.systemPrompt).toContain('Duration: 6s');
    expect(call.systemPrompt).toContain('Frame Rate: 24fps');
    expect(call.systemPrompt).toContain('Audio: Muted');
  });
});
