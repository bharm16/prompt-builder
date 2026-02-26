import { beforeEach, describe, expect, it, vi } from 'vitest';

import { streamWithFetch } from '../streamWithFetch';

const { buildFirebaseAuthHeaders } = vi.hoisted(() => ({
  buildFirebaseAuthHeaders: vi.fn(),
}));

vi.mock('@/services/http/firebaseAuth', () => ({
  buildFirebaseAuthHeaders,
}));

function createStreamingResponse(chunks: string[]): Response {
  const encoded = chunks.map((chunk) => new TextEncoder().encode(chunk));
  let index = 0;

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader: () => ({
        read: vi.fn(async () => {
          if (index < encoded.length) {
            const value = encoded[index++];
            return { done: false, value };
          }
          return { done: true, value: undefined };
        }),
      }),
    },
  } as unknown as Response;
}

describe('streamWithFetch', () => {
  const warn = vi.fn();
  const error = vi.fn();
  const onMessage = vi.fn();
  const onError = vi.fn();
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    buildFirebaseAuthHeaders.mockResolvedValue({ Authorization: 'Bearer token-1' });
  });

  it('parses SSE events across chunk boundaries and emits completion callback', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createStreamingResponse([
        'event: draft\n',
        'data: {"draft":"draft text"}\n\n',
        'event: spans\ndata: {"sp',
        'ans":[{"start":0,"end":5}]}\n\n',
        'event: refined\n',
        'data: {"refined":"refined text","metadata":{"x":1}}\n\n',
      ])
    );
    vi.stubGlobal('fetch', fetchMock);

    const signal = new AbortController().signal;
    await streamWithFetch(
      {
        url: '/api/optimize-stream',
        method: 'POST',
        body: { prompt: 'hello' },
        signal,
        onMessage,
        onError,
        onComplete,
      },
      { log: { warn, error } }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/optimize-stream',
      expect.objectContaining({
        method: 'POST',
        signal,
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-1',
        }),
      })
    );
    expect(onMessage).toHaveBeenNthCalledWith(1, 'draft', { draft: 'draft text' });
    expect(onMessage).toHaveBeenNthCalledWith(2, 'spans', {
      spans: [{ start: 0, end: 5 }],
    });
    expect(onMessage).toHaveBeenNthCalledWith(3, 'refined', {
      refined: 'refined text',
      metadata: { x: 1 },
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('logs malformed SSE payloads and continues parsing later events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createStreamingResponse([
        'event: draft\n',
        'data: {"draft":"first draft"}\n\n',
        'event: spans\n',
        'data: {not-json}\n\n',
        'event: refined\n',
        'data: {"refined":"final"}\n\n',
      ])
    );
    vi.stubGlobal('fetch', fetchMock);

    await streamWithFetch(
      {
        url: '/api/optimize-stream',
        method: 'POST',
        body: { prompt: 'hello' },
        onMessage,
        onError,
      },
      { log: { warn, error } }
    );

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenNthCalledWith(1, 'draft', { draft: 'first draft' });
    expect(onMessage).toHaveBeenNthCalledWith(2, 'refined', { refined: 'final' });
    expect(warn).toHaveBeenCalledWith(
      'Failed to parse SSE data',
      expect.objectContaining({
        dataStr: '{not-json}',
      })
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('propagates HTTP errors with status metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await streamWithFetch(
      {
        url: '/api/optimize-stream',
        method: 'POST',
        body: { prompt: 'hello' },
        onMessage,
        onError,
      },
      { log: { warn, error } }
    );

    expect(onError).toHaveBeenCalledTimes(1);
    const thrown = onError.mock.calls[0]?.[0] as
      | (Error & { status?: number; statusText?: string })
      | undefined;
    expect(thrown).toBeDefined();
    expect(thrown?.message).toContain('HTTP 503');
    expect(thrown?.status).toBe(503);
    expect(thrown?.statusText).toBe('Service Unavailable');
    expect(error).toHaveBeenCalledWith('Streaming fetch error', thrown);
  });

  it('handles missing response body as an error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: null,
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await streamWithFetch(
      {
        url: '/api/optimize-stream',
        method: 'POST',
        body: { prompt: 'hello' },
        onMessage,
        onError,
      },
      { log: { warn, error } }
    );

    expect(onError).toHaveBeenCalledTimes(1);
    const callbackError = onError.mock.calls[0]?.[0] as Error | undefined;
    expect(callbackError).toBeDefined();
    expect(callbackError?.message).toBe('Response body is null');
  });
});
