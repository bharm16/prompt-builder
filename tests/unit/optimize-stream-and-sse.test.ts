import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

import {
  createMockSseRequest,
  createMockSseResponse,
  parseSseEvents,
} from './test-helpers/sse';

const {
  normalizeGenerationParamsMock,
  extractUserIdMock,
  loggerMock,
} = vi.hoisted(() => ({
  normalizeGenerationParamsMock: vi.fn(),
  extractUserIdMock: vi.fn(),
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@routes/optimize/normalizeGenerationParams', () => ({
  normalizeGenerationParams: normalizeGenerationParamsMock,
}));

vi.mock('@utils/requestHelpers', () => ({
  extractUserId: extractUserIdMock,
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: loggerMock,
}));

import { createOptimizeStreamHandler } from '@routes/optimize/handlers/optimizeStream';
import { createSseChannel } from '@routes/optimize/sse';

describe('SSE channel helpers', () => {
  it('sets SSE headers, writes handshake, and emits JSON events', () => {
    const req = createMockSseRequest({});
    const res = createMockSseResponse();
    const channel = createSseChannel(req, res as unknown as Response);

    channel.sendEvent('draft', { text: 'hello' });
    channel.close();

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(res.chunks[0]).toContain(': connected');

    const events = parseSseEvents(res.chunks);
    expect(events).toContainEqual({
      event: 'draft',
      data: { text: 'hello' },
    });
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('aborts the signal when the client disconnects after processing starts', () => {
    const req = createMockSseRequest({});
    const res = createMockSseResponse();
    const channel = createSseChannel(req, res as unknown as Response);

    channel.markProcessingStarted();
    res.emitClose();

    expect(channel.signal.aborted).toBe(true);
  });

  it('does not abort when disconnected before processing starts', () => {
    const req = createMockSseRequest({});
    const res = createMockSseResponse();
    const channel = createSseChannel(req, res as unknown as Response);

    res.emitClose();

    expect(channel.signal.aborted).toBe(false);
  });
});

describe('createOptimizeStreamHandler', () => {
  const mockService = {
    optimize: vi.fn(),
    compilePrompt: vi.fn(),
    optimizeTwoStage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    extractUserIdMock.mockReturnValue('user-123');
    normalizeGenerationParamsMock.mockReturnValue({
      normalizedGenerationParams: { steps: 20 },
    });
  });

  it('returns 400 for invalid request body', async () => {
    const req = createMockSseRequest({
      prompt: '',
      mode: 'video',
    });
    const res = createMockSseResponse();
    const handler = createOptimizeStreamHandler(mockService);

    await handler(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.payload).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Invalid request',
      })
    );
    expect(mockService.optimizeTwoStage).not.toHaveBeenCalled();
  });

  it('returns 400 when startImage is provided in streaming mode', async () => {
    const req = createMockSseRequest({
      prompt: 'A cinematic night shot in Tokyo',
      mode: 'video',
      startImage: 'https://images.example.com/start.webp',
    });
    const res = createMockSseResponse();
    const handler = createOptimizeStreamHandler(mockService);

    await handler(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.payload).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
    expect(mockService.optimizeTwoStage).not.toHaveBeenCalled();
  });

  it('returns normalization errors without starting optimization', async () => {
    normalizeGenerationParamsMock.mockReturnValueOnce({
      normalizedGenerationParams: null,
      error: {
        status: 422,
        error: 'Invalid generation params',
        details: 'fps out of range',
      },
    });

    const req = createMockSseRequest({
      prompt: 'A cinematic night shot in Tokyo',
      mode: 'video',
      generationParams: { fps: 999 },
    });
    const res = createMockSseResponse();
    const handler = createOptimizeStreamHandler(mockService);

    await handler(req, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.payload).toEqual({
      success: false,
      error: 'Invalid generation params',
      details: 'fps out of range',
    });
    expect(mockService.optimizeTwoStage).not.toHaveBeenCalled();
  });

  it('emits draft -> spans -> refined -> done ordering', async () => {
    mockService.optimizeTwoStage.mockImplementationOnce(async (request) => {
      request.onDraftChunk?.('draft-delta');
      request.onDraft?.('Draft prompt', {
        spans: [{ start: 0, end: 5, category: 'subject', confidence: 0.8 }],
        meta: { source: 'draft-model' },
      });
      request.onRefinedChunk?.('refined-delta');
      return {
        draft: 'Draft prompt',
        refined: 'Refined prompt',
        refinedSpans: {
          spans: [{ start: 6, end: 12, category: 'camera', confidence: 0.9 }],
          meta: { source: 'refiner' },
        },
        metadata: { quality: 0.92 },
        usedFallback: false,
      };
    });

    const req = createMockSseRequest({
      prompt: 'A cinematic night shot in Tokyo',
      mode: 'video',
    });
    const res = createMockSseResponse();
    const handler = createOptimizeStreamHandler(mockService);

    await handler(req, res as unknown as Response);

    const events = parseSseEvents(res.chunks);
    const eventTypes = events.map((e) => e.event);

    const draftIndex = eventTypes.indexOf('draft');
    const draftSpansIndex = events.findIndex(
      (e) => e.event === 'spans' && (e.data as { source?: string }).source === 'draft'
    );
    const refinedIndex = eventTypes.indexOf('refined');
    const refinedSpansIndex = events.findIndex(
      (e) => e.event === 'spans' && (e.data as { source?: string }).source === 'refined'
    );
    const doneIndex = eventTypes.indexOf('done');

    expect(draftIndex).toBeGreaterThan(-1);
    expect(draftSpansIndex).toBeGreaterThan(draftIndex);
    expect(refinedIndex).toBeGreaterThan(draftSpansIndex);
    expect(refinedSpansIndex).toBeGreaterThan(refinedIndex);
    expect(doneIndex).toBeGreaterThan(refinedSpansIndex);
    expect(eventTypes.at(-1)).toBe('done');
  });

  it('handles client disconnect mid-stream without crashing', async () => {
    const res = createMockSseResponse();
    const req = createMockSseRequest({
      prompt: 'A cinematic night shot in Tokyo',
      mode: 'video',
    });

    mockService.optimizeTwoStage.mockImplementationOnce(async (request) => {
      expect(request.signal.aborted).toBe(false);
      res.emitClose();
      expect(request.signal.aborted).toBe(true);
      return {
        draft: 'draft',
        refined: 'refined',
        metadata: null,
        usedFallback: false,
      };
    });

    const handler = createOptimizeStreamHandler(mockService);
    await expect(handler(req as Request, res as unknown as Response)).resolves.not.toThrow();

    const events = parseSseEvents(res.chunks);
    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).not.toContain('done');
  });
});
