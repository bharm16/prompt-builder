import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer, createContainer } from '../../../../server/src/infrastructure/DIContainer.js';

describe('DIContainer', () => {
  let container;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('Constructor', () => {
    it('should initialize with empty services and instances', () => {
      expect(container.services.size).toBe(0);
      expect(container.instances.size).toBe(0);
      expect(container.resolving.size).toBe(0);
    });
  });

  describe('register', () => {
    it('should register a service with no dependencies', () => {
      const factory = () => ({ name: 'test-service' });

      container.register('testService', factory, []);

      expect(container.has('testService')).toBe(true);
      expect(container.getServiceNames()).toContain('testService');
    });

    it('should register a service with dependencies', () => {
      const depFactory = () => ({ value: 42 });
      const serviceFactory = (dep) => ({ dependency: dep });

      container.register('dependency', depFactory, []);
      container.register('service', serviceFactory, ['dependency']);

      expect(container.has('service')).toBe(true);
    });

    it('should default to singleton lifecycle', () => {
      const factory = () => ({ id: Math.random() });
      container.register('service', factory);

      const instance1 = container.resolve('service');
      const instance2 = container.resolve('service');

      expect(instance1).toBe(instance2); // Same instance
      expect(instance1.id).toBe(instance2.id);
    });

    it('should support transient lifecycle when specified', () => {
      const factory = () => ({ id: Math.random() });
      container.register('service', factory, [], { singleton: false });

      const instance1 = container.resolve('service');
      const instance2 = container.resolve('service');

      expect(instance1).not.toBe(instance2); // Different instances
      expect(instance1.id).not.toBe(instance2.id);
    });

    it('should throw error if factory is not a function', () => {
      expect(() => {
        container.register('service', 'not-a-function', []);
      }).toThrow("Factory for service 'service' must be a function");
    });

    it('should throw error if dependencies is not an array', () => {
      const factory = () => ({});

      expect(() => {
        container.register('service', factory, 'not-an-array');
      }).toThrow("Dependencies for service 'service' must be an array");
    });
  });

  describe('registerValue', () => {
    it('should register a pre-instantiated value', () => {
      const value = { config: 'test', port: 3000 };

      container.registerValue('config', value);

      const resolved = container.resolve('config');
      expect(resolved).toBe(value);
      expect(resolved.config).toBe('test');
      expect(resolved.port).toBe(3000);
    });

    it('should treat registered values as singletons', () => {
      const value = { data: 'shared' };
      container.registerValue('sharedValue', value);

      const instance1 = container.resolve('sharedValue');
      const instance2 = container.resolve('sharedValue');

      expect(instance1).toBe(instance2);
    });

    it('should be immediately available in instances map', () => {
      const value = { immediate: true };
      container.registerValue('immediate', value);

      expect(container.instances.has('immediate')).toBe(true);
      expect(container.instances.get('immediate')).toBe(value);
    });
  });

  describe('resolve', () => {
    it('should resolve a service with no dependencies', () => {
      container.register('simple', () => ({ value: 'hello' }));

      const service = container.resolve('simple');

      expect(service).toBeDefined();
      expect(service.value).toBe('hello');
    });

    it('should resolve a service with one dependency', () => {
      container.register('logger', () => ({ log: (msg) => msg }));
      container.register('service', (logger) => ({
        logger,
        doWork: () => logger.log('working'),
      }), ['logger']); // Must specify dependencies array

      const service = container.resolve('service');

      expect(service.logger).toBeDefined();
      expect(service.doWork()).toBe('working');
    });

    it('should resolve a service with multiple dependencies', () => {
      container.register('config', () => ({ env: 'test' }));
      container.register('logger', () => ({ log: () => {} }));
      container.register('cache', () => ({ get: () => null }));
      container.register('service', (config, logger, cache) => ({
        config,
        logger,
        cache,
      }), ['config', 'logger', 'cache']);

      const service = container.resolve('service');

      expect(service.config).toBeDefined();
      expect(service.logger).toBeDefined();
      expect(service.cache).toBeDefined();
      expect(service.config.env).toBe('test');
    });

    it('should resolve nested dependencies (A depends on B, B depends on C)', () => {
      container.register('database', () => ({ query: () => [] }));
      container.register('repository', (db) => ({
        db,
        findAll: () => db.query(),
      }), ['database']);
      container.register('service', (repo) => ({
        repo,
        getData: () => repo.findAll(),
      }), ['repository']);

      const service = container.resolve('service');

      expect(service.repo).toBeDefined();
      expect(service.repo.db).toBeDefined();
      expect(service.getData()).toEqual([]);
    });

    it('should throw error for missing service', () => {
      expect(() => {
        container.resolve('nonexistent');
      }).toThrow("Service 'nonexistent' not found");
    });

    it('should provide helpful error message listing available services', () => {
      container.register('serviceA', () => ({}));
      container.register('serviceB', () => ({}));

      expect(() => {
        container.resolve('serviceC');
      }).toThrow(/Available services: serviceA, serviceB/);
    });

    it('should detect circular dependencies (A -> B -> A)', () => {
      container.register('serviceA', (serviceB) => ({ serviceB }), ['serviceB']);
      container.register('serviceB', (serviceA) => ({ serviceA }), ['serviceA']);

      expect(() => {
        container.resolve('serviceA');
      }).toThrow(/Circular dependency detected/);
    });

    it('should detect circular dependencies with longer chains (A -> B -> C -> A)', () => {
      container.register('serviceA', (serviceB) => ({ serviceB }), ['serviceB']);
      container.register('serviceB', (serviceC) => ({ serviceC }), ['serviceC']);
      container.register('serviceC', (serviceA) => ({ serviceA }), ['serviceA']);

      expect(() => {
        container.resolve('serviceA');
      }).toThrow(/Circular dependency detected/);
      expect(() => {
        container.resolve('serviceA');
      }).toThrow(/serviceA -> serviceB -> serviceC -> serviceA/);
    });

    it('should provide context when dependency resolution fails', () => {
      container.register('parent', (child) => ({ child }), ['child']);
      // 'child' is not registered

      expect(() => {
        container.resolve('parent');
      }).toThrow("Failed to resolve dependency 'child' for service 'parent'");
    });

    it('should clean up resolving set on successful resolution', () => {
      container.register('service', () => ({}));

      container.resolve('service');

      expect(container.resolving.size).toBe(0);
    });

    it('should clean up resolving set on failed resolution', () => {
      container.register('service', () => {
        throw new Error('Factory error');
      });

      expect(() => {
        container.resolve('service');
      }).toThrow('Factory error');

      expect(container.resolving.size).toBe(0);
    });

    it('should cache singleton instances after first resolution', () => {
      let callCount = 0;
      container.register('service', () => {
        callCount++;
        return { id: callCount };
      });

      const instance1 = container.resolve('service');
      const instance2 = container.resolve('service');

      expect(callCount).toBe(1); // Factory called only once
      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(1);
    });

    it('should not cache transient instances', () => {
      let callCount = 0;
      container.register('service', () => {
        callCount++;
        return { id: callCount };
      }, [], { singleton: false });

      const instance1 = container.resolve('service');
      const instance2 = container.resolve('service');

      expect(callCount).toBe(2); // Factory called twice
      expect(instance1).not.toBe(instance2);
      expect(instance1.id).toBe(1);
      expect(instance2.id).toBe(2);
    });
  });

  describe('resolveMultiple', () => {
    it('should resolve multiple services at once', () => {
      container.register('serviceA', () => ({ name: 'A' }));
      container.register('serviceB', () => ({ name: 'B' }));
      container.register('serviceC', () => ({ name: 'C' }));

      const services = container.resolveMultiple(['serviceA', 'serviceB', 'serviceC']);

      expect(services.serviceA).toBeDefined();
      expect(services.serviceB).toBeDefined();
      expect(services.serviceC).toBeDefined();
      expect(services.serviceA.name).toBe('A');
      expect(services.serviceB.name).toBe('B');
      expect(services.serviceC.name).toBe('C');
    });

    it('should return empty object for empty array', () => {
      const services = container.resolveMultiple([]);

      expect(services).toEqual({});
    });

    it('should throw error if any service cannot be resolved', () => {
      container.register('existing', () => ({}));

      expect(() => {
        container.resolveMultiple(['existing', 'missing']);
      }).toThrow("Service 'missing' not found");
    });
  });

  describe('has', () => {
    it('should return true for registered service', () => {
      container.register('service', () => ({}));

      expect(container.has('service')).toBe(true);
    });

    it('should return false for unregistered service', () => {
      expect(container.has('nonexistent')).toBe(false);
    });

    it('should return true for registered value', () => {
      container.registerValue('value', { data: 'test' });

      expect(container.has('value')).toBe(true);
    });
  });

  describe('getServiceNames', () => {
    it('should return empty array when no services registered', () => {
      expect(container.getServiceNames()).toEqual([]);
    });

    it('should return all registered service names', () => {
      container.register('serviceA', () => ({}));
      container.register('serviceB', () => ({}));
      container.registerValue('valueC', {});

      const names = container.getServiceNames();

      expect(names).toHaveLength(3);
      expect(names).toContain('serviceA');
      expect(names).toContain('serviceB');
      expect(names).toContain('valueC');
    });
  });

  describe('clearInstances', () => {
    it('should clear cached instances but keep service definitions', () => {
      container.register('service', () => ({ id: Math.random() }));

      const instance1 = container.resolve('service');
      container.clearInstances();
      const instance2 = container.resolve('service');

      expect(container.has('service')).toBe(true); // Service still registered
      expect(instance1).not.toBe(instance2); // New instance created
      expect(instance1.id).not.toBe(instance2.id);
    });

    it('should clear resolving set', () => {
      container.resolving.add('test');

      container.clearInstances();

      expect(container.resolving.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all services and instances', () => {
      container.register('serviceA', () => ({}));
      container.register('serviceB', () => ({}));
      container.resolve('serviceA');

      container.clear();

      expect(container.services.size).toBe(0);
      expect(container.instances.size).toBe(0);
      expect(container.resolving.size).toBe(0);
      expect(container.has('serviceA')).toBe(false);
    });
  });

  describe('createChild', () => {
    it('should create a child container with copied service definitions', () => {
      container.register('parent', () => ({ type: 'parent' }));
      container.register('shared', () => ({ type: 'shared' }));

      const child = container.createChild();

      expect(child).toBeInstanceOf(DIContainer);
      expect(child.has('parent')).toBe(true);
      expect(child.has('shared')).toBe(true);
    });

    it('should not share instances with parent', () => {
      container.register('service', () => ({ id: Math.random() }));
      const parentInstance = container.resolve('service');

      const child = container.createChild();
      const childInstance = child.resolve('service');

      expect(parentInstance).not.toBe(childInstance);
      expect(parentInstance.id).not.toBe(childInstance.id);
    });

    it('should allow child to override parent services', () => {
      container.register('service', () => ({ source: 'parent' }));

      const child = container.createChild();
      child.register('service', () => ({ source: 'child' }));

      const parentInstance = container.resolve('service');
      const childInstance = child.resolve('service');

      expect(parentInstance.source).toBe('parent');
      expect(childInstance.source).toBe('child');
    });

    it('should allow child to register new services', () => {
      const child = container.createChild();
      child.register('childOnly', () => ({ value: 'child' }));

      expect(child.has('childOnly')).toBe(true);
      expect(container.has('childOnly')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle factory that returns null', () => {
      container.register('nullable', () => null);

      const result = container.resolve('nullable');

      expect(result).toBeNull();
    });

    it('should handle factory that returns undefined', () => {
      container.register('undefined', () => undefined);

      const result = container.resolve('undefined');

      expect(result).toBeUndefined();
    });

    it('should handle factory that returns primitive values', () => {
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

    it('should handle async factories (returns Promise)', () => {
      container.register('async', async () => ({ value: 'async' }));

      const result = container.resolve('async');

      expect(result).toBeInstanceOf(Promise);
    });

    it('should handle deep dependency chains (5 levels)', () => {
      container.register('level5', () => ({ level: 5 }));
      container.register('level4', (l5) => ({ level: 4, next: l5 }), ['level5']);
      container.register('level3', (l4) => ({ level: 3, next: l4 }), ['level4']);
      container.register('level2', (l3) => ({ level: 2, next: l3 }), ['level3']);
      container.register('level1', (l2) => ({ level: 1, next: l2 }), ['level2']);

      const result = container.resolve('level1');

      expect(result.level).toBe(1);
      expect(result.next.level).toBe(2);
      expect(result.next.next.level).toBe(3);
      expect(result.next.next.next.level).toBe(4);
      expect(result.next.next.next.next.level).toBe(5);
    });

    it('should handle service with empty string name', () => {
      container.register('', () => ({ name: 'empty' }));

      expect(container.has('')).toBe(true);
      expect(container.resolve('')).toEqual({ name: 'empty' });
    });

    it('should handle re-registering a service (overwrites previous)', () => {
      container.register('service', () => ({ version: 1 }));
      container.resolve('service'); // Cache instance

      container.register('service', () => ({ version: 2 }));
      container.clearInstances(); // Clear cache

      const result = container.resolve('service');
      expect(result.version).toBe(2);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should support typical service architecture (repository pattern)', () => {
      // Infrastructure
      container.register('database', () => ({
        query: (sql) => [{ id: 1, name: 'Test' }],
      }));

      // Repository layer
      container.register('userRepository', (db) => ({
        findAll: () => db.query('SELECT * FROM users'),
        findById: (id) => db.query(`SELECT * FROM users WHERE id = ${id}`)[0],
      }), ['database']);

      // Service layer
      container.register('userService', (repo) => ({
        getUsers: () => repo.findAll(),
        getUser: (id) => repo.findById(id),
      }), ['userRepository']);

      const userService = container.resolve('userService');
      const users = userService.getUsers();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Test');
    });

    it('should support configuration injection pattern', () => {
      container.registerValue('config', {
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        timeout: 5000,
      });

      container.register('apiClient', (config) => ({
        fetch: (endpoint) => `${config.baseUrl}${endpoint}`,
        apiKey: config.apiKey,
        timeout: config.timeout,
      }), ['config']);

      const client = container.resolve('apiClient');

      expect(client.fetch('/users')).toBe('https://api.example.com/users');
      expect(client.apiKey).toBe('test-key');
    });

    it('should support multiple consumers of same service', () => {
      container.register('logger', () => ({
        logs: [],
        log: function(msg) { this.logs.push(msg); },
      }));

      container.register('serviceA', (logger) => ({
        doWork: () => logger.log('A worked'),
      }), ['logger']);

      container.register('serviceB', (logger) => ({
        doWork: () => logger.log('B worked'),
      }), ['logger']);

      const serviceA = container.resolve('serviceA');
      const serviceB = container.resolve('serviceB');
      const logger = container.resolve('logger');

      serviceA.doWork();
      serviceB.doWork();

      // Both services share the same logger instance
      expect(logger.logs).toEqual(['A worked', 'B worked']);
    });
  });
});

describe('createContainer', () => {
  it('should create a new DIContainer instance', () => {
    const container = createContainer();

    expect(container).toBeInstanceOf(DIContainer);
  });

  it('should create independent containers', () => {
    const container1 = createContainer();
    const container2 = createContainer();

    container1.register('service', () => ({}));

    expect(container1.has('service')).toBe(true);
    expect(container2.has('service')).toBe(false);
  });
});
