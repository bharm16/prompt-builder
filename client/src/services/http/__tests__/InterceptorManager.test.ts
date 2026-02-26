import { describe, expect, it, vi } from 'vitest';
import { InterceptorManager } from '../InterceptorManager';

describe('InterceptorManager', () => {
  it('runs sync and async interceptors in registration order', async () => {
    const manager = new InterceptorManager<{ value: number; steps: string[] }>();

    manager.use((payload) => ({
      ...payload,
      value: payload.value + 1,
      steps: [...payload.steps, 'sync-1'],
    }));
    manager.use(async (payload) => ({
      ...payload,
      value: payload.value * 2,
      steps: [...payload.steps, 'async-2'],
    }));

    const result = await manager.run({ value: 2, steps: [] });

    expect(result).toEqual({
      value: 6,
      steps: ['sync-1', 'async-2'],
    });
  });

  it('passes through previous payload when interceptor returns undefined', async () => {
    const manager = new InterceptorManager<{ count: number }>();

    manager.use((payload) => ({ count: payload.count + 1 }));
    manager.use(() => undefined);
    manager.use((payload) => ({ count: payload.count + 10 }));

    await expect(manager.run({ count: 1 })).resolves.toEqual({ count: 12 });
  });

  it('clear removes all interceptors', async () => {
    const manager = new InterceptorManager<{ count: number }>();
    manager.use((payload) => ({ count: payload.count + 5 }));
    manager.clear();

    await expect(manager.run({ count: 3 })).resolves.toEqual({ count: 3 });
  });

  it('throws when registering a non-function interceptor', () => {
    const manager = new InterceptorManager<{ value: number }>();

    expect(() => manager.use('not-a-function' as unknown as (payload: { value: number }) => { value: number })).toThrow(
      'Interceptor must be a function'
    );
  });

  it('supports constructor-injected initial interceptors', async () => {
    const interceptor = vi.fn((payload: { value: string }) => ({
      value: `${payload.value}-intercepted`,
    }));

    const manager = new InterceptorManager([interceptor]);

    await expect(manager.run({ value: 'seed' })).resolves.toEqual({ value: 'seed-intercepted' });
    expect(interceptor).toHaveBeenCalledWith({ value: 'seed' });
  });
});
