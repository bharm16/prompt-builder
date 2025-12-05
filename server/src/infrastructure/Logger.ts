import pino from 'pino';
import type { Request, Response, NextFunction } from 'express';
import type { ILogger } from '@interfaces/ILogger';

interface LoggerConfig {
  level?: string;
}

/**
 * Structured logging service using Pino
 * Provides consistent logging with contextual metadata
 */
export class Logger implements ILogger {
  private logger: pino.Logger;

  constructor(config: LoggerConfig = {}) {
    // Default to 'debug' in development, 'info' in production (Requirement 8.1, 8.2)
    const defaultLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
    
    this.logger = pino({
      level: config.level || process.env.LOG_LEVEL || defaultLevel,
      transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      } : undefined,
    });
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.info(meta, message);
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
    this.logger.error({ ...meta, ...errorMeta }, message);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.warn(meta, message);
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.debug(meta, message);
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
}

// Export singleton instance
export const logger = new Logger();

