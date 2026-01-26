import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TracingService, traced, tracingService } from '../TracingService';

const telemetry = vi.hoisted(() => {
  let activeSpan: any = null;
  let shouldThrow = false;

  const span = {
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    recordException: vi.fn(),
    end: vi.fn(),
    addEvent: vi.fn(),
  };

  const tracer = {
    startSpan: vi.fn(() => span),
  };

  const trace = {
    getTracer: vi.fn(() => tracer),
    setSpan: vi.fn((_ctx: unknown, _span: unknown) => ({ span: _span })),
    getSpan: vi.fn(() => activeSpan),
  };

  const context = {
    active: vi.fn(() => ({ ctx: 'active' })),
    with: vi.fn((ctx: unknown, fn: () => unknown) => fn()),
  };

  class FakeNodeTracerProvider {
    register = vi.fn();
    shutdown = vi.fn(async () => undefined);

    constructor() {
      if (shouldThrow) {
        throw new Error('init-failure');
      }
    }
  }

  const setActiveSpan = (value: unknown) => {
    activeSpan = value;
  };

  const setShouldThrow = (value: boolean) => {
    shouldThrow = value;
  };

  return {
    span,
    tracer,
    trace,
    context,
    FakeNodeTracerProvider,
    setActiveSpan,
    setShouldThrow,
    SpanStatusCode: { OK: 'OK', ERROR: 'ERROR' },
  };
});

const loggerInfoSpy = vi.hoisted(() => vi.fn());
const loggerErrorSpy = vi.hoisted(() => vi.fn());

vi.mock('@opentelemetry/api', () => ({
  trace: telemetry.trace,
  context: telemetry.context,
  SpanStatusCode: telemetry.SpanStatusCode,
}));

vi.mock('@opentelemetry/resources', () => ({
  defaultResource: () => ({
    merge: (other: unknown) => ({ merged: other }),
  }),
  resourceFromAttributes: (attrs: Record<string, unknown>) => ({ attrs }),
}));

vi.mock('@opentelemetry/semantic-conventions', () => ({
  SEMRESATTRS_SERVICE_NAME: 'service.name',
  SEMRESATTRS_SERVICE_VERSION: 'service.version',
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
}));

vi.mock('@opentelemetry/sdk-trace-node', () => ({
  NodeTracerProvider: telemetry.FakeNodeTracerProvider,
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  SimpleSpanProcessor: class {},
  ConsoleSpanExporter: class {},
}));

vi.mock('@opentelemetry/instrumentation-http', () => ({
  HttpInstrumentation: class {
    constructor() {
      return {};
    }
  },
}));

vi.mock('@opentelemetry/instrumentation-express', () => ({
  ExpressInstrumentation: class {
    constructor() {
      return {};
    }
  },
}));

vi.mock('@opentelemetry/instrumentation', () => ({
  registerInstrumentations: vi.fn(),
}));

vi.mock('../Logger.ts', () => ({
  logger: {
    info: loggerInfoSpy,
    error: loggerErrorSpy,
  },
}));

describe('TracingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    telemetry.setActiveSpan(telemetry.span);
    telemetry.setShouldThrow(false);
  });

  describe('error handling', () => {
    it('disables tracing when initialization fails', () => {
      telemetry.setShouldThrow(true);

      const service = new TracingService({ enabled: true, serviceName: 'svc', serviceVersion: '1.0.0' });

      expect(loggerErrorSpy).toHaveBeenCalled();
      expect((service as unknown as { config: { enabled: boolean } }).config.enabled).toBe(false);
    });

    it('records error status and rethrows in traceAsync', async () => {
      const service = new TracingService({ enabled: false });
      (service as unknown as { config: { enabled: boolean } }).config.enabled = true;
      (service as unknown as { tracer: unknown }).tracer = telemetry.tracer as unknown as never;

      const failing = async () => {
        throw new Error('boom');
      };

      await expect(service.traceAsync('op', failing)).rejects.toThrow('boom');
      expect(telemetry.span.recordException).toHaveBeenCalled();
      expect(telemetry.span.setStatus).toHaveBeenCalledWith({
        code: telemetry.SpanStatusCode.ERROR,
        message: 'boom',
      });
      expect(telemetry.span.end).toHaveBeenCalled();
    });

    it('records error status and rethrows in trace', () => {
      const service = new TracingService({ enabled: false });
      (service as unknown as { config: { enabled: boolean } }).config.enabled = true;
      (service as unknown as { tracer: unknown }).tracer = telemetry.tracer as unknown as never;

      expect(() => service.trace('sync', () => {
        throw new Error('sync-fail');
      })).toThrow('sync-fail');

      expect(telemetry.span.recordException).toHaveBeenCalled();
      expect(telemetry.span.setStatus).toHaveBeenCalledWith({
        code: telemetry.SpanStatusCode.ERROR,
        message: 'sync-fail',
      });
      expect(telemetry.span.end).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('bypasses tracing when disabled', async () => {
      const service = new TracingService({ enabled: false });
      const result = await service.traceAsync('disabled', async (span) => {
        return span === null ? 'ok' : 'bad';
      });

      expect(result).toBe('ok');
      expect(telemetry.tracer.startSpan).not.toHaveBeenCalled();
    });

    it('does nothing for addEvent and setAttribute when disabled', () => {
      const service = new TracingService({ enabled: false });
      telemetry.span.addEvent.mockClear();
      telemetry.span.setAttribute.mockClear();

      service.addEvent('event-name', { key: 'value' });
      service.setAttribute('key', 'value');

      expect(telemetry.span.addEvent).not.toHaveBeenCalled();
      expect(telemetry.span.setAttribute).not.toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('adds request attributes in middleware', () => {
      const service = new TracingService({ enabled: false });
      (service as unknown as { config: { enabled: boolean } }).config.enabled = true;
      (service as unknown as { tracer: unknown }).tracer = telemetry.tracer as unknown as never;
      telemetry.span.setAttribute.mockClear();

      const middleware = service.middleware();
      const req = {
        id: 'req-1',
        path: '/test',
        method: 'POST',
        body: { mode: 'fast' },
      } as unknown as { id?: string; path: string; method: string; body?: { mode?: string } };
      const res = {} as unknown as object;
      const next = vi.fn();

      middleware(req as any, res as any, next);

      expect(telemetry.span.setAttribute).toHaveBeenCalledWith('request.id', 'req-1');
      expect(telemetry.span.setAttribute).toHaveBeenCalledWith('request.path', '/test');
      expect(telemetry.span.setAttribute).toHaveBeenCalledWith('request.method', 'POST');
      expect(telemetry.span.setAttribute).toHaveBeenCalledWith('request.mode', 'fast');
      expect(next).toHaveBeenCalled();
    });

    it('wraps methods with traced decorator and forwards attributes', async () => {
      const traceAsyncSpy = vi
        .spyOn(tracingService, 'traceAsync')
        .mockImplementation(async (_name, fn) => await fn(telemetry.span));

      class Demo {
        async work(value: string) {
          return `done-${value}`;
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(Demo.prototype, 'work');
      if (!descriptor) throw new Error('Missing descriptor');
      const wrapped = traced('work', { feature: 'on' })(Demo.prototype, 'work', descriptor);
      Object.defineProperty(Demo.prototype, 'work', wrapped);

      const instance = new Demo();
      const result = await instance.work('task');

      expect(result).toBe('done-task');
      expect(traceAsyncSpy).toHaveBeenCalledWith('Demo.work', expect.any(Function), { feature: 'on' });
      expect(telemetry.span.setAttribute).toHaveBeenCalledWith('feature', 'on');
    });
  });
});
