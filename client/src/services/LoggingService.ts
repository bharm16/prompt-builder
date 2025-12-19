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
  includeLogStack: boolean;
  includeLogCaller: boolean;
  logStackLevels: LogLevel[];
  logStackDepth: number;
  logStackLimit: number | null;
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
  private logStackLevels: Set<LogLevel>;
  private logStackDepth: number;
  private includeLogCaller: boolean;

  constructor(config?: Partial<LoggerConfig>) {
    const isDev = import.meta.env?.MODE === 'development';
    const includeLogStack = isDev || import.meta.env?.VITE_LOG_STACK === 'true';
    const stackLevels = config?.logStackLevels?.length
      ? config.logStackLevels
      : (import.meta.env?.VITE_LOG_STACK_LEVELS || 'warn,error')
          .split(',')
          .map((level) => level.trim().toLowerCase())
          .filter(Boolean) as LogLevel[];
    const resolvedStackLevels = stackLevels.length > 0 ? stackLevels : (['warn', 'error'] as LogLevel[]);
    const stackDepth = config?.logStackDepth ?? Number.parseInt(import.meta.env?.VITE_LOG_STACK_DEPTH || '6', 10);
    const stackLimit = config?.logStackLimit ?? Number.parseInt(import.meta.env?.VITE_LOG_STACK_LIMIT || '', 10);
    const includeLogCaller = config?.includeLogCaller ??
      (import.meta.env?.VITE_LOG_CALLER ? import.meta.env?.VITE_LOG_CALLER === 'true' : includeLogStack);

    this.config = {
      enabled: isDev || import.meta.env?.VITE_DEBUG_LOGGING === 'true',
      level: (import.meta.env?.VITE_LOG_LEVEL as LogLevel) || (isDev ? 'debug' : 'warn'),
      includeTimestamp: true,
      includeStackTrace: isDev,
      includeLogStack,
      includeLogCaller,
      logStackLevels: resolvedStackLevels,
      logStackDepth: stackDepth,
      logStackLimit: Number.isFinite(stackLimit) && stackLimit > 0 ? stackLimit : null,
      persistToStorage: isDev,
      maxStoredLogs: 500,
      ...config,
    };
    this.logStackLevels = new Set(this.config.logStackLevels);
    this.logStackDepth = Number.isFinite(this.config.logStackDepth) && this.config.logStackDepth > 0
      ? this.config.logStackDepth
      : 6;
    this.includeLogCaller = this.config.includeLogCaller;
    this.applyStackTraceLimit(this.config.logStackLimit);
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

    const finalMeta = this.buildMeta(level, meta);
    const metaForEntry = finalMeta && Object.keys(finalMeta).length > 0 ? finalMeta : undefined;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      traceId: this.currentTraceId || undefined,
      context,
      meta: metaForEntry,
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

    if (metaForEntry && Object.keys(metaForEntry).length > 0) {
      console[consoleMethod](`%c${fullMessage}`, styles[level], metaForEntry);
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

  private buildMeta(level: LogLevel, meta?: Record<string, unknown>): Record<string, unknown> | undefined {
    const enriched: Record<string, unknown> = { ...(meta || {}) };
    const includeStack = this.shouldIncludeStack(level);
    const includeCaller = this.includeLogCaller || includeStack;

    if (!includeStack && !includeCaller) {
      return meta;
    }

    const rawFrames = this.captureLogStack();
    if (!rawFrames) return meta;

    const { caller, frames } = this.filterStackFrames(rawFrames);
    if (includeCaller && caller && enriched.caller === undefined) {
      enriched.caller = caller;
    }
    if (includeStack && frames.length > 0 && enriched.logStack === undefined) {
      enriched.logStack = frames.slice(0, this.logStackDepth);
    }

    return Object.keys(enriched).length > 0 ? enriched : undefined;
  }

  private shouldIncludeStack(level: LogLevel): boolean {
    return this.config.includeLogStack && this.logStackLevels.has(level);
  }

  private captureLogStack(): string[] | undefined {
    const stack = new Error().stack;
    if (!stack) return undefined;
    const lines = stack
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines[0] === 'Error') {
      lines.shift();
    }

    return lines;
  }

  private filterStackFrames(frames: string[]): { caller?: string; frames: string[] } {
    const normalized = frames
      .map((frame) => this.normalizeStackFrame(frame))
      .filter((frame): frame is string => Boolean(frame))
      .filter((frame) => !this.isNoiseFrame(frame));

    const appFrames = normalized.filter((frame) => this.isAppFrame(frame));
    const selected = appFrames.length > 0 ? appFrames : normalized;

    return {
      caller: selected[0],
      frames: selected,
    };
  }

  private normalizeStackFrame(frame: string): string | undefined {
    let line = frame.trim();
    if (!line) return undefined;
    if (line.startsWith('at ')) {
      line = line.slice(3);
    }

    line = line.replace(/file:\/\//g, '');
    line = line.replace(/https?:\/\/[^/]+\//g, '');
    line = line.replace(/webpack:\/\//g, '');
    line = line.replace(/\(\/+/g, '(');
    line = line.replace(/^\/+/, '');

    return line;
  }

  private isNoiseFrame(frame: string): boolean {
    return (
      frame.includes('node_modules') ||
      frame.includes('LoggingService.') ||
      frame.includes('client/src/services/LoggingService.ts')
    );
  }

  private isAppFrame(frame: string): boolean {
    return frame.includes('/src/') || frame.startsWith('src/') || frame.includes('client/src/');
  }

  private applyStackTraceLimit(limit: number | null): void {
    if (!limit) return;
    const errorWithLimit = Error as unknown as { stackTraceLimit?: number };
    errorWithLimit.stackTraceLimit = limit;
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
