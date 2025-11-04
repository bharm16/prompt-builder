import CircuitBreaker from 'opossum';

/**
 * Circuit Breaker Adapter
 * Wraps opossum circuit breaker to match our interface needs
 * 
 * SOLID Principles Applied:
 * - SRP: Focused on circuit breaker functionality
 * - DIP: Adapts external library to our needs
 */
export class CircuitBreakerAdapter {
  constructor({ name, timeout, errorThresholdPercentage, resetTimeout, logger, metricsCollector }) {
    this.name = name;
    this.logger = logger;
    this.metricsCollector = metricsCollector;
    
    const breakerOptions = {
      timeout: timeout || 60000,
      errorThresholdPercentage: errorThresholdPercentage || 50,
      resetTimeout: resetTimeout || 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name,
    };

    // Create breaker with a pass-through function
    this.breaker = new CircuitBreaker(
      async (fn) => await fn(),
      breakerOptions
    );

    // Setup event handlers
    this.breaker.on('open', () => {
      this.logger?.error(`Circuit breaker OPEN - ${name}`, { name });
      this.metricsCollector?.updateCircuitBreakerState?.(name, 'open');
    });

    this.breaker.on('halfOpen', () => {
      this.logger?.warn(`Circuit breaker HALF-OPEN - ${name}`, { name });
      this.metricsCollector?.updateCircuitBreakerState?.(name, 'half-open');
    });

    this.breaker.on('close', () => {
      this.logger?.info(`Circuit breaker CLOSED - ${name}`, { name });
      this.metricsCollector?.updateCircuitBreakerState?.(name, 'closed');
    });

    // Initialize state
    this.metricsCollector?.updateCircuitBreakerState?.(name, 'closed');
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @returns {Promise<any>} Function result
   */
  async execute(fn) {
    return await this.breaker.fire(fn);
  }

  /**
   * Get current circuit state
   * @returns {string} 'open' | 'closed' | 'half-open'
   */
  getState() {
    if (this.breaker.opened) return 'open';
    if (this.breaker.halfOpen) return 'half-open';
    return 'closed';
  }

  /**
   * Check if circuit is open
   * @returns {boolean}
   */
  isOpen() {
    return this.breaker.opened;
  }
}

/**
 * Circuit Breaker Factory
 * Creates circuit breakers with consistent configuration
 */
export class CircuitBreakerFactory {
  constructor({ logger, metricsCollector, defaultConfig = {} }) {
    this.logger = logger;
    this.metricsCollector = metricsCollector;
    this.defaultConfig = defaultConfig;
    this.breakers = new Map();
  }

  /**
   * Create or get a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {Object} config - Circuit breaker configuration
   * @returns {CircuitBreakerAdapter}
   */
  create(name, config = {}) {
    if (this.breakers.has(name)) {
      return this.breakers.get(name);
    }

    const breaker = new CircuitBreakerAdapter({
      name,
      ...this.defaultConfig,
      ...config,
      logger: this.logger,
      metricsCollector: this.metricsCollector,
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Get existing circuit breaker
   * @param {string} name - Circuit breaker name
   * @returns {CircuitBreakerAdapter|null}
   */
  get(name) {
    return this.breakers.get(name) || null;
  }
}
