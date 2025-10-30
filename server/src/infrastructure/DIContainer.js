/**
 * Dependency Injection Container
 *
 * Simple but powerful DI container that:
 * - Manages service lifecycle (singletons)
 * - Resolves dependencies automatically
 * - Provides clear error messages for missing dependencies
 * - Supports both class-based and factory-based registration
 *
 * Why DI?
 * - Decouples service creation from usage
 * - Makes testing easier (inject mocks)
 * - Centralizes configuration
 * - Documents dependencies explicitly
 */
export class DIContainer {
  constructor() {
    this.services = new Map(); // Service definitions
    this.instances = new Map(); // Singleton instances
    this.resolving = new Set(); // Track resolution chain to detect circular dependencies
  }

  /**
   * Register a service with its dependencies
   *
   * @param {string} name - Service name (e.g., 'claudeClient', 'promptOptimizationService')
   * @param {Function} factory - Factory function that creates the service
   * @param {string[]} [dependencies=[]] - Array of dependency names
   * @param {Object} [options={}] - Registration options
   * @param {boolean} [options.singleton=true] - Whether to cache the instance
   *
   * @example
   * container.register('claudeClient',
   *   () => new OpenAIAPIClient(process.env.OPENAI_API_KEY),
   *   []
   * );
   *
   * container.register('promptService',
   *   (claudeClient) => new PromptOptimizationService(claudeClient),
   *   ['claudeClient']
   * );
   */
  register(name, factory, dependencies = [], options = {}) {
    const { singleton = true } = options;

    if (typeof factory !== 'function') {
      throw new Error(`Factory for service '${name}' must be a function`);
    }

    if (!Array.isArray(dependencies)) {
      throw new Error(`Dependencies for service '${name}' must be an array`);
    }

    this.services.set(name, {
      factory,
      dependencies,
      singleton,
    });
  }

  /**
   * Register a value (already instantiated) as a service
   * Useful for configuration objects, constants, etc.
   *
   * @param {string} name - Service name
   * @param {any} value - The value to register
   */
  registerValue(name, value) {
    this.instances.set(name, value);
    this.services.set(name, {
      factory: () => value,
      dependencies: [],
      singleton: true,
    });
  }

  /**
   * Resolve a service by name
   * Recursively resolves all dependencies
   *
   * @param {string} name - Service name to resolve
   * @returns {any} The resolved service instance
   * @throws {Error} If service not found or circular dependency detected
   */
  resolve(name) {
    // Check for circular dependencies
    if (this.resolving.has(name)) {
      const chain = Array.from(this.resolving).join(' -> ');
      throw new Error(
        `Circular dependency detected: ${chain} -> ${name}`
      );
    }

    // Return cached instance if singleton
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    // Get service definition
    const service = this.services.get(name);
    if (!service) {
      throw new Error(
        `Service '${name}' not found. Available services: ${Array.from(
          this.services.keys()
        ).join(', ')}`
      );
    }

    // Mark as resolving (for circular dependency detection)
    this.resolving.add(name);

    try {
      // Resolve dependencies first
      const resolvedDeps = service.dependencies.map((depName) => {
        try {
          return this.resolve(depName);
        } catch (error) {
          throw new Error(
            `Failed to resolve dependency '${depName}' for service '${name}': ${error.message}`
          );
        }
      });

      // Create instance
      const instance = service.factory(...resolvedDeps);

      // Cache if singleton
      if (service.singleton) {
        this.instances.set(name, instance);
      }

      this.resolving.delete(name);
      return instance;
    } catch (error) {
      this.resolving.delete(name);
      throw error;
    }
  }

  /**
   * Resolve multiple services at once
   * Useful for passing to route factories
   *
   * @param {string[]} names - Array of service names
   * @returns {Object} Object with service names as keys and instances as values
   */
  resolveMultiple(names) {
    const result = {};
    for (const name of names) {
      result[name] = this.resolve(name);
    }
    return result;
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   * @returns {string[]}
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all instances (useful for testing)
   * Service definitions remain, but cached instances are cleared
   */
  clearInstances() {
    this.instances.clear();
    this.resolving.clear();
  }

  /**
   * Clear everything (services and instances)
   * Use with caution - mainly for testing
   */
  clear() {
    this.services.clear();
    this.instances.clear();
    this.resolving.clear();
  }

  /**
   * Create a child container that inherits from this one
   * Useful for request-scoped services or testing
   *
   * @returns {DIContainer} Child container
   */
  createChild() {
    const child = new DIContainer();
    // Copy service definitions (not instances)
    for (const [name, service] of this.services.entries()) {
      child.services.set(name, service);
    }
    return child;
  }
}

/**
 * Create a new DI container instance
 * @returns {DIContainer}
 */
export function createContainer() {
  return new DIContainer();
}
