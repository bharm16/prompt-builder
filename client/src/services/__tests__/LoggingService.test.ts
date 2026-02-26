/**
 * Unit tests for LoggingService
 *
 * Tests trace ID management, timer operations, log persistence,
 * and child logger behavior.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// We need to test the class directly, not the singleton
// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: { MODE: 'development' } } });

// Dynamically import to avoid singleton side effects
let LoggingService: typeof import('../LoggingService');

beforeEach(async () => {
  localStorage.clear();
  vi.restoreAllMocks();
  // Re-import to get fresh module
  LoggingService = await import('../LoggingService');
});

afterEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// generateTraceId
// ---------------------------------------------------------------------------
describe('LoggingService.generateTraceId', () => {
  it('generates trace IDs with trace- prefix', () => {
    const { logger } = LoggingService;
    const id = logger.generateTraceId();
    expect(id).toMatch(/^trace-/);
  });

  it('generates unique trace IDs', () => {
    const { logger } = LoggingService;
    const id1 = logger.generateTraceId();
    const id2 = logger.generateTraceId();
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// setTraceId / clearTraceId
// ---------------------------------------------------------------------------
describe('LoggingService trace ID management', () => {
  it('setTraceId and clearTraceId do not throw', () => {
    const { logger } = LoggingService;
    expect(() => logger.setTraceId('test-trace')).not.toThrow();
    expect(() => logger.clearTraceId()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// startTimer / endTimer
// ---------------------------------------------------------------------------
describe('LoggingService timer operations', () => {
  it('endTimer returns a number after startTimer', () => {
    const { logger } = LoggingService;
    logger.startTimer('op1');
    const duration = logger.endTimer('op1');
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('endTimer returns undefined for unknown operation', () => {
    const { logger } = LoggingService;
    const duration = logger.endTimer('nonexistent');
    expect(duration).toBeUndefined();
  });

  it('endTimer removes the timer (second call returns undefined)', () => {
    const { logger } = LoggingService;
    logger.startTimer('op2');
    logger.endTimer('op2');
    const second = logger.endTimer('op2');
    expect(second).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// child logger
// ---------------------------------------------------------------------------
describe('LoggingService.child', () => {
  it('returns a context logger with debug, info, warn, error methods', () => {
    const { logger } = LoggingService;
    const child = logger.child('TestContext');
    expect(typeof child.debug).toBe('function');
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
  });

  it('child logger methods do not throw', () => {
    const { logger } = LoggingService;
    const child = logger.child('TestContext');
    expect(() => child.debug('msg')).not.toThrow();
    expect(() => child.info('msg')).not.toThrow();
    expect(() => child.warn('msg')).not.toThrow();
    expect(() => child.error('msg')).not.toThrow();
    expect(() => child.error('msg', new Error('test'))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getStoredLogs / clearStoredLogs
// ---------------------------------------------------------------------------
describe('LoggingService log persistence', () => {
  it('getStoredLogs returns empty array when nothing is stored', () => {
    const { logger } = LoggingService;
    expect(logger.getStoredLogs()).toEqual([]);
  });

  it('clearStoredLogs removes stored logs', () => {
    const { logger } = LoggingService;
    localStorage.setItem(
      'prompt_builder_logs',
      JSON.stringify([{ level: 'info', message: 'test', timestamp: 'now' }]),
    );
    logger.clearStoredLogs();
    expect(logger.getStoredLogs()).toEqual([]);
  });

  it('getStoredLogs returns empty array on corrupted data', () => {
    const { logger } = LoggingService;
    localStorage.setItem('prompt_builder_logs', 'not json');
    expect(logger.getStoredLogs()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// exportLogs
// ---------------------------------------------------------------------------
describe('LoggingService.exportLogs', () => {
  it('returns valid JSON string', () => {
    const { logger } = LoggingService;
    const exported = logger.exportLogs();
    expect(() => JSON.parse(exported)).not.toThrow();
  });

  it('returns array content', () => {
    const { logger } = LoggingService;
    const parsed = JSON.parse(logger.exportLogs());
    expect(Array.isArray(parsed)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Convenience methods (do not throw)
// ---------------------------------------------------------------------------
describe('LoggingService convenience methods', () => {
  it('debug does not throw', () => {
    const { logger } = LoggingService;
    expect(() => logger.debug('test', { key: 'value' })).not.toThrow();
  });

  it('info does not throw', () => {
    const { logger } = LoggingService;
    expect(() => logger.info('test')).not.toThrow();
  });

  it('warn does not throw', () => {
    const { logger } = LoggingService;
    expect(() => logger.warn('test')).not.toThrow();
  });

  it('error does not throw', () => {
    const { logger } = LoggingService;
    expect(() => logger.error('test', new Error('boom'))).not.toThrow();
  });

  it('apiCall does not throw on success', () => {
    const { logger } = LoggingService;
    expect(() => logger.apiCall('GET', '/api/test', null, { ok: true }, 100)).not.toThrow();
  });

  it('apiCall does not throw on error', () => {
    const { logger } = LoggingService;
    expect(() =>
      logger.apiCall('POST', '/api/test', null, null, 100, new Error('fail')),
    ).not.toThrow();
  });

  it('component does not throw', () => {
    const { logger } = LoggingService;
    expect(() => logger.component('Button', 'mount')).not.toThrow();
  });

  it('interaction does not throw', () => {
    const { logger } = LoggingService;
    expect(() => logger.interaction('click', 'Button')).not.toThrow();
  });
});
