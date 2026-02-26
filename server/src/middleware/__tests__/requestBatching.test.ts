import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const { labelSpansMock, loggerMock } = vi.hoisted(() => ({
  labelSpansMock: vi.fn(),
  loggerMock: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@llm/span-labeling/SpanLabelingService', () => ({
  labelSpans: labelSpansMock,
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: loggerMock,
}));

import { RequestBatchingService } from '../requestBatching';

function createResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function createRequest(body: unknown): Request {
  return { body } as Request;
}

describe('RequestBatchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when body is not an array', async () => {
    const service = new RequestBatchingService();
    const req = createRequest({ text: 'not-array' });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await service.middleware({} as never)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Body must be an array of span labeling requests',
      })
    );
  });

  it('returns 400 when an item is missing text', async () => {
    const service = new RequestBatchingService();
    const req = createRequest([{ text: '' }]);
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await service.middleware({} as never)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Each request must include a non-empty text field',
      })
    );
  });

  it('returns empty array for empty batch', async () => {
    const service = new RequestBatchingService();
    const req = createRequest([]);
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await service.middleware({} as never)(req, res, next);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('returns 400 when batch exceeds max size', async () => {
    const service = new RequestBatchingService({ maxBatchSize: 2 });
    const req = createRequest([
      { text: 'a' },
      { text: 'b' },
      { text: 'c' },
    ]);
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await service.middleware({} as never)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Batch size exceeds maximum of 2',
      })
    );
  });

  it('processes batch results in original order with success/error mapping', async () => {
    const service = new RequestBatchingService({ maxConcurrency: 1 });
    labelSpansMock.mockImplementation(async (request: { text: string }) => {
      if (request.text === 'fail') {
        const error = new Error('boom') as Error & { code?: string };
        error.code = 'SPAN_FAIL';
        throw error;
      }
      return {
        spans: [{ text: request.text, role: 'subject', start: 0, end: request.text.length }],
        meta: { version: 'v1', notes: 'ok' },
      };
    });

    const result = await service.processBatch(
      [{ text: 'ok-1' }, { text: 'fail' }, { text: 'ok-2' }],
      {} as never
    );

    expect(result).toEqual([
      {
        spans: [{ text: 'ok-1', category: 'subject', start: 0, end: 4 }],
        meta: { version: 'v1', notes: 'ok' },
      },
      {
        error: { message: 'boom', code: 'SPAN_FAIL' },
      },
      {
        spans: [{ text: 'ok-2', category: 'subject', start: 0, end: 4 }],
        meta: { version: 'v1', notes: 'ok' },
      },
    ]);
  });
});
