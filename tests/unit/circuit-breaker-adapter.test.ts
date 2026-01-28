import { describe, expect, it, vi } from 'vitest';

const { FakeBreaker } = vi.hoisted(() => {
  class FakeBreaker {
    public opened = false;
    public halfOpen = false;
    public readonly options: Record<string, unknown>;
    private readonly action: (fn: () => Promise<unknown>) => Promise<unknown>;
    private handlers = new Map<string, () => void>();

    constructor(action: (fn: () => Promise<unknown>) => Promise<unknown>, options: Record<string, unknown>) {
      this.action = action;
      this.options = options;
    }

    fire(fn: () => Promise<unknown>) {
      return this.action(fn);
    }

    on(event: string, handler: () => void) {
      this.handlers.set(event, handler);
      return this;
    }

    emit(event: string) {
      this.handlers.get(event)?.();
    }
  }

  return { FakeBreaker };
});

vi.mock('opossum', () => ({
  default: FakeBreaker,
}));

import { CircuitBreakerAdapter, CircuitBreakerFactory } from '@infrastructure/CircuitBreakerAdapter';

describe('CircuitBreakerAdapter', () => {
  describe('error handling', () => {
    it('propagates errors from the wrapped function', async () => {
      const adapter = new CircuitBreakerAdapter({ name: 'test' });

      await expect(adapter.execute(async () => {
        throw new Error('boom');
      })).rejects.toThrow('boom');
    });
  });

  describe('edge cases', () => {
    it('reflects half-open state when breaker is half-open', () => {
      const adapter = new CircuitBreakerAdapter({ name: 'test' });
      const breaker = (adapter as unknown as { breaker: FakeBreaker }).breaker;
      breaker.halfOpen = true;

      expect(adapter.getState()).toBe('half-open');
    });
  });

  describe('core behavior', () => {
    it('returns successful execution results', async () => {
      const adapter = new CircuitBreakerAdapter({ name: 'test' });

      await expect(adapter.execute(async () => 'ok')).resolves.toBe('ok');
    });
  });
});

describe('CircuitBreakerFactory', () => {
  describe('edge cases', () => {
    it('reuses existing breakers for the same name', () => {
      const factory = new CircuitBreakerFactory({});
      const first = factory.create('service');
      const second = factory.create('service');

      expect(first).toBe(second);
    });
  });

  describe('core behavior', () => {
    it('clears cached breakers', () => {
      const factory = new CircuitBreakerFactory({});
      const breaker = factory.create('service');

      factory.clear();

      expect(factory.get('service')).toBeUndefined();
      expect(breaker).toBeInstanceOf(CircuitBreakerAdapter);
    });
  });
});
