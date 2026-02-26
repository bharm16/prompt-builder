import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { ContinuitySession, ContinuityShot } from '@services/continuity/types';
import type { ContinuitySessionService } from '@services/continuity/ContinuitySessionService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { ShotGenerationEvent } from '@services/continuity/ShotGenerationProgress';

const mocks = vi.hoisted(() => ({
  createSseChannel: vi.fn(),
  reserveShotGenerationCredits: vi.fn(),
  settleSuccessfulShotGeneration: vi.fn(),
  settleExceptionalShotGeneration: vi.fn(),
}));

vi.mock('@routes/optimize/sse', () => ({
  createSseChannel: mocks.createSseChannel,
}));

vi.mock('../continuityRouteShared', () => ({
  reserveShotGenerationCredits: mocks.reserveShotGenerationCredits,
  settleSuccessfulShotGeneration: mocks.settleSuccessfulShotGeneration,
  settleExceptionalShotGeneration: mocks.settleExceptionalShotGeneration,
}));

import { handleGenerateShotStream } from '../handleGenerateShotStream';

interface MockSseChannel {
  signal: AbortSignal;
  sendEvent: ReturnType<typeof vi.fn>;
  markProcessingStarted: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

const createDeferred = <T>() => {
  let resolveFn: ((value: T | PromiseLike<T>) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolveFn = resolve;
  });
  return {
    promise,
    resolve: (value: T) => {
      if (!resolveFn) {
        throw new Error('Deferred resolver was not initialized');
      }
      resolveFn(value);
    },
  };
};

