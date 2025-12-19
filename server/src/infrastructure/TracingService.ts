import { trace, context, SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './Logger.ts';

interface TracingConfig {
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  enabled?: boolean;
}

interface TracingServiceConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  enabled: boolean;
}

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
  private config: TracingServiceConfig;
  private tracer: Tracer | null = null;
  private provider: NodeTracerProvider | null = null;

  constructor(config: TracingConfig = {}) {
    this.config = {
      serviceName: config.serviceName || 'prompt-builder-api',
      serviceVersion: config.serviceVersion || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      enabled: config.enabled !== false && process.env.ENABLE_TRACING !== 'false',
    };

    if (this.config.enabled) {
      this.initialize();
    } else {
      logger.info('Tracing is disabled');
    }
  }

  /**
   * Initialize OpenTelemetry tracing
   */
  private initialize(): void {
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
              const headers = request.headers as Record<string, string | string[] | undefined>;
              const userAgent = headers['user-agent'];
              if (userAgent && typeof userAgent === 'string') {
                span.setAttribute('http.user_agent', userAgent);
              }
            },
          }),
          new ExpressInstrumentation({
            requestHook: (span, info) => {
              if (info.route) {
                span.setAttribute('express.route', info.route);
              }
            },
          }),
        ],
      });

      logger.info('OpenTelemetry tracing initialized', {
        serviceName: this.config.serviceName,
        environment: this.config.environment,
      });
    } catch (error) {
      logger.error('Failed to initialize tracing', error instanceof Error ? error : new Error(String(error)));
      this.config.enabled = false;
    }
  }

  /**
   * Get the tracer instance
   */
  getTracer(): Tracer | null {
    return this.tracer;
  }

  /**
   * Create a new span for an operation
   */
  async traceAsync<T>(
    name: string,
    fn: (span: Span | null) => Promise<T>,
    attributes: Record<string, unknown> = {}
  ): Promise<T> {
    if (!this.config.enabled || !this.tracer) {
      // If tracing disabled, execute function without tracing
      return await fn(null);
    }

    const span = this.tracer.startSpan(name);

    // Add custom attributes
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, String(value));
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
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create a span for synchronous operations
   */
  trace<T>(name: string, fn: (span: Span | null) => T, attributes: Record<string, unknown> = {}): T {
    if (!this.config.enabled || !this.tracer) {
      return fn(null);
    }

    const span = this.tracer.startSpan(name);

    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, String(value));
    });

    try {
      const result = context.with(trace.setSpan(context.active(), span), () =>
        fn(span)
      );

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes: Record<string, unknown> = {}): void {
    if (!this.config.enabled) return;

    const span = trace.getSpan(context.active());
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set attribute on current span
   */
  setAttribute(key: string, value: string | number | boolean): void {
    if (!this.config.enabled) return;

    const span = trace.getSpan(context.active());
    if (span) {
      span.setAttribute(key, value);
    }
  }

  /**
   * Express middleware for tracing
   */
  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!this.config.enabled || !this.tracer) {
        return next();
      }

      // Span is automatically created by ExpressInstrumentation
      // Just add custom attributes
      const span = trace.getSpan(context.active());
      if (span) {
        const reqWithId = req as Request & { id?: string };
        span.setAttribute('request.id', reqWithId.id || 'unknown');
        span.setAttribute('request.path', req.path);
        span.setAttribute('request.method', req.method);

        if (req.body && typeof req.body === 'object' && 'mode' in req.body) {
          span.setAttribute('request.mode', String(req.body.mode));
        }
      }

      next();
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
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
export function traced(operationName: string, attributes: Record<string, unknown> = {}) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value;
    if (!originalMethod) {
      return descriptor;
    }

    descriptor.value = (async function (this: unknown, ...args: Parameters<T>): Promise<ReturnType<T>> {
      const spanName = `${(target as { constructor: { name: string } }).constructor.name}.${operationName || propertyKey}`;

      return await tracingService.traceAsync(
        spanName,
        async (span) => {
          // Add method-specific attributes
          Object.entries(attributes).forEach(([key, value]) => {
            span?.setAttribute(key, String(value));
          });

          return await originalMethod.apply(this, args) as ReturnType<T>;
        },
        attributes
      );
    }) as T;

    return descriptor;
  };
}

