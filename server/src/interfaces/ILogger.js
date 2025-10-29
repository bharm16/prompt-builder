/**
 * Logger Interface
 * 
 * SOLID Principles Applied:
 * - ISP: Minimal logging interface
 * - DIP: Abstraction for logging operations
 */
export class ILogger {
  /**
   * Log info message
   * @param {string} message - Message to log
   * @param {Object} meta - Metadata object
   */
  info(message, meta = {}) {
    throw new Error('info() must be implemented');
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {Error} error - Error object
   * @param {Object} meta - Metadata object
   */
  error(message, error, meta = {}) {
    throw new Error('error() must be implemented');
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {Object} meta - Metadata object
   */
  warn(message, meta = {}) {
    throw new Error('warn() must be implemented');
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   * @param {Object} meta - Metadata object
   */
  debug(message, meta = {}) {
    throw new Error('debug() must be implemented');
  }

  /**
   * Create child logger with additional context
   * @param {Object} bindings - Context bindings
   * @returns {ILogger} Child logger
   */
  child(bindings) {
    throw new Error('child() must be implemented');
  }
}
