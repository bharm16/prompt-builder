import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchHttpTransport } from '../FetchHttpTransport';

describe('FetchHttpTransport retry policy regression', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not retry mutating requests without Idempotency-Key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const transport = new FetchHttpTransport({
      enabled: true,
      maxRetries: 3,
      retryDelay: 1,
      retryableStatuses: [503],
    });

    const response = await transport.send('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'test' }),
    });

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries mutating requests when Idempotency-Key is present', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const transport = new FetchHttpTransport({
      enabled: true,
      maxRetries: 3,
      retryDelay: 1,
      retryableStatuses: [503],
    });

    const response = await transport.send('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-key-1',
      },
      body: JSON.stringify({ prompt: 'test' }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('continues to retry safe GET requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const transport = new FetchHttpTransport({
      enabled: true,
      maxRetries: 2,
      retryDelay: 1,
      retryableStatuses: [503],
    });

    const response = await transport.send('/test', {
      method: 'GET',
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry network errors for mutating requests without Idempotency-Key', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network fail'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const transport = new FetchHttpTransport({
      enabled: true,
      maxRetries: 3,
      retryDelay: 1,
      retryableStatuses: [503],
    });

    await expect(
      transport.send('/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'test' }),
      })
    ).rejects.toThrow('network fail');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Keep global fetch stable across suites.
  afterAll(() => {
    global.fetch = originalFetch;
  });
});
