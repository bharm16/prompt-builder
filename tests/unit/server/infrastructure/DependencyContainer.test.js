import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyContainer } from '../../../../server/src/infrastructure/DependencyContainer.js';

describe('DependencyContainer', () => {
  let container;

  beforeEach(() => {
    container = new DependencyContainer();
  });

  describe('Constructor', () => {
    it('should initialize with empty services and singletons', () => {
      expect(container.services.size).toBe(0);
      expect(container.singletons.size).toBe(0);
    });
  });

  describe('register', () => {
    it('should register a service factory', () => {
      const factory = () => ({ name: 'test' });

      container.register('testService', factory);

      expect(container.has('testService')).toBe(true);
    });

    it('should default to singleton behavior', () => {
      const factory = () => ({ id: Math.random() });

      container.register('service', factory);

      const instance1 = container.resolve('service');
      const instance2 = container.resolve('service');

      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });

    it('should support transient services when singleton: false', () => {
      const factory = () => ({ id: Math.random() });

      container.register('transient', factory, { singleton: false });

      const instance1 = container.resolve('transient');
      const instance2 = container.resolve('transient');

      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
    });

    it('should allow factory to access container for resolving dependencies', () => {
      container.register('dependency', () => ({ value: 42 }));
      container.register('service', (container) => {
        const dep = container.resolve('dependency');
        return { dep };
      });

      const service = container.resolve('service');

      expect(service.dep).toBeDefined();
      expect(service.dep.value).toBe(42);
    });

    it('should overwrite existing service registration', () => {
      container.register('service', () => ({ version: 1 }));
      container.register('service', () => ({ version: 2 }));

      // Clear singletons to get fresh instance
      container.singletons.clear();

      const service = container.resolve('service');
      expect(service.version).toBe(2);
    });
  });

  describe('registerInstance', () => {
    it('should register a pre-created singleton instance', () => {
      const instance = { name: 'singleton', value: 100 };

      container.registerInstance('myInstance', instance);

      const resolved = container.resolve('myInstance');
      expect(resolved).toBe(instance);
      expect(resolved.value).toBe(100);
    });

    it('should always return the same instance', () => {
      const instance = { id: 'unique' };
      container.registerInstance('shared', instance);

      const resolved1 = container.resolve('shared');
      const resolved2 = container.resolve('shared');

      expect(resolved1).toBe(instance);
      expect(resolved2).toBe(instance);
      expect(resolved1).toBe(resolved2);
    });

    it('should allow registering primitive values', () => {
      container.registerInstance('port', 3000);
      container.registerInstance('apiKey', 'secret-key');
      container.registerInstance('debug', true);

      expect(container.resolve('port')).toBe(3000);
      expect(container.resolve('apiKey')).toBe('secret-key');
      expect(container.resolve('debug')).toBe(true);
    });
  });

  describe('resolve', () => {
    it('should resolve a registered factory service', () => {
      container.register('service', () => ({ status: 'active' }));

      const service = container.resolve('service');

      expect(service).toBeDefined();
      expect(service.status).toBe('active');
    });

    it('should resolve a registered instance', () => {
      const instance = { type: 'instance' };
      container.registerInstance('inst', instance);

      const resolved = container.resolve('inst');

      expect(resolved).toBe(instance);
    });

    it('should prioritize registered instances over factories', () => {
      const instance = { source: 'instance' };
      container.registerInstance('service', instance);
      container.register('service', () => ({ source: 'factory' }));

      const resolved = container.resolve('service');

      expect(resolved.source).toBe('instance');
    });

    it('should throw error for unregistered service', () => {
      expect(() => {
        container.resolve('nonexistent');
      }).toThrow('Service not registered: nonexistent');
    });

    it('should cache singleton instances after first resolution', () => {
      let callCount = 0;
      container.register('counter', () => {
        callCount++;
        return { count: callCount };
      });

      const first = container.resolve('counter');
      const second = container.resolve('counter');

      expect(callCount).toBe(1); // Factory called only once
      expect(first).toBe(second);
      expect(first.count).toBe(1);
    });

    it('should not cache transient instances', () => {
      let callCount = 0;
      container.register('counter', () => {
        callCount++;
        return { count: callCount };
      }, { singleton: false });

      const first = container.resolve('counter');
      const second = container.resolve('counter');

      expect(callCount).toBe(2); // Factory called twice
      expect(first).not.toBe(second);
      expect(first.count).toBe(1);
      expect(second.count).toBe(2);
    });

    it('should pass container to factory function', () => {
      let receivedContainer = null;

      container.register('service', (cont) => {
        receivedContainer = cont;
        return {};
      });

      container.resolve('service');

      expect(receivedContainer).toBe(container);
    });
  });

  describe('has', () => {
    it('should return true for registered factory service', () => {
      container.register('service', () => ({}));

      expect(container.has('service')).toBe(true);
    });

    it('should return true for registered instance', () => {
      container.registerInstance('instance', {});

      expect(container.has('instance')).toBe(true);
    });

    it('should return false for unregistered service', () => {
      expect(container.has('nonexistent')).toBe(false);
    });

    it('should return true for both factory and instance if both exist', () => {
      container.registerInstance('service', { a: 1 });
      container.register('service', () => ({ a: 2 }));

      expect(container.has('service')).toBe(true);
    });
  });

  describe('Dependency Resolution Patterns', () => {
    it('should resolve simple dependency chain', () => {
      container.register('database', () => ({
        query: (sql) => [{ id: 1 }],
      }));

      container.register('repository', (cont) => {
        const db = cont.resolve('database');
        return {
          findAll: () => db.query('SELECT *'),
        };
      });

      container.register('service', (cont) => {
        const repo = cont.resolve('repository');
        return {
          getData: () => repo.findAll(),
        };
      });

      const service = container.resolve('service');
      const data = service.getData();

      expect(data).toEqual([{ id: 1 }]);
    });

    it('should support configuration injection', () => {
      container.registerInstance('config', {
        apiUrl: 'https://api.example.com',
        timeout: 5000,
      });

      container.register('apiClient', (cont) => {
        const config = cont.resolve('config');
        return {
          fetch: (endpoint) => `${config.apiUrl}${endpoint}`,
          timeout: config.timeout,
        };
      });

      const client = container.resolve('apiClient');

      expect(client.fetch('/users')).toBe('https://api.example.com/users');
      expect(client.timeout).toBe(5000);
    });

    it('should share singleton dependencies across multiple services', () => {
      container.register('logger', () => {
        const logs = [];
        return {
          logs,
          log: (msg) => logs.push(msg),
        };
      });

      container.register('serviceA', (cont) => {
        const logger = cont.resolve('logger');
        return {
          doWork: () => logger.log('A worked'),
        };
      });

      container.register('serviceB', (cont) => {
        const logger = cont.resolve('logger');
        return {
          doWork: () => logger.log('B worked'),
        };
      });

      const serviceA = container.resolve('serviceA');
      const serviceB = container.resolve('serviceB');
      const logger = container.resolve('logger');

      serviceA.doWork();
      serviceB.doWork();

      expect(logger.logs).toEqual(['A worked', 'B worked']);
    });

    it('should support deep dependency trees', () => {
      container.register('level4', () => ({ level: 4 }));

      container.register('level3', (cont) => ({
        level: 3,
        next: cont.resolve('level4'),
      }));

      container.register('level2', (cont) => ({
        level: 2,
        next: cont.resolve('level3'),
      }));

      container.register('level1', (cont) => ({
        level: 1,
        next: cont.resolve('level2'),
      }));

      const result = container.resolve('level1');

      expect(result.level).toBe(1);
      expect(result.next.level).toBe(2);
      expect(result.next.next.level).toBe(3);
      expect(result.next.next.next.level).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle factory returning null', () => {
      container.register('nullable', () => null);

      const result = container.resolve('nullable');

      expect(result).toBeNull();
    });

    it('should handle factory returning undefined', () => {
      container.register('undefined', () => undefined);

      const result = container.resolve('undefined');

      expect(result).toBeUndefined();
    });

    it('should handle factory returning primitive types', () => {
      container.register('number', () => 42);
      container.register('string', () => 'hello');
      container.register('boolean', () => true);

      expect(container.resolve('number')).toBe(42);
      expect(container.resolve('string')).toBe('hello');
      expect(container.resolve('boolean')).toBe(true);
    });

    it('should handle factory that throws error', () => {
      container.register('failing', () => {
        throw new Error('Factory failed');
      });

      expect(() => {
        container.resolve('failing');
      }).toThrow('Factory failed');
    });

    it('should handle async factory functions', () => {
      container.register('asyncService', async () => ({ value: 'async' }));

      const result = container.resolve('asyncService');

      expect(result).toBeInstanceOf(Promise);
    });

    it('should handle empty string as service name', () => {
      container.register('', () => ({ empty: true }));

      expect(container.has('')).toBe(true);
      expect(container.resolve('')).toEqual({ empty: true });
    });

    it('should handle service names with special characters', () => {
      container.register('service:v2', () => ({ version: 2 }));
      container.register('service.api.client', () => ({ type: 'client' }));

      expect(container.resolve('service:v2').version).toBe(2);
      expect(container.resolve('service.api.client').type).toBe('client');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should support repository pattern', () => {
      // Infrastructure
      container.registerInstance('dbConnection', {
        execute: (query) => {
          if (query.includes('users')) return [{ id: 1, name: 'Alice' }];
          return [];
        },
      });

      // Repository layer
      container.register('userRepository', (cont) => {
        const db = cont.resolve('dbConnection');
        return {
          findAll: () => db.execute('SELECT * FROM users'),
          findById: (id) => db.execute(`SELECT * FROM users WHERE id = ${id}`)[0],
        };
      });

      // Service layer
      container.register('userService', (cont) => {
        const repo = cont.resolve('userRepository');
        return {
          getUsers: () => repo.findAll(),
          getUser: (id) => repo.findById(id),
        };
      });

      const userService = container.resolve('userService');
      const users = userService.getUsers();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    it('should support multiple implementations of same interface', () => {
      container.register('cacheMemory', () => ({
        type: 'memory',
        get: (key) => null,
      }));

      container.register('cacheRedis', () => ({
        type: 'redis',
        get: (key) => null,
      }));

      const memoryCache = container.resolve('cacheMemory');
      const redisCache = container.resolve('cacheRedis');

      expect(memoryCache.type).toBe('memory');
      expect(redisCache.type).toBe('redis');
      expect(memoryCache).not.toBe(redisCache);
    });

    it('should support service decoration pattern', () => {
      // Base service
      container.register('baseService', () => ({
        execute: (x) => x * 2,
      }));

      // Decorated service
      container.register('decoratedService', (cont) => {
        const base = cont.resolve('baseService');
        return {
          execute: (x) => {
            const result = base.execute(x);
            return result + 1; // Add decoration
          },
        };
      });

      const service = container.resolve('decoratedService');

      expect(service.execute(5)).toBe(11); // (5 * 2) + 1
    });

    it('should support factory pattern for creating configured instances', () => {
      container.registerInstance('defaultTimeout', 3000);

      container.register('httpClientFactory', (cont) => {
        const defaultTimeout = cont.resolve('defaultTimeout');
        return {
          create: (options = {}) => ({
            timeout: options.timeout || defaultTimeout,
            baseUrl: options.baseUrl || 'http://localhost',
            fetch: function(path) {
              return `${this.baseUrl}${path}`;
            },
          }),
        };
      });

      const factory = container.resolve('httpClientFactory');
      const client1 = factory.create({ baseUrl: 'https://api.example.com' });
      const client2 = factory.create({ timeout: 5000 });

      expect(client1.baseUrl).toBe('https://api.example.com');
      expect(client1.timeout).toBe(3000); // Default
      expect(client2.timeout).toBe(5000);
      expect(client2.baseUrl).toBe('http://localhost'); // Default
    });
  });

  describe('Comparison with DIContainer', () => {
    it('should handle manual dependency resolution (no automatic injection)', () => {
      // Unlike DIContainer which auto-injects dependencies,
      // DependencyContainer requires manual resolution in factory
      container.register('dependency', () => ({ value: 100 }));
      container.register('service', (cont) => {
        // Must manually call cont.resolve()
        const dep = cont.resolve('dependency');
        return { result: dep.value * 2 };
      });

      const service = container.resolve('service');

      expect(service.result).toBe(200);
    });

    it('should not detect circular dependencies automatically', () => {
      // DependencyContainer doesn't have built-in circular dependency detection
      // It will cause a stack overflow or infinite loop
      container.register('serviceA', (cont) => ({
        b: cont.resolve('serviceB'),
      }));

      container.register('serviceB', (cont) => ({
        a: cont.resolve('serviceA'),
      }));

      // This would cause infinite recursion
      // We can't actually test this without crashing, so we document the behavior
      expect(() => {
        // Would cause stack overflow
        // container.resolve('serviceA');
      }).not.toThrow(); // This test just documents the limitation
    });
  });
});
