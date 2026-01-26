import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Logger } from '../Logger';
import { runWithRequestContext } from '../requestContext';

const { mockPinoLogger, mockChildLogger, pinoFactory } = vi.hoisted(() => {
  const mockPinoLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  const mockChildLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  mockPinoLogger.child = vi.fn(() => mockChildLogger);
  const pinoFactory = vi.fn(() => mockPinoLogger);
  return { mockPinoLogger, mockChildLogger, pinoFactory };
});

vi.mock('pino', () => ({
  default: pinoFactory,
}));

vi.mock('pino-pretty', () => ({
  default: vi.fn(() => ({ write: vi.fn() })),
}));

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error handling', () => {
    it('includes error details in error logs', () => {
      const logger = new Logger({ includeLogStack: false, includeLogCaller: false });
      const error = new Error('boom');

      logger.error('Failure', error, { requestId: 'req-1', extra: 'context' });

      const [meta, message] = mockPinoLogger.error.mock.calls[0];
      expect(message).toBe('Failure');
      expect(meta).toMatchObject({
        requestId: 'req-1',
        extra: 'context',
        err: {
          errorMessage: 'boom',
          errorName: 'Error',
        },
      });
      expect((meta as { err: { stack?: string } }).err.stack).toBeTypeOf('string');
    });

    it('logs server errors with the error level in requestLogger', () => {
      const logger = new Logger({ includeLogStack: false, includeLogCaller: false });
      const middleware = logger.requestLogger();
      const next = vi.fn();
      const nowSpy = vi.spyOn(Date, 'now');
      nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1500);

      const resEmitter = new EventEmitter();
      const res = Object.assign(resEmitter, {
        statusCode: 500,
        on: resEmitter.on.bind(resEmitter),
      }) as unknown as { statusCode: number; on: EventEmitter['on'] };

      const req = {
        method: 'GET',
        path: '/status',
        get: () => 'agent',
        ip: '127.0.0.1',
        id: 'req-500',
      } as unknown as { method: string; path: string; get: (name: string) => string; ip: string; id?: string };

      middleware(req as any, res as any, next);
      resEmitter.emit('finish');

      const [meta, message] = mockPinoLogger.error.mock.calls[0];
      expect(message).toBe('HTTP Request Error');
      expect(meta).toMatchObject({
        method: 'GET',
        path: '/status',
        statusCode: 500,
        requestId: 'req-500',
        userAgent: 'agent',
        ip: '127.0.0.1',
      });
      expect(meta.duration).toBe(500);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('adds requestId from request context when missing', () => {
      const logger = new Logger({ includeLogStack: false, includeLogCaller: false });

      runWithRequestContext({ requestId: 'ctx-123' }, () => {
        logger.info('Hello');
      });

      const [meta, message] = mockPinoLogger.info.mock.calls[0];
      expect(message).toBe('Hello');
      expect(meta).toMatchObject({ requestId: 'ctx-123' });
    });

    it('includes log stack and caller when configured', () => {
      const logger = new Logger({
        includeLogStack: true,
        includeLogCaller: true,
        logStackLevels: ['info'],
        logStackDepth: 2,
      });

      const appFrame = `${process.cwd()}/server/src/services/Foo.ts:10:5`;
      vi.spyOn(logger as unknown as { captureLogStack: () => string[] }, 'captureLogStack').mockReturnValue([
        `at ${appFrame}`,
        'at node:internal/process/task_queues:96:5',
      ]);

      logger.info('With stack');

      const [meta] = mockPinoLogger.info.mock.calls[0];
      expect((meta as { caller?: string }).caller).toContain('server/src/services/Foo.ts');
      expect((meta as { logStack?: string[] }).logStack).toEqual([
        'server/src/services/Foo.ts:10:5',
      ]);
    });
  });

  describe('core behavior', () => {
    it('creates child loggers with additional bindings', () => {
      const logger = new Logger({ includeLogStack: false, includeLogCaller: false });

      const child = logger.child({ service: 'child' });
      child.info('child message');

      expect(mockPinoLogger.child).toHaveBeenCalledWith({ service: 'child' });
      expect(mockChildLogger.info).toHaveBeenCalled();
      expect(mockPinoLogger.info).not.toHaveBeenCalled();
    });
  });
});
