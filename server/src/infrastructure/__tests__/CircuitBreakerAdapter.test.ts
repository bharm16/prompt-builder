import { describe, expect, it, vi } from 'vitest';

const { FakeBreaker } = vi.hoisted(() => {
  class FakeBreaker {
    public opened = false;
    public halfOpen = false;
    public readonly options: Record<string, unknown>;
    private readonly action: (fn: () => Promise<unknown>) => Promise<unknown>;
    private readonly handlers = new Map<string, () => void>();

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

import { CircuitBreakerAdapter, CircuitBreakerFactory } from '../CircuitBreakerAdapter';

describe('CircuitBreakerAdapter', () => {
  it('executes wrapped function and returns result', async () => {
    const breaker = new CircuitBreakerAdapter({ name: 'unit-test' });

    await expect(breaker.execute(async () => 'ok')).resolves.toBe('ok');
  });

  it('reports state transitions for closed, open, and half-open', () => {
    const adapter = new CircuitBreakerAdapter({ name: 'state-test' });
    const internal = (adapter as unknown as { breaker: InstanceType<typeof FakeBreaker> }).breaker;

    expect(adapter.getState()).toBe('closed');
    expect(adapter.isOpen()).toBe(false);

    internal.opened = true;
    expect(adapter.getState()).toBe('open');
    expect(adapter.isOpen()).toBe(true);

    internal.opened = false;
    internal.halfOpen = true;
    expect(adapter.getState()).toBe('half-open');
  });

  it('wires open/half-open/close events to logger and metrics collector', () => {
    const logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };
    const metricsCollector = {
      updateCircuitBreakerState: vi.fn(),
    };

    const adapter = new CircuitBreakerAdapter({
      name: 'events-test',
      logger: logger as never,
      metricsCollector: metricsCollector as never,
    });
    const internal = (adapter as unknown as { breaker: InstanceType<typeof FakeBreaker> }).breaker;

    expect(metricsCollector.updateCircuitBreakerState).toHaveBeenCalledWith('events-test', 'closed');

    internal.emit('open');
    internal.emit('halfOpen');
    internal.emit('close');

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(metricsCollector.updateCircuitBreakerState).toHaveBeenCalledWith('events-test', 'open');
    expect(metricsCollector.updateCircuitBreakerState).toHaveBeenCalledWith('events-test', 'half-open');
    expect(metricsCollector.updateCircuitBreakerState).toHaveBeenCalledWith('events-test', 'closed');
  });

  it('passes timeout and threshold configuration to opossum', () => {
    const adapter = new CircuitBreakerAdapter({
      name: 'config-test',
      timeout: 1234,
      errorThresholdPercentage: 70,
      resetTimeout: 4321,
    });
    const internal = (adapter as unknown as { breaker: InstanceType<typeof FakeBreaker> }).breaker;

    expect(internal.options.timeout).toBe(1234);
    expect(internal.options.errorThresholdPercentage).toBe(70);
    expect(internal.options.resetTimeout).toBe(4321);
  });
});

describe('CircuitBreakerFactory', () => {
  it('reuses breaker instances by name and clears cache', () => {
    const factory = new CircuitBreakerFactory({});
    const first = factory.create('service-a');
    const second = factory.create('service-a');
    expect(first).toBe(second);

    factory.clear();
    expect(factory.get('service-a')).toBeUndefined();
  });
});
