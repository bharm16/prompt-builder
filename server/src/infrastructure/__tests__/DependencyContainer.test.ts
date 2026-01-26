import { describe, it, expect } from 'vitest';
import { DependencyContainer } from '../DependencyContainer';

describe('DependencyContainer', () => {
  describe('error handling', () => {
    it('throws when resolving an unregistered service', () => {
      const container = new DependencyContainer();

      expect(() => container.resolve('missing')).toThrow('Service not registered: missing');
    });

    it('propagates factory errors', () => {
      const container = new DependencyContainer();
      container.register('bad', () => {
        throw new Error('boom');
      });

      expect(() => container.resolve('bad')).toThrow('boom');
    });
  });

  describe('edge cases', () => {
    it('returns new instances when singleton is false', () => {
      const container = new DependencyContainer();
      container.register('transient', () => ({ id: Math.random() }), { singleton: false });

      const first = container.resolve<{ id: number }>('transient');
      const second = container.resolve<{ id: number }>('transient');

      expect(first).not.toBe(second);
    });

    it('returns registered instances immediately', () => {
      const container = new DependencyContainer();
      const instance = { ready: true };
      container.registerInstance('cached', instance);

      const resolved = container.resolve<{ ready: boolean }>('cached');

      expect(resolved).toBe(instance);
      expect(container.has('cached')).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('caches singleton instances by default', () => {
      const container = new DependencyContainer();
      let calls = 0;
      container.register('singleton', () => ({ id: ++calls }));

      const first = container.resolve<{ id: number }>('singleton');
      const second = container.resolve<{ id: number }>('singleton');

      expect(first).toBe(second);
      expect(first.id).toBe(1);
    });
  });
});
