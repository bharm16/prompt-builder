import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DIContainer } from '../DIContainer';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('error handling', () => {
    it('throws when factory is not a function', () => {
      expect(() =>
        container.register('bad' as string, 'not-a-fn' as unknown as () => void, [])
      ).toThrow("Factory for service 'bad' must be a function");
    });

    it('throws when dependencies is not an array', () => {
      expect(() =>
        container.register('bad-deps', (() => ({ ok: true })) as () => { ok: boolean }, 'oops' as never)
      ).toThrow("Dependencies for service 'bad-deps' must be an array");
    });

    it('detects circular dependencies', () => {
      container.register('a', () => ({ name: 'a' }), ['b']);
      container.register('b', () => ({ name: 'b' }), ['a']);

      expect(() => container.resolve('a')).toThrow('Circular dependency detected');
    });

    it('wraps dependency resolution errors with context', () => {
      container.register('service', () => ({ ok: true }), ['missing']);

      expect(() => container.resolve('service')).toThrow(
        "Failed to resolve dependency 'missing' for service 'service'"
      );
    });
  });

  describe('edge cases', () => {
    it('resolves multiple services in a single call', () => {
      container.registerValue('alpha', { value: 'a' });
      container.registerValue('beta', { value: 'b' });

      const resolved = container.resolveMultiple<{ alpha: { value: string }; beta: { value: string } }>([
        'alpha',
        'beta',
      ]);

      expect(resolved.alpha.value).toBe('a');
      expect(resolved.beta.value).toBe('b');
    });

    it('creates child containers without sharing instances', () => {
      container.register('service', () => ({ id: Math.random() }));
      const parentInstance = container.resolve<{ id: number }>('service');

      const child = container.createChild();
      const childInstance = child.resolve<{ id: number }>('service');

      expect(childInstance).not.toBe(parentInstance);
    });

    it('supports non-singleton registration', () => {
      const factory = vi.fn(() => ({ id: Math.random() }));
      container.register('transient', factory, [], { singleton: false });

      const first = container.resolve<{ id: number }>('transient');
      const second = container.resolve<{ id: number }>('transient');

      expect(first).not.toBe(second);
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it('clears cached singleton instances without removing registrations', () => {
      const factory = vi.fn(() => ({ status: 'ok' }));
      container.register('service', factory, []);

      const first = container.resolve<{ status: string }>('service');
      container.clearInstances();
      const second = container.resolve<{ status: string }>('service');

      expect(first).not.toBe(second);
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe('core behavior', () => {
    it('resolves dependencies and caches singleton instances', () => {
      const factory = vi.fn((value: string) => ({ value }));
      container.registerValue('config', 'ready');
      container.register('service', factory, ['config']);

      const first = container.resolve<{ value: string }>('service');
      const second = container.resolve<{ value: string }>('service');

      expect(first.value).toBe('ready');
      expect(second).toBe(first);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('reports registration metadata correctly', () => {
      container.registerValue('config', { ready: true });
      container.register('service', () => ({ ok: true }));

      expect(container.has('config')).toBe(true);
      expect(container.has('missing')).toBe(false);
      expect(container.getServiceNames()).toEqual(expect.arrayContaining(['config', 'service']));
    });
  });
});
