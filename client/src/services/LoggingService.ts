/**
 * Client-Side Logging Service
 *
 * Provides structured logging for debugging with:
 * - Log levels (debug, info, warn, error)
 * - Automatic timestamps
 * - Context/metadata support
 * - Request tracing via trace IDs
 * - Console grouping for related operations
 * - Production-safe (can be disabled)
 *
 * Usage:
 *   import { logger } from '@/services/LoggingService';
 *   logger.info('User action', { component: 'Button', action: 'click' });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  traceId?: string;
  context?: string;
  meta?: Record<string, unknown>;
  duration?: number;
}

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  includeTimestamp: boolean;
  includeStackTrace: boolean;
  persistToStorage: boolean;
  maxStoredLogs: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const STORAGE_KEY = 'prompt_builder_logs';

class LoggingService {
  private config: LoggerConfig;
  private currentTraceId: string | null = null;
  private operationTimers: Map<string, number> = new Map();

  constructor(config?: Partial<LoggerConfig>) {
    const isDev = import.meta.env?.MODE === 'development';

    this.config = {
      enabled: isDev || import.meta.env?.VITE_DEBUG_LOGGING === 'true',
      level: (import.meta.env?.VITE_LOG_LEVEL as LogLevel) || (isDev ? 'debug' : 'warn'),
      includeTimestamp: true,
      includeStackTrace: isDev,
      persistToStorage: isDev,
      maxStoredLogs: 500,
      ...config,
    };
  }

  /**
   * Generate a trace ID for tracking related operations
   */
  generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set the current trace ID for all subsequent logs
   */
  setTraceId(traceId: string): void {
    this.currentTraceId = traceId;
  }

  /**
   * Clear the current trace ID
   */
  clearTraceId(): void {
    this.currentTraceId = null;
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId: string): void {
    this.operationTimers.set(operationId, performance.now());
  }

  /**
   * End timing and return duration
   */
  endTimer(operationId: string): number | undefined {
    const startTime = this.operationTimers.get(operationId);
    if (startTime) {
      this.operationTimers.delete(operationId);
      return Math.round(performance.now() - startTime);
    }
    return undefined;
  }

  /**
   * Create a child logger with preset context
   */
  child(context: string): ContextLogger {
    return new ContextLogger(this, context);
  }

  /**
   * Group related logs together
   */
  group(label: string, fn: () => void | Promise<void>): void | Promise<void> {
    if (!this.config.enabled) return fn();

    console.group(`🔹 ${label}`);
    const result = fn();

    if (result instanceof Promise) {
      return result.finally(() => console.groupEnd());
    }

    console.groupEnd();
    return result;
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
    context?: string
  ): void {
    if (!this.config.enabled) return;
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      traceId: this.currentTraceId || undefined,
      context,
      meta,
    };

    // Console output with styling
    const styles = {
      debug: 'color: #6b7280',
      info: 'color: #3b82f6',
      warn: 'color: #f59e0b; font-weight: bold',
      error: 'color: #ef4444; font-weight: bold',
    };

    const prefix = context ? `[${context}]` : '';
    const tracePrefix = entry.traceId ? `[${entry.traceId.slice(-8)}]` : '';
    const fullMessage = `${tracePrefix}${prefix} ${message}`;

    const consoleMethod = level === 'debug' ? 'log' : level;

    if (meta && Object.keys(meta).length > 0) {
      console[consoleMethod](`%c${fullMessage}`, styles[level], meta);
    } else {
      console[consoleMethod](`%c${fullMessage}`, styles[level]);
    }

    // Add stack trace for errors
    if (level === 'error' && this.config.includeStackTrace) {
      console.trace('Stack trace:');
    }

    // Persist to localStorage for debugging
    if (this.config.persistToStorage) {
      this.persistLog(entry);
    }
  }

  /**
   * Store logs in localStorage for later inspection
   */
  private persistLog(entry: LogEntry): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const logs: LogEntry[] = stored ? JSON.parse(stored) : [];

      logs.push(entry);

      // Keep only recent logs
      if (logs.length > this.config.maxStoredLogs) {
        logs.splice(0, logs.length - this.config.maxStoredLogs);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Retrieve stored logs
   */
  getStoredLogs(): LogEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear stored logs
   */
  clearStoredLogs(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Export logs as JSON (for bug reports)
   */
  exportLogs(): string {
    return JSON.stringify(this.getStoredLogs(), null, 2);
  }

  // Convenience methods
  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    const errorMeta = error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack,
          ...meta,
        }
      : meta;
    this.log('error', message, errorMeta);
  }

  /**
   * Log an API request/response cycle
   */
  apiCall(
    method: string,
    endpoint: string,
    request?: unknown,
    response?: unknown,
    duration?: number,
    error?: Error
  ): void {
    const meta: Record<string, unknown> = {
      method,
      endpoint,
      duration: duration ? `${duration}ms` : undefined,
    };

    if (request) meta.request = request;
    if (response) meta.response = response;

    if (error) {
      this.error(`API ${method} ${endpoint} failed`, error, meta);
    } else {
      this.debug(`API ${method} ${endpoint}`, meta);
    }
  }

  /**
   * Log a component lifecycle event
   */
  component(name: string, event: string, meta?: Record<string, unknown>): void {
    this.debug(`Component ${event}`, { component: name, ...meta });
  }

  /**
   * Log user interaction
   */
  interaction(action: string, target: string, meta?: Record<string, unknown>): void {
    this.info(`User ${action}`, { target, ...meta });
  }
}

/**
 * Context-aware logger for specific components/services
 */
class ContextLogger {
  constructor(
    private parent: LoggingService,
    private context: string
  ) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    (this.parent as unknown as { log: (level: LogLevel, message: string, meta?: Record<string, unknown>, context?: string) => void })
      .log('debug', message, meta, this.context);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    (this.parent as unknown as { log: (level: LogLevel, message: string, meta?: Record<string, unknown>, context?: string) => void })
      .log('info', message, meta, this.context);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    (this.parent as unknown as { log: (level: LogLevel, message: string, meta?: Record<string, unknown>, context?: string) => void })
      .log('warn', message, meta, this.context);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    const errorMeta = error
      ? { errorName: error.name, errorMessage: error.message, stack: error.stack, ...meta }
      : meta;
    (this.parent as unknown as { log: (level: LogLevel, message: string, meta?: Record<string, unknown>, context?: string) => void })
      .log('error', message, errorMeta, this.context);
  }
}

// Singleton export
export const logger = new LoggingService();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { __logger: LoggingService }).__logger = logger;
}

export type { LogEntry, LoggerConfig, LogLevel };
