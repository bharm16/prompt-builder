import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const logSpies = {
  debug: vi.fn(),
  warn: vi.fn(),
};

const sanitizeErrorMock = vi.fn(() => ({ message: 'storage failure', name: 'Error' }));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => logSpies,
  },
}));

vi.mock('@/utils/logging', () => ({
  sanitizeError: sanitizeErrorMock,
}));

const loadModule = async () => {
  vi.resetModules();
  return await import('@/utils/parserDebug');
};

describe('parserDebug', () => {
  const originalParserDebug = process.env.PARSER_DEBUG;
  const originalLocalStorage = window.localStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    if (originalParserDebug === undefined) {
      delete process.env.PARSER_DEBUG;
    } else {
      process.env.PARSER_DEBUG = originalParserDebug;
    }
  });

  afterEach(() => {
    if (originalParserDebug === undefined) {
      delete process.env.PARSER_DEBUG;
    } else {
      process.env.PARSER_DEBUG = originalParserDebug;
    }
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
  });

  describe('error handling', () => {
    it('logs a warning when localStorage access fails', async () => {
      delete process.env.PARSER_DEBUG;

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => {
            throw new Error('denied');
          },
        },
        configurable: true,
      });

      const { isParserDebugEnabled } = await loadModule();

      expect(isParserDebugEnabled()).toBe(false);
      expect(logSpies.warn).toHaveBeenCalledWith(
        'Unable to read localStorage flag',
        expect.objectContaining({ operation: 'readEnvFlag', error: 'storage failure' })
      );
    });
  });

  describe('edge cases', () => {
    it('caches the debug state after the first read', async () => {
      process.env.PARSER_DEBUG = 'true';
      const module = await loadModule();

      expect(module.isParserDebugEnabled()).toBe(true);

      process.env.PARSER_DEBUG = 'false';
      expect(module.isParserDebugEnabled()).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('logs parser debug events when enabled', async () => {
      const { parserDebugLog, setParserDebugCache } = await loadModule();

      setParserDebugCache(true);
      parserDebugLog('parse-start', { source: 'unit-test' });

      expect(logSpies.debug).toHaveBeenCalledWith(
        'Parser debug event',
        expect.objectContaining({
          event: 'parse-start',
          source: 'unit-test',
          timestamp: expect.any(String),
        })
      );
    });

    it('logs span lifecycle details with fallback reasons', async () => {
      const { logSpanLifecycle, setParserDebugCache } = await loadModule();

      setParserDebugCache(true);
      logSpanLifecycle({
        stage: 'filtered',
        span: {
          source: 'user',
          category: 'style',
          start: 1,
          end: 4,
          text: 'noir',
          droppedReason: 'rule',
        },
      });

      expect(logSpies.debug).toHaveBeenCalledWith(
        'Parser debug event',
        expect.objectContaining({
          event: 'span:filtered',
          droppedReason: 'rule',
          category: 'style',
        })
      );
    });

    it('logs pipeline metrics with context', async () => {
      const { logPipelineMetric, setParserDebugCache } = await loadModule();

      setParserDebugCache(true);
      logPipelineMetric({ metric: 'duration', value: 123, context: { stage: 'parse' } });

      expect(logSpies.debug).toHaveBeenCalledWith(
        'Parser debug event',
        expect.objectContaining({
          event: 'metric:duration',
          value: 123,
          stage: 'parse',
        })
      );
    });
  });
});
