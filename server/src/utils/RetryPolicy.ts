import { logger } from '@infrastructure/Logger';

export interface RetryOptions {
  maxRetries?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Generic Retry Policy
 *
 * Handles retry loop logic (policy) separate from the operation being retried (mechanism).
 * Configurable retry counts, error filters, and callbacks.
 */
export class RetryPolicy {
  /**
   * Execute a function with retry logic
   *
   * @param fn - Function to execute (may throw errors)
   * @param options - Retry configuration
   * @returns Result of successful execution
   * @throws Last error if all retries exhausted
   */
  static async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 2,
      shouldRetry = () => true,
      onRetry,
    } = options;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        lastError = errorObj;

        // Check if we should retry this error
        if (!shouldRetry(errorObj, attempt)) {
          throw errorObj;
        }

        attempt++;

        // Call retry callback if provided
        if (onRetry) {
          onRetry(errorObj, attempt);
        }

        logger.warn('Operation failed, retrying', {
          attempt,
          maxRetries: maxRetries + 1,
          error: errorObj.message,
          willRetry: attempt <= maxRetries,
        });

        // If this was the last attempt, break to throw error
        if (attempt > maxRetries) {
          break;
        }
      }
    }

    // All retries exhausted
    logger.error('All retry attempts exhausted', {
      attempts: maxRetries + 1,
      lastError: lastError?.message,
    });

    if (!lastError) {
      throw new Error('Unknown error during retry execution');
    }

    throw lastError;
  }

  /**
   * Create a shouldRetry function that filters out API errors
   */
  static createApiErrorFilter(): (error: Error, attempt: number) => boolean {
    return (error: Error) => {
      const apiError = error as Error & { name?: string; statusCode?: number };
      // Don't retry API errors (rate limits, auth errors, etc.)
      if (apiError.name === 'APIError' || apiError.statusCode) {
        logger.warn('API error encountered, not retrying', {
          error: error.message,
          statusCode: apiError.statusCode,
        });
        return false;
      }
      return true;
    };
  }
}

