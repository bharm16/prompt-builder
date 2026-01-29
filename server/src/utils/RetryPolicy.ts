import { logger } from '@infrastructure/Logger';
import { sleep } from './sleep';

export interface RetryOptions {
  maxRetries?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
  logRetries?: boolean;
  /**
   * Fixed delay between retries in milliseconds.
   * Ignored if getDelayMs is provided.
   */
  delayMs?: number;
  /**
   * Dynamic delay between retries in milliseconds.
   * The attempt parameter is 1-based (first retry is attempt=1).
   */
  getDelayMs?: (attempt: number) => number;
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
      logRetries = true,
      delayMs,
      getDelayMs,
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

        if (logRetries) {
          logger.warn('Operation failed, retrying', {
            attempt,
            maxRetries: maxRetries + 1,
            error: errorObj.message,
            willRetry: attempt <= maxRetries,
          });
        }

        // If this was the last attempt, break to throw error
        if (attempt > maxRetries) {
          break;
        }

        const computedDelay = getDelayMs ? getDelayMs(attempt) : delayMs;
        if (typeof computedDelay === 'number' && computedDelay > 0) {
          await sleep(computedDelay);
        }
      }
    }

    // All retries exhausted
    if (logRetries) {
      logger.error('All retry attempts exhausted', lastError ?? undefined, {
        attempts: maxRetries + 1,
        lastErrorMessage: lastError?.message,
      });
    }

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










