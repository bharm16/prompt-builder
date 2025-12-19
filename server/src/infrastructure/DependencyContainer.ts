/**
 * Simple Dependency Injection Container
 * 
 * SOLID Principles Applied:
 * - SRP: Manages dependency creation and resolution
 * - OCP: New dependencies registered without modifying container
 * - DIP: Enables inversion of control
 */

interface ServiceDefinition {
  factory: (container: DependencyContainer) => unknown;
  singleton: boolean;
}

/**
 * Simple Dependency Injection Container
 */
export class DependencyContainer {
  private services: Map<string, ServiceDefinition>;
  private singletons: Map<string, unknown>;

  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  /**
   * Register a service factory
   */
  register(
    name: string,
    factory: (container: DependencyContainer) => unknown,
    options: { singleton?: boolean } = {}
  ): void {
    this.services.set(name, {
      factory,
      singleton: options.singleton !== false, // Default to singleton
    });
  }

  /**
   * Register a singleton instance
   */
  registerInstance(name: string, instance: unknown): void {
    this.singletons.set(name, instance);
  }

  /**
   * Resolve a service by name
   */
  resolve<T = unknown>(name: string): T {
    // Check if singleton instance exists
    if (this.singletons.has(name)) {
      return this.singletons.get(name) as T;
    }

    // Check if service registered
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not registered: ${name}`);
    }

    // Create instance
    const instance = service.factory(this);

    // Store if singleton
    if (service.singleton) {
      this.singletons.set(name, instance);
    }

    return instance as T;
  }

  /**
   * Check if service is registered
   */
  has(name: string): boolean {
    return this.services.has(name) || this.singletons.has(name);
  }
}

