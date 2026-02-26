import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../http/ApiError';
import { ApiClient } from '../ApiClient';

describe('ApiClient', () => {
  it('runs full request pipeline in order and returns handled payload', async () => {
    const builtRequest = {
      url: 'https://api.example.com/resource',
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' },
    };
    const requestBuilder = {
      build: vi.fn().mockReturnValue(builtRequest),
    };

    const requestInterceptors = {
      use: vi.fn(),
      run: vi.fn().mockImplementation(async (request: { url: string; init: RequestInit }) => ({
        ...request,
        init: {
          ...request.init,
          headers: {
            ...(request.init.headers as Record<string, string>),
            Authorization: 'Bearer intercepted',
          },
        },
      })),
    };

    const transportResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const transport = {
      send: vi.fn().mockResolvedValue(transportResponse),
    };

    const responseInterceptors = {
      use: vi.fn(),
      run: vi.fn().mockResolvedValue(transportResponse),
    };

    const responseHandler = {
      handle: vi.fn().mockResolvedValue({ transformed: true }),
      mapError: vi.fn((error: unknown) => error),
    };

    const client = new ApiClient({
      config: {} as never,
      requestBuilder: requestBuilder as never,
      requestInterceptors: requestInterceptors as never,
      transport: transport as never,
      responseInterceptors: responseInterceptors as never,
      responseHandler: responseHandler as never,
    });

    const result = await client.request('/resource', {
      method: 'POST',
      body: { a: 1 },
    });

    expect(requestBuilder.build).toHaveBeenCalledWith('/resource', {
      method: 'POST',
      body: { a: 1 },
    });
    expect(requestInterceptors.run).toHaveBeenCalledWith(builtRequest);
    expect(transport.send).toHaveBeenCalledWith('https://api.example.com/resource', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer intercepted',
      },
      body: '{"a":1}',
    });
    expect(responseInterceptors.run).toHaveBeenCalledWith(transportResponse);
    expect(responseHandler.handle).toHaveBeenCalledWith(transportResponse);
    expect(result).toEqual({ transformed: true });
  });

  it('normalizes thrown errors via responseHandler.mapError', async () => {
    const requestBuilder = {
      build: vi.fn().mockReturnValue({ url: '/x', init: {} }),
    };
    const mapped = new ApiError('Mapped network error');
    const responseHandler = {
      handle: vi.fn(),
      mapError: vi.fn().mockReturnValue(mapped),
    };

    const client = new ApiClient({
      config: {} as never,
      requestBuilder: requestBuilder as never,
      requestInterceptors: { use: vi.fn(), run: vi.fn().mockResolvedValue({ url: '/x', init: {} }) } as never,
      transport: {
        send: vi.fn().mockRejectedValue(new Error('socket failure')),
      } as never,
      responseInterceptors: { use: vi.fn(), run: vi.fn() } as never,
      responseHandler: responseHandler as never,
    });

    await expect(client.request('/x')).rejects.toBe(mapped);
    expect(responseHandler.mapError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('registers request and response interceptors via add* methods', () => {
    const requestInterceptors = {
      use: vi.fn(),
      run: vi.fn(),
    };
    const responseInterceptors = {
      use: vi.fn(),
      run: vi.fn(),
    };

    const client = new ApiClient({
      config: {} as never,
      requestBuilder: { build: vi.fn() } as never,
      requestInterceptors: requestInterceptors as never,
      transport: { send: vi.fn() } as never,
      responseInterceptors: responseInterceptors as never,
      responseHandler: { handle: vi.fn(), mapError: vi.fn() } as never,
    });

    const requestInterceptor = vi.fn();
    const responseInterceptor = vi.fn();

    client.addRequestInterceptor(requestInterceptor);
    client.addResponseInterceptor(responseInterceptor);

    expect(requestInterceptors.use).toHaveBeenCalledWith(requestInterceptor);
    expect(responseInterceptors.use).toHaveBeenCalledWith(responseInterceptor);
  });

  it('get sets method GET and forwards options', async () => {
    const client = new ApiClient();
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    await client.get('/users', { headers: { A: '1' } });

    expect(requestSpy).toHaveBeenCalledWith('/users', {
      headers: { A: '1' },
      method: 'GET',
    });
  });

  it('post sets method POST and body', async () => {
    const client = new ApiClient();
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    await client.post('/users', { name: 'test' }, { timeout: 1000 });

    expect(requestSpy).toHaveBeenCalledWith('/users', {
      timeout: 1000,
      method: 'POST',
      body: { name: 'test' },
    });
  });

  it('put sets method PUT and body', async () => {
    const client = new ApiClient();
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    await client.put('/users/1', { name: 'updated' }, { headers: { A: '2' } });

    expect(requestSpy).toHaveBeenCalledWith('/users/1', {
      headers: { A: '2' },
      method: 'PUT',
      body: { name: 'updated' },
    });
  });

  it('delete sets method DELETE', async () => {
    const client = new ApiClient();
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    await client.delete('/users/1', { signal: new AbortController().signal });

    expect(requestSpy).toHaveBeenCalledWith('/users/1', {
      signal: expect.any(AbortSignal),
      method: 'DELETE',
    });
  });

  it('patch sets method PATCH and body', async () => {
    const client = new ApiClient();
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    await client.patch('/users/1', { active: false }, { fetchOptions: { mode: 'cors' } });

    expect(requestSpy).toHaveBeenCalledWith('/users/1', {
      fetchOptions: { mode: 'cors' },
      method: 'PATCH',
      body: { active: false },
    });
  });
});
