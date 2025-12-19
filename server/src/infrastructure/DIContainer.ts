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

interface ServiceDefinition {
  factory: (...dependencies: unknown[]) => unknown;
  dependencies: string[];
  singleton: boolean;
}

interface RegistrationOptions {
  singleton?: boolean;
}

/**
 * Dependency Injection Container
 */
export class DIContainer {
  private services: Map<string, ServiceDefinition>;
  private instances: Map<string, unknown>;
  private resolving: Set<string>;

  constructor() {
    this.services = new Map(); // Service definitions
    this.instances = new Map(); // Singleton instances
    this.resolving = new Set(); // Track resolution chain to detect circular dependencies
  }

  /**
   * Register a service with its dependencies
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
  register(
    name: string,
    factory: (...dependencies: unknown[]) => unknown,
    dependencies: string[] = [],
    options: RegistrationOptions = {}
  ): void {
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
   */
  registerValue(name: string, value: unknown): void {
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
   * @throws {Error} If service not found or circular dependency detected
   */
  resolve<T = unknown>(name: string): T {
    // Check for circular dependencies
    if (this.resolving.has(name)) {
      const chain = Array.from(this.resolving).join(' -> ');
      throw new Error(
        `Circular dependency detected: ${chain} -> ${name}`
      );
    }

    // Return cached instance if singleton
    if (this.instances.has(name)) {
      return this.instances.get(name) as T;
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
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Failed to resolve dependency '${depName}' for service '${name}': ${errorMessage}`
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
      return instance as T;
    } catch (error) {
      this.resolving.delete(name);
      throw error;
    }
  }

  /**
   * Resolve multiple services at once
   * Useful for passing to route factories
   */
  resolveMultiple<T extends Record<string, unknown>>(names: string[]): T {
    const result = {} as T;
    for (const name of names) {
      result[name as keyof T] = this.resolve(name) as T[keyof T];
    }
    return result;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all instances (useful for testing)
   * Service definitions remain, but cached instances are cleared
   */
  clearInstances(): void {
    this.instances.clear();
    this.resolving.clear();
  }

  /**
   * Clear everything (services and instances)
   * Use with caution - mainly for testing
   */
  clear(): void {
    this.services.clear();
    this.instances.clear();
    this.resolving.clear();
  }

  /**
   * Create a child container that inherits from this one
   * Useful for request-scoped services or testing
   */
  createChild(): DIContainer {
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
 */
export function createContainer(): DIContainer {
  return new DIContainer();
}

