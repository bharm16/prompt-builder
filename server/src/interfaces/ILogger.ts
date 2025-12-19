/**
 * Logger Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Minimal logging interface
 * - DIP: Abstraction for logging operations
 */

export interface ILogger {
  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log error message
   */
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void;

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void;

  /**
   * Create child logger with additional context
   */
  child(bindings: Record<string, unknown>): ILogger;
}

