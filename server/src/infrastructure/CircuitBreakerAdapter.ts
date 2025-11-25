import CircuitBreaker from 'opossum';
import type { ILogger } from '../interfaces/ILogger.ts';
import type { IMetricsCollector } from '../interfaces/IMetricsCollector.ts';

interface CircuitBreakerConfig {
  name: string;
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  logger?: ILogger;
  metricsCollector?: IMetricsCollector;
}

type CircuitState = 'open' | 'closed' | 'half-open';

/**
 * Circuit Breaker Adapter
 * Wraps opossum circuit breaker to match our interface needs
 * 
 * SOLID Principles Applied:
 * - SRP: Focused on circuit breaker functionality
 * - DIP: Adapts external library to our needs
 */
export class CircuitBreakerAdapter {
  private name: string;
  private logger?: ILogger;
  private metricsCollector?: IMetricsCollector;
  private breaker: CircuitBreaker<() => Promise<unknown>, unknown>;

  constructor({
    name,
    timeout = 60000,
    errorThresholdPercentage = 50,
    resetTimeout = 30000,
    logger,
    metricsCollector,
  }: CircuitBreakerConfig) {
    this.name = name;
    this.logger = logger;
    this.metricsCollector = metricsCollector;
    
    const breakerOptions = {
      timeout,
      errorThresholdPercentage,
      resetTimeout,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name,
    };

    // Create breaker with a pass-through function
    this.breaker = new CircuitBreaker(
      async (fn: () => Promise<unknown>) => await fn(),
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
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return await this.breaker.fire(fn) as T;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    if (this.breaker.opened) return 'open';
    if (this.breaker.halfOpen) return 'half-open';
    return 'closed';
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.breaker.opened;
  }
}

interface CircuitBreakerFactoryConfig {
  logger?: ILogger;
  metricsCollector?: IMetricsCollector;
  defaultConfig?: Partial<Omit<CircuitBreakerConfig, 'name' | 'logger' | 'metricsCollector'>>;
}

/**
 * Circuit Breaker Factory
 * Creates circuit breakers with consistent configuration
 */
export class CircuitBreakerFactory {
  private logger?: ILogger;
  private metricsCollector?: IMetricsCollector;
  private defaultConfig: Partial<Omit<CircuitBreakerConfig, 'name' | 'logger' | 'metricsCollector'>>;
  private breakers: Map<string, CircuitBreakerAdapter>;

  constructor({ logger, metricsCollector, defaultConfig = {} }: CircuitBreakerFactoryConfig) {
    this.logger = logger;
    this.metricsCollector = metricsCollector;
    this.defaultConfig = defaultConfig;
    this.breakers = new Map();
  }

  /**
   * Create or get a circuit breaker
   */
  create(name: string, config: Partial<Omit<CircuitBreakerConfig, 'name' | 'logger' | 'metricsCollector'>> = {}): CircuitBreakerAdapter {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const breaker = new CircuitBreakerAdapter({
      name,
      logger: this.logger,
      metricsCollector: this.metricsCollector,
      ...this.defaultConfig,
      ...config,
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Get existing circuit breaker
   */
  get(name: string): CircuitBreakerAdapter | undefined {
    return this.breakers.get(name);
  }

  /**
   * Clear all circuit breakers (useful for testing)
   */
  clear(): void {
    this.breakers.clear();
  }
}

