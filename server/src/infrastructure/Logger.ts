import pino from 'pino';
import pinoPretty from 'pino-pretty';
import type { Request, Response, NextFunction } from 'express';
import type { ILogger } from '@interfaces/ILogger';

interface LoggerConfig {
  level?: string;
  includeLogStack?: boolean;
}

/**
 * Structured logging service using Pino
 * Provides consistent logging with contextual metadata
 */
export class Logger implements ILogger {
  private logger: pino.Logger;
  private includeLogStack: boolean;

  constructor(config: LoggerConfig = {}) {
    // Default to 'debug' in development, 'info' in production (Requirement 8.1, 8.2)
    const defaultLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
    
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
    this.includeLogStack = config.includeLogStack ?? process.env.LOG_STACK === 'true';
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.info(this.withLogStack(meta), message);
  }

  error(message: string, error?: Error, meta: Record<string, unknown> = {}): void {
    const errorMeta = error ? {
      err: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...error,
      },
    } : {};
    this.logger.error({ ...this.withLogStack(meta), ...errorMeta }, message);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.warn(this.withLogStack(meta), message);
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.debug(this.withLogStack(meta), message);
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

  private withLogStack(meta: Record<string, unknown>): Record<string, unknown> {
    if (!this.includeLogStack) return meta;
    const logStack = this.captureLogStack();
    return logStack ? { ...meta, logStack } : meta;
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
