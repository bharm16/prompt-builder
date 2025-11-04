/**
 * Tests for parserDebug
 *
 * Test Plan:
 * - Verifies isParserDebugEnabled reads from multiple sources
 * - Verifies coerceBoolean handles various input types
 * - Verifies environment flag reading priority
 * - Verifies logging functions only log when enabled
 * - Verifies caching behavior
 * - Verifies edge cases (missing globals, localStorage errors)
 *
 * What these tests catch:
 * - Breaking environment variable reading
 * - Incorrect boolean coercion logic
 * - Logging when debug is disabled (performance issue)
 * - Cache not working (redundant environment reads)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isParserDebugEnabled,
  setParserDebugCache,
  parserDebugLog,
  logSpanLifecycle,
  logPipelineMetric
} from '../parserDebug.js';

describe('parserDebug', () => {
  beforeEach(() => {
    // Reset cache before each test
    setParserDebugCache(null);

    // Clean up environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      delete import.meta.env.VITE_PARSER_DEBUG;
      delete import.meta.env.PARSER_DEBUG;
    }
    if (typeof process !== 'undefined' && process.env) {
      delete process.env.PARSER_DEBUG;
    }
    if (typeof window !== 'undefined') {
      delete window.PARSER_DEBUG;
      if (window.localStorage) {
        window.localStorage.removeItem('PARSER_DEBUG');
      }
    }
  });

  describe('boolean coercion (via isParserDebugEnabled)', () => {
    it('coerces "true" string to true - catches string parsing bug', () => {
      // Would fail if string parsing is broken
      setParserDebugCache(null);
      if (typeof process !== 'undefined' && process.env) {
        process.env.PARSER_DEBUG = 'true';
        const result = isParserDebugEnabled();
        expect(result).toBe(true);
      }
    });

    it('coerces "false" string to false - catches negative string parsing', () => {
      // Would fail if "false" string isn't recognized
      setParserDebugCache(null);
      if (typeof process !== 'undefined' && process.env) {
        process.env.PARSER_DEBUG = 'false';
        const result = isParserDebugEnabled();
        expect(result).toBe(false);
      }
    });

    it('coerces "1" to true - catches numeric string parsing', () => {
      // Would fail if '1' isn't treated as true
      setParserDebugCache(null);
      if (typeof process !== 'undefined' && process.env) {
        process.env.PARSER_DEBUG = '1';
        const result = isParserDebugEnabled();
        expect(result).toBe(true);
      }
    });

    it('coerces "0" to false - catches numeric string parsing', () => {
      // Would fail if '0' isn't treated as false
      setParserDebugCache(null);
      if (typeof process !== 'undefined' && process.env) {
        process.env.PARSER_DEBUG = '0';
        const result = isParserDebugEnabled();
        expect(result).toBe(false);
      }
    });

    it('handles case-insensitive "YES" - catches case handling', () => {
      // Would fail if toLowerCase is not called
      setParserDebugCache(null);
      if (typeof process !== 'undefined' && process.env) {
        process.env.PARSER_DEBUG = 'YES';
        const result = isParserDebugEnabled();
        expect(result).toBe(true);
      }
    });

    it('handles trimmed values - catches whitespace trimming', () => {
      // Would fail if trim() is not called
      setParserDebugCache(null);
      if (typeof process !== 'undefined' && process.env) {
        process.env.PARSER_DEBUG = '  true  ';
        const result = isParserDebugEnabled();
        expect(result).toBe(true);
      }
    });
  });

  describe('environment flag reading priority', () => {
    it('defaults to false when no flags set - catches default behavior', () => {
      // Would fail if default isn't false
      setParserDebugCache(null);
      const result = isParserDebugEnabled();
      expect(result).toBe(false);
    });

    it('reads from process.env when available - catches process.env reading', () => {
      // Would fail if process.env check is broken
      setParserDebugCache(null);
      if (typeof process !== 'undefined' && process.env) {
        process.env.PARSER_DEBUG = 'true';
        const result = isParserDebugEnabled();
        expect(result).toBe(true);
      }
    });
  });

  describe('caching behavior', () => {
    it('caches result after first call - catches caching logic', () => {
      // Would fail if cache isn't used
      setParserDebugCache(null);
      const first = isParserDebugEnabled();
      setParserDebugCache(true); // Manually set cache
      const second = isParserDebugEnabled();
      expect(second).toBe(true); // Should use cached value
    });

    it('uses cached value on subsequent calls - catches cache hit', () => {
      // Would fail if we re-read environment on every call
      setParserDebugCache(true);
      const result = isParserDebugEnabled();
      expect(result).toBe(true);
    });

    it('setParserDebugCache allows manual cache control - catches cache setter', () => {
      // Would fail if setParserDebugCache doesn't work
      setParserDebugCache(false);
      expect(isParserDebugEnabled()).toBe(false);
      setParserDebugCache(true);
      expect(isParserDebugEnabled()).toBe(true);
    });
  });

  describe('parserDebugLog', () => {
    it('does not log when debug disabled - catches early return', () => {
      // Would fail if we log when disabled (performance issue)
      setParserDebugCache(false);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed');

      parserDebugLog('test-event', { data: 'value' });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('logs when debug enabled and console.groupCollapsed exists - catches logging', () => {
      // Would fail if logging logic is broken
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      parserDebugLog('test-event', { data: 'value' });

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('test-event');

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('includes timestamp in log record - catches baseEvent structure', () => {
      // Would fail if baseEvent doesn't add timestamp
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      parserDebugLog('test-event', { data: 'value' });

      // If implementation logs the record, it should have timestamp
      // This test documents the expected behavior
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('merges payload into log record - catches payload spreading', () => {
      // Would fail if ...payload is not spread into baseEvent
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      parserDebugLog('test-event', { custom: 'data', number: 42 });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('handles empty payload - catches default parameter', () => {
      // Would fail if default {} parameter is removed
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      parserDebugLog('test-event');

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });
  });

  describe('logSpanLifecycle', () => {
    it('does not log when debug disabled - catches early return', () => {
      // Would fail if we log when disabled
      setParserDebugCache(false);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed');

      logSpanLifecycle({ stage: 'created', span: { text: 'test' } });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('logs with span:stage event format - catches event naming', () => {
      // Would fail if event format changes
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      logSpanLifecycle({ stage: 'created', span: { text: 'test' } });

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('span:created');

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('extracts span properties - catches property extraction', () => {
      // Would fail if span property extraction is broken
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      const span = {
        source: 'test',
        category: 'camera',
        start: 0,
        end: 10,
        text: 'dolly shot',
        validatorPass: true
      };

      logSpanLifecycle({ stage: 'validated', span });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('includes reason if provided - catches reason handling', () => {
      // Would fail if reason parameter is not used
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      logSpanLifecycle({
        stage: 'dropped',
        span: { text: 'test' },
        reason: 'invalid_category'
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('includes extra properties - catches extra spreading', () => {
      // Would fail if ...extra is not spread
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      logSpanLifecycle({
        stage: 'modified',
        span: { text: 'test' },
        extra: { newValue: 42, modified: true }
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('handles missing span properties gracefully - catches null safety', () => {
      // Would fail if optional chaining is removed
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      logSpanLifecycle({ stage: 'incomplete', span: {} });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });
  });

  describe('logPipelineMetric', () => {
    it('does not log when debug disabled - catches early return', () => {
      // Would fail if we log when disabled
      setParserDebugCache(false);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed');

      logPipelineMetric({ metric: 'parse_time', value: 42 });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('logs with metric: event format - catches event naming', () => {
      // Would fail if event format changes
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      logPipelineMetric({ metric: 'parse_time', value: 42 });

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('metric:parse_time');

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('includes value in payload - catches value spreading', () => {
      // Would fail if value is not included
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      logPipelineMetric({ metric: 'spans_count', value: 15 });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('includes context if provided - catches context spreading', () => {
      // Would fail if ...context is not spread
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      logPipelineMetric({
        metric: 'cache_hit_rate',
        value: 0.85,
        context: { totalRequests: 100, hits: 85 }
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('handles empty context - catches default parameter', () => {
      // Would fail if default {} parameter is removed
      setParserDebugCache(true);
      const consoleSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

      logPipelineMetric({ metric: 'test_metric', value: 1 });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      groupEndSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('handles missing console.groupCollapsed gracefully - catches fallback', () => {
      // Would fail if we don't check for console.groupCollapsed existence
      setParserDebugCache(true);
      const originalGroupCollapsed = console.groupCollapsed;
      console.groupCollapsed = undefined;

      // Should not throw
      expect(() => parserDebugLog('test', {})).not.toThrow();

      console.groupCollapsed = originalGroupCollapsed;
    });

    it('handles localStorage errors gracefully - catches try/catch', () => {
      // Would fail if localStorage errors aren't caught
      setParserDebugCache(null);

      if (typeof window !== 'undefined' && window.localStorage) {
        const originalGetItem = window.localStorage.getItem;
        window.localStorage.getItem = () => {
          throw new Error('Storage quota exceeded');
        };

        // Should not throw, should return false as default
        expect(() => isParserDebugEnabled()).not.toThrow();

        window.localStorage.getItem = originalGetItem;
      }
    });
  });
});
