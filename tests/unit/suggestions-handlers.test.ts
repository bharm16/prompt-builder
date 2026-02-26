import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { createSuggestionsHandlers } from '@routes/suggestions/handlers';

function createMockResponse() {
  const response = {
    statusCode: 200,
    payload: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      return this;
    },
  };

  return response as unknown as Response & {
    statusCode: number;
    payload: unknown;
  };
}

function createMockRequest(body: Record<string, unknown>): Request {
  return {
    body,
    id: 'req-test-1',
    headers: {},
  } as unknown as Request;
}

describe('suggestions handlers', () => {
  const llmJudge = {
    evaluateSuggestions: vi.fn(),
    evaluateSingleSuggestion: vi.fn(),
    compareSuggestionSets: vi.fn(),
  };

  const handlers = createSuggestionsHandlers({
    llmJudge: llmJudge as unknown as Parameters<typeof createSuggestionsHandlers>[0]['llmJudge'],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid evaluate payload', async () => {
    const req = createMockRequest({
      suggestions: [],
      context: { highlightedText: 'valid' },
    });
    const res = createMockResponse();

    await handlers.evaluate(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual(
      expect.objectContaining({
        error: 'Invalid request',
      })
    );
  });

  it('propagates error when evaluate judge call fails', async () => {
    llmJudge.evaluateSuggestions.mockRejectedValue(new Error('judge offline'));

    const req = createMockRequest({
      suggestions: [{ text: 'Use wider lens for scale' }],
      context: { highlightedText: 'Use lens' },
    });
    const res = createMockResponse();

    await expect(handlers.evaluate(req, res)).rejects.toThrow('judge offline');
  });

  it('routes explicit rubric to evaluateSuggestions', async () => {
    llmJudge.evaluateSuggestions.mockResolvedValue({
      overallScore: 90,
    });

    const req = createMockRequest({
      suggestions: [{ text: 'Add practical light motivated by neon sign' }],
      context: { highlightedText: 'lighting change', isVideoPrompt: true },
      rubric: 'video',
    });
    const res = createMockResponse();

    await handlers.evaluate(req, res);

    expect(res.statusCode).toBe(200);
    expect(llmJudge.evaluateSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        rubricType: 'video',
      })
    );
  });

  it('falls back to auto rubric when rubric is invalid', async () => {
    llmJudge.evaluateSuggestions.mockResolvedValue({
      overallScore: 88,
    });

    const req = createMockRequest({
      suggestions: [{ text: 'Shift to low-angle framing for dominance' }],
      context: { highlightedText: 'camera angle' },
      rubric: 'invalid-rubric',
    });
    const res = createMockResponse();

    await handlers.evaluate(req, res);

    expect(res.statusCode).toBe(200);
    expect(llmJudge.evaluateSuggestions).toHaveBeenCalledWith(
      expect.not.objectContaining({
        rubricType: expect.anything(),
      })
    );
  });

  it('passes rubric through evaluateSingle and compare endpoints', async () => {
    llmJudge.evaluateSingleSuggestion.mockResolvedValue({ overallScore: 91 });
    llmJudge.compareSuggestionSets.mockResolvedValue({
      winner: 'A',
      scoreDifference: 5,
    });

    const singleReq = createMockRequest({
      suggestion: 'Use backlight to separate the subject',
      context: { highlightedText: 'light' },
      rubric: 'general',
    });
    const singleRes = createMockResponse();
    await handlers.evaluateSingle(singleReq, singleRes);

    expect(singleRes.statusCode).toBe(200);
    expect(llmJudge.evaluateSingleSuggestion).toHaveBeenCalledWith(
      'Use backlight to separate the subject',
      expect.any(Object),
      'general'
    );

    const compareReq = createMockRequest({
      setA: [{ text: 'Add practical tungsten lamp for warmth' }],
      setB: [{ text: 'Add cool moonlight fill from window' }],
      context: { highlightedText: 'lighting' },
      rubric: 'video',
    });
    const compareRes = createMockResponse();
    await handlers.compare(compareReq, compareRes);

    expect(compareRes.statusCode).toBe(200);
    expect(llmJudge.compareSuggestionSets).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.any(Object),
      'video'
    );
  });
});
