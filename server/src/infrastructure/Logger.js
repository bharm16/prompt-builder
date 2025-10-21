import pino from 'pino';

/**
 * Structured logging service using Pino
 * Provides consistent logging with contextual metadata
 */
export class Logger {
  constructor(config = {}) {
    this.logger = pino({
      level: config.level || process.env.LOG_LEVEL || 'info',
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

  info(message, meta = {}) {
    this.logger.info(meta, message);
  }

  error(message, error, meta = {}) {
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

  warn(message, meta = {}) {
    this.logger.warn(meta, message);
  }

  debug(message, meta = {}) {
    this.logger.debug(meta, message);
  }

  /**
   * Express middleware for request logging
   */
  requestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Log on response finish
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          requestId: req.id,
          userAgent: req.get('user-agent'),
          ip: req.ip,
        };

        if (res.statusCode >= 500) {
          this.error('HTTP Request Error', null, logData);
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
  child(bindings) {
    const childLogger = Object.create(this);
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();
