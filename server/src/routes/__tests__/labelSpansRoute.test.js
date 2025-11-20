import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the span labeling service
vi.mock('../../llm/span-labeling/SpanLabelingService.js', () => ({
  labelSpans: vi.fn(),
}));

// Mock the cache service
vi.mock('../../services/cache/SpanLabelingCacheService.js', () => ({
  spanLabelingCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

const { labelSpans } = await import('../../llm/span-labeling/SpanLabelingService.js');
const { createLabelSpansRoute } = await import('../labelSpansRoute.js');

// Create a mock AI service
const mockAIService = {
  execute: vi.fn(),
  stream: vi.fn(),
};

// Create the route with mock AI service
const labelSpansRoute = createLabelSpansRoute(mockAIService);

const getPostHandler = () => {
  const layer = labelSpansRoute.stack.find(
    (entry) =>
      entry.route &&
      entry.route.path === '/' &&
      entry.route.methods &&
      entry.route.methods.post
  );
  return layer?.route?.stack?.[0]?.handle;
};

const createRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnValue(undefined),
    setHeader: vi.fn(),
  };
  return res;
};

describe('labelSpansRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when text is missing', async () => {
    const handler = getPostHandler();
    const req = { body: { maxSpans: 5 } };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'text is required' });
    expect(labelSpans).not.toHaveBeenCalled();
  });

  it('invokes labelSpans and returns result when valid payload provided', async () => {
    const handler = getPostHandler();
    const mockResult = {
      spans: [
        {
          text: 'Soft light',
          start: 0,
          end: 10,
          role: 'Lighting',
          confidence: 0.92,
        },
      ],
      meta: { version: 'v1', notes: '' },
    };
    labelSpans.mockResolvedValue(mockResult);

    const req = {
      body: {
        text: 'Soft light illuminates the scene.',
        maxSpans: '10',
        minConfidence: 0.5,
        policy: { allowOverlap: false },
        templateVersion: 'v1',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(mockResult);
    expect(labelSpans).toHaveBeenCalledWith(
      {
        text: 'Soft light illuminates the scene.',
        maxSpans: 10,
        minConfidence: 0.5,
        policy: { allowOverlap: false },
        templateVersion: 'v1',
      },
      mockAIService
    );
  });

  it('returns 502 when labelSpans throws', async () => {
    const handler = getPostHandler();
    labelSpans.mockRejectedValue(new Error('LLM failed'));

    const req = {
      body: {
        text: 'Soft light illuminates the scene.',
      },
    };
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'LLM span labeling failed',
      })
    );
  });
});
