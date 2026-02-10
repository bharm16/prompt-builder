import pino from 'pino';
import pinoPretty from 'pino-pretty';
import type { Request, Response, NextFunction } from 'express';
import type { ILogger } from '@interfaces/ILogger';
import { getRequestContext } from './requestContext';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level?: string;
  includeLogStack?: boolean;
  includeLogCaller?: boolean;
  logStackLevels?: LogLevel[];
  logStackDepth?: number;
  logStackLimit?: number;
}

/**
 * Structured logging service using Pino
 * Provides consistent logging with contextual metadata
 */
export class Logger implements ILogger {
  private logger: pino.Logger;
  private includeLogStack: boolean;
  private includeLogCaller: boolean;
  private logStackLevels: Set<LogLevel>;
  private logStackDepth: number;
  private appRoot: string;

  constructor(config: LoggerConfig = {}) {
    // Keep test output quiet by default; development stays verbose.
    const defaultLevel =
      process.env.NODE_ENV === 'production'
        ? 'info'
        : process.env.NODE_ENV === 'test'
          ? 'warn'
          : 'debug';
    const includeLogStack = config.includeLogStack ?? process.env.LOG_STACK === 'true';
    const stackLevels = config.logStackLevels?.length
      ? config.logStackLevels
      : (process.env.LOG_STACK_LEVELS || 'warn,error')
          .split(',')
          .map((level) => level.trim().toLowerCase())
          .filter(Boolean) as LogLevel[];
    const resolvedStackLevels = stackLevels.length > 0 ? stackLevels : (['warn', 'error'] as LogLevel[]);
    const stackDepthEnv = config.logStackDepth ?? Number.parseInt(process.env.LOG_STACK_DEPTH || '6', 10);
    const stackLimitEnv = config.logStackLimit ?? Number.parseInt(process.env.LOG_STACK_LIMIT || '', 10);

    if (process.env.NODE_ENV !== 'production') {
      const prettyStream = pinoPretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        customPrettifiers: {
          logStack: prettifyLogStack,
        },
      });
      this.logger = pino(
        {
          level: config.level || process.env.LOG_LEVEL || defaultLevel,
        },
        prettyStream
      );
    } else {
      this.logger = pino({
        level: config.level || process.env.LOG_LEVEL || defaultLevel,
      });
    }
    this.includeLogStack = includeLogStack;
    this.includeLogCaller = config.includeLogCaller ?? (process.env.LOG_CALLER ? process.env.LOG_CALLER === 'true' : includeLogStack);
    this.logStackLevels = new Set(resolvedStackLevels);
    this.logStackDepth = Number.isFinite(stackDepthEnv) && stackDepthEnv > 0 ? stackDepthEnv : 6;
    this.appRoot = process.cwd();
    this.applyStackTraceLimit(stackLimitEnv);
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.info(this.enrichMeta('info', meta), message);
  }

  error(message: string, error?: Error, meta: Record<string, unknown> = {}): void {
    const errorMeta = error ? {
      err: {
        errorMessage: error.message,
        stack: error.stack,
        errorName: error.name,
        ...error,
      },
    } : {};
    this.logger.error({ ...this.enrichMeta('error', meta), ...errorMeta }, message);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.warn(this.enrichMeta('warn', meta), message);
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.debug(this.enrichMeta('debug', meta), message);
  }

  /**
   * Express middleware for request logging
   */
  requestLogger(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startTime = Date.now();

      // Log on response finish
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData: Record<string, unknown> = {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          requestId: (req as Request & { id?: string }).id,
          userAgent: req.get('user-agent'),
          ip: req.ip,
        };

        if (res.statusCode >= 500) {
          this.error('HTTP Request Error', undefined, logData);
        } else if (res.statusCode >= 400) {
          this.warn('HTTP Request Warning', logData);
        } else {
          this.debug('HTTP Request', logData);
        }
      });

      next();
    };
  }

  /**
   * Child logger with additional context
   */
  child(bindings: Record<string, unknown>): ILogger {
    const childLogger = Object.create(this) as Logger;
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }

  private enrichMeta(level: LogLevel, meta: Record<string, unknown>): Record<string, unknown> {
    const enriched = { ...meta };
    const context = getRequestContext();
    if (context?.requestId && enriched.requestId === undefined) {
      enriched.requestId = context.requestId;
    }

    const includeStack = this.shouldIncludeStack(level);
    const includeCaller = this.includeLogCaller || includeStack;
    if (!includeStack && !includeCaller) {
      return enriched;
    }

    const rawFrames = this.captureLogStack();
    if (!rawFrames) return enriched;

    const { caller, frames } = this.filterStackFrames(rawFrames);
    if (includeCaller && caller && enriched.caller === undefined) {
      enriched.caller = caller;
    }
    if (includeStack && frames.length > 0 && enriched.logStack === undefined) {
      enriched.logStack = frames.slice(0, this.logStackDepth);
    }

    return enriched;
  }

  private shouldIncludeStack(level: LogLevel): boolean {
    return this.includeLogStack && this.logStackLevels.has(level);
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

  private filterStackFrames(frames: string[]): { caller: string | undefined; frames: string[] } {
    const normalized = frames
      .map((frame) => this.normalizeStackFrame(frame))
      .filter((frame): frame is string => Boolean(frame))
      .filter((frame) => !this.isNoiseFrame(frame));

    const appFrames = normalized.filter((frame) => this.isAppFrame(frame));
    const selected = appFrames.length > 0 ? appFrames : normalized;
    const firstFrame = selected[0];

    return {
      caller: firstFrame,
      frames: selected,
    };
  }

  private normalizeStackFrame(frame: string): string | undefined {
    let line = frame.trim();
    if (!line) return undefined;
    if (line.startsWith('at ')) {
      line = line.slice(3);
    }

    line = line.replace('file://', '');

    if (this.appRoot) {
      line = line.replaceAll(this.appRoot, '');
    }

    line = line.replace(/\(\/+/g, '(');
    line = line.replace(/^\/+/, '');

    return line;
  }

  private isNoiseFrame(frame: string): boolean {
    return (
      frame.includes('node:internal') ||
      frame.includes('internal/modules') ||
      frame.includes('node_modules') ||
      frame.includes('processTicksAndRejections') ||
      frame.includes('server/src/infrastructure/Logger.') ||
      frame.includes('server/src/infrastructure/Logger.ts') ||
      frame.includes('server/src/infrastructure/requestContext.')
    );
  }

  private isAppFrame(frame: string): boolean {
    return frame.includes('server/src/') || frame.includes('server/index.');
  }

  private applyStackTraceLimit(limit: number): void {
    if (!Number.isFinite(limit) || limit <= 0) return;
    const errorWithLimit = Error as unknown as { stackTraceLimit?: number };
    errorWithLimit.stackTraceLimit = limit;
  }
}

function prettifyLogStack(value: unknown): string {
  const formatted = formatLogStack(value);
  return formatted ?? String(value);
}

function formatLogStack(value: unknown): string | undefined {
  if (!value) return undefined;
  const lines = Array.isArray(value) ? value : String(value).split('\n');
  const trimmed = lines.map((line) => line.trim()).filter(Boolean);
  if (trimmed.length === 0) return undefined;
  return `\n${trimmed.map((line) => `  ${line}`).join('\n')}`;
}

// Export singleton instance
export const logger = new Logger();
