import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { logger } from './Logger.js';

/**
 * OpenTelemetry Tracing Service
 *
 * Provides distributed tracing for the application
 * Tracks requests through the entire system including:
 * - HTTP requests/responses
 * - Service method calls
 * - External API calls (Claude)
 * - Cache operations
 *
 * Usage:
 * import { tracingService } from './infrastructure/TracingService.js';
 *
 * // Trace a function
 * await tracingService.traceAsync('operation-name', async (span) => {
 *   span.setAttribute('custom.attribute', value);
 *   return await doWork();
 * });
 *
 * Performance Impact: ~0.1-0.5ms per span
 */
export class TracingService {
  constructor(config = {}) {
    this.config = {
      serviceName: config.serviceName || 'prompt-builder-api',
      serviceVersion: config.serviceVersion || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      enabled: config.enabled !== false && process.env.ENABLE_TRACING !== 'false',
      ...config,
    };

    this.tracer = null;
    this.provider = null;

    if (this.config.enabled) {
      this.initialize();
    } else {
      logger.info('Tracing is disabled');
    }
  }

  /**
   * Initialize OpenTelemetry tracing
   */
  initialize() {
    try {
      // Create resource with service information
      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
        })
      );

      // Create tracer provider
      this.provider = new NodeTracerProvider({
        resource,
      });

      // Add span processor
      // In production, use BatchSpanProcessor with OTLP exporter
      // For now, use Console exporter for development
      const exporter = new ConsoleSpanExporter();
      this.provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

      // Register the provider
      this.provider.register();

      // Get tracer
      this.tracer = trace.getTracer(
        this.config.serviceName,
        this.config.serviceVersion
      );

      // Register automatic instrumentations
      registerInstrumentations({
        instrumentations: [
          new HttpInstrumentation({
            requestHook: (span, request) => {
              span.setAttribute('http.user_agent', request.headers['user-agent']);
            },
          }),
          new ExpressInstrumentation({
            requestHook: (span, info) => {
              span.setAttribute('express.route', info.route);
            },
          }),
        ],
      });

      logger.info('OpenTelemetry tracing initialized', {
        serviceName: this.config.serviceName,
        environment: this.config.environment,
      });
    } catch (error) {
      logger.error('Failed to initialize tracing', error);
      this.config.enabled = false;
    }
  }

  /**
   * Get the tracer instance
   */
  getTracer() {
    return this.tracer;
  }

  /**
   * Create a new span for an operation
   * @param {string} name - Span name
   * @param {Function} fn - Function to execute within span
   * @param {Object} attributes - Additional span attributes
   */
  async traceAsync(name, fn, attributes = {}) {
    if (!this.config.enabled || !this.tracer) {
      // If tracing disabled, execute function without tracing
      return await fn(null);
    }

    const span = this.tracer.startSpan(name);

    // Add custom attributes
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });

    try {
      // Execute function within span context
      const result = await context.with(
        trace.setSpan(context.active(), span),
        async () => await fn(span)
      );

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create a span for synchronous operations
   */
  trace(name, fn, attributes = {}) {
    if (!this.config.enabled || !this.tracer) {
      return fn(null);
    }

    const span = this.tracer.startSpan(name);

    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });

    try {
      const result = context.with(trace.setSpan(context.active(), span), () =>
        fn(span)
      );

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add event to current span
   */
  addEvent(name, attributes = {}) {
    if (!this.config.enabled) return;

    const span = trace.getSpan(context.active());
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set attribute on current span
   */
  setAttribute(key, value) {
    if (!this.config.enabled) return;

    const span = trace.getSpan(context.active());
    if (span) {
      span.setAttribute(key, value);
    }
  }

  /**
   * Express middleware for tracing
   */
  middleware() {
    return (req, res, next) => {
      if (!this.config.enabled || !this.tracer) {
        return next();
      }

      // Span is automatically created by ExpressInstrumentation
      // Just add custom attributes
      const span = trace.getSpan(context.active());
      if (span) {
        span.setAttribute('request.id', req.id);
        span.setAttribute('request.path', req.path);
        span.setAttribute('request.method', req.method);

        if (req.body?.mode) {
          span.setAttribute('request.mode', req.body.mode);
        }
      }

      next();
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.provider) {
      await this.provider.shutdown();
      logger.info('Tracing service shut down');
    }
  }
}

// Singleton instance
export const tracingService = new TracingService({
  serviceName: 'prompt-builder-api',
  serviceVersion: '1.0.0',
});

/**
 * Decorator for tracing service methods
 * Usage:
 *
 * class MyService {
 *   @traced('myOperation')
 *   async doWork() { ... }
 * }
 */
export function traced(operationName, attributes = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const spanName = `${target.constructor.name}.${operationName || propertyKey}`;

      return await tracingService.traceAsync(
        spanName,
        async (span) => {
          // Add method-specific attributes
          Object.entries(attributes).forEach(([key, value]) => {
            span?.setAttribute(key, value);
          });

          return await originalMethod.apply(this, args);
        },
        attributes
      );
    };

    return descriptor;
  };
}