const buildShot = (overrides: Partial<ContinuityShot> = {}): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Prompt',
  generationMode: 'continuity',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-a' as ContinuityShot['modelId'],
  status: 'draft',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildSession = (): ContinuitySession => ({
  id: 'session-1',
  userId: 'user-1',
  name: 'Session',
  primaryStyleReference: {
    id: 'style-1',
    sourceVideoId: 'video-1',
    sourceFrameIndex: 0,
    frameUrl: 'https://example.com/style.png',
    frameTimestamp: 0,
    resolution: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    extractedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  shots: [buildShot()],
  defaultSettings: {
    generationMode: 'continuity',
    defaultContinuityMode: 'frame-bridge',
    defaultStyleStrength: 0.6,
    defaultModel: 'model-a' as ContinuitySession['defaultSettings']['defaultModel'],
    autoExtractFrameBridge: false,
    useCharacterConsistency: false,
    maxRetries: 1,
  },
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const buildReservation = () => ({
  shotId: 'shot-1',
  cost: {
    generationMode: 'continuity' as const,
    continuityMode: 'frame-bridge' as const,
    videoCost: 20,
    extraCost: 0,
    perAttemptCost: 20,
    maxRetries: 1,
    totalCost: 40,
  },
  requestId: 'request-1',
  operationToken: 'token-1',
  unusedRetriesRefundKey: 'unused',
  failedActualCostRefundKey: 'failed',
  catchAllRefundKey: 'catch-all',
});

const buildRequest = (): Request =>
  ({
    params: { sessionId: 'session-1', shotId: 'shot-1' },
  }) as unknown as Request;

const buildResponse = (): Response => ({}) as unknown as Response;

const createSseChannel = (): MockSseChannel => ({
  signal: new AbortController().signal,
  sendEvent: vi.fn(),
  markProcessingStarted: vi.fn(),
  close: vi.fn(),
});

describe('handleGenerateShotStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.reserveShotGenerationCredits.mockResolvedValue(buildReservation());
    mocks.settleSuccessfulShotGeneration.mockResolvedValue(undefined);
    mocks.settleExceptionalShotGeneration.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits stage and result events and settles success for completed shots', async () => {
    const session = buildSession();
    const result = buildShot({ status: 'completed', retryCount: 0 });
    const sseChannel = createSseChannel();
    const service = {
      generateShot: vi.fn(
        async (_sessionId: string, _shotId: string, observer?: { onStage: (event: ShotGenerationEvent) => void }) => {
          observer?.onStage({
            shotId: 'shot-1',
            stage: 'generating-video',
            progress: 50,
            message: 'Generating video.',
          });
          return result;
        }
      ),
    };

    mocks.createSseChannel.mockReturnValue(sseChannel);

    await handleGenerateShotStream(
      service as unknown as ContinuitySessionService,
      session,
      buildRequest(),
      buildResponse(),
      {} as UserCreditService
    );

    expect(sseChannel.markProcessingStarted).toHaveBeenCalledTimes(1);
    expect(sseChannel.sendEvent).toHaveBeenCalledWith(
      'stage',
      expect.objectContaining({ stage: 'generating-video' })
    );
    expect(sseChannel.sendEvent).toHaveBeenCalledWith('result', {
      success: true,
      data: result,
    });
    expect(mocks.settleSuccessfulShotGeneration).toHaveBeenCalledWith(
      session,
      expect.any(Object),
      expect.objectContaining({ shotId: 'shot-1' }),
      result
    );
    expect(mocks.settleExceptionalShotGeneration).not.toHaveBeenCalled();
    expect(sseChannel.close).toHaveBeenCalledTimes(1);
  });

  it('emits a result event for non-throw failed shots', async () => {
    const session = buildSession();
    const failedResult = buildShot({
      status: 'failed',
      retryCount: 0,
      error: 'Quality threshold not met',
    });
    const sseChannel = createSseChannel();
    const service = {
      generateShot: vi.fn().mockResolvedValue(failedResult),
    };

    mocks.createSseChannel.mockReturnValue(sseChannel);

    await handleGenerateShotStream(
      service as unknown as ContinuitySessionService,
      session,
      buildRequest(),
      buildResponse(),
      {} as UserCreditService
    );

    expect(sseChannel.sendEvent).toHaveBeenCalledWith('result', {
      success: true,
      data: failedResult,
    });
    expect(sseChannel.sendEvent).not.toHaveBeenCalledWith('error', expect.anything());
    expect(mocks.settleSuccessfulShotGeneration).toHaveBeenCalledTimes(1);
    expect(mocks.settleExceptionalShotGeneration).not.toHaveBeenCalled();
  });

  it('emits an error event and settles exceptional path when generation throws', async () => {
    const session = buildSession();
    const sseChannel = createSseChannel();
    const service = {
      generateShot: vi.fn().mockRejectedValue(new Error('provider timeout')),
    };

    mocks.createSseChannel.mockReturnValue(sseChannel);

    await handleGenerateShotStream(
      service as unknown as ContinuitySessionService,
      session,
      buildRequest(),
      buildResponse(),
      {} as UserCreditService
    );

    expect(sseChannel.sendEvent).toHaveBeenCalledWith('error', {
      success: false,
      error: 'provider timeout',
    });
    expect(mocks.settleExceptionalShotGeneration).toHaveBeenCalledTimes(1);
    expect(mocks.settleSuccessfulShotGeneration).not.toHaveBeenCalled();
    expect(sseChannel.close).toHaveBeenCalledTimes(1);
  });

  it('swallows SSE write failures and still settles + closes', async () => {
    const session = buildSession();
    const result = buildShot({ status: 'completed' });
    const sseChannel = createSseChannel();
    sseChannel.sendEvent.mockImplementation(() => {
      throw new Error('broken pipe');
    });
    const service = {
      generateShot: vi.fn(
        async (_sessionId: string, _shotId: string, observer?: { onStage: (event: ShotGenerationEvent) => void }) => {
          observer?.onStage({
            shotId: 'shot-1',
            stage: 'generating-video',
            progress: 50,
            message: 'Generating video.',
          });
          return result;
        }
      ),
    };

    mocks.createSseChannel.mockReturnValue(sseChannel);

    await expect(
      handleGenerateShotStream(
        service as unknown as ContinuitySessionService,
        session,
        buildRequest(),
        buildResponse(),
        {} as UserCreditService
      )
    ).resolves.toBeUndefined();

    expect(mocks.settleSuccessfulShotGeneration).toHaveBeenCalledTimes(1);
    expect(sseChannel.close).toHaveBeenCalledTimes(1);
  });

  it('sends keepalive ping events every 15 seconds while generation is in-flight', async () => {
    vi.useFakeTimers();

    const session = buildSession();
    const result = buildShot({ status: 'completed' });
    const sseChannel = createSseChannel();
    const deferred = createDeferred<ContinuityShot>();
    const service = {
      generateShot: vi.fn(() => deferred.promise),
    };

    mocks.createSseChannel.mockReturnValue(sseChannel);

    const runPromise = handleGenerateShotStream(
      service as unknown as ContinuitySessionService,
      session,
      buildRequest(),
      buildResponse(),
      {} as UserCreditService
    );

    await vi.advanceTimersByTimeAsync(15_000);
    expect(sseChannel.sendEvent).toHaveBeenCalledWith(
      'ping',
      expect.objectContaining({ timestamp: expect.any(Number) })
    );

    deferred.resolve(result);
    await runPromise;
  });
});
