/**
 * Simple Dependency Injection Container
 * 
 * SOLID Principles Applied:
 * - SRP: Manages dependency creation and resolution
 * - OCP: New dependencies registered without modifying container
 * - DIP: Enables inversion of control
 */
export class DependencyContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  /**
   * Register a service factory
   * @param {string} name - Service name
   * @param {Function} factory - Factory function to create service
   * @param {Object} options - Registration options
   */
  register(name, factory, options = {}) {
    this.services.set(name, {
      factory,
      singleton: options.singleton !== false, // Default to singleton
    });
  }

  /**
   * Register a singleton instance
   * @param {string} name - Service name
   * @param {any} instance - Service instance
   */
  registerInstance(name, instance) {
    this.singletons.set(name, instance);
  }

  /**
   * Resolve a service by name
   * @param {string} name - Service name
   * @returns {any} Service instance
   */
  resolve(name) {
    // Check if singleton instance exists
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
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

    return instance;
  }

  /**
   * Check if service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name) || this.singletons.has(name);
  }
}
