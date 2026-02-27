import { API_CONFIG } from '../../config/api.config';

interface RetryConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: readonly number[];
}

export class FetchHttpTransport {
  private readonly retry: RetryConfig;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retry = {
      enabled: retryConfig?.enabled ?? API_CONFIG.retry.enabled,
      maxRetries: retryConfig?.maxRetries ?? API_CONFIG.retry.maxRetries,
      retryDelay: retryConfig?.retryDelay ?? API_CONFIG.retry.retryDelay,
      retryableStatuses: retryConfig?.retryableStatuses ?? API_CONFIG.retry.retryableStatuses,
    };
  }

  async send(url: string, init: RequestInit): Promise<Response> {
    if (!this.retry.enabled) {
      return fetch(url, init);
    }

    let lastError: Error | undefined;

    const retryAllowed = this._isRetryAllowed(init);

    for (let attempt = 0; attempt <= this.retry.maxRetries; attempt++) {
      // Abort-aware: don't retry if signal is already aborted
      if (init.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      try {
        const response = await fetch(url, init);

        // Only retry on retryable status codes
        if (
          retryAllowed &&
          attempt < this.retry.maxRetries &&
          this.retry.retryableStatuses.includes(response.status)
        ) {
          const delay = this._getBackoffDelay(attempt, response);
          await this._sleep(delay, init.signal ?? undefined);
          continue;
        }

        return response;
      } catch (error) {
        // Never retry aborted requests
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        // Retry network errors (fetch throws on network failure)
        if (retryAllowed && attempt < this.retry.maxRetries) {
          const delay = this._getBackoffDelay(attempt);
          await this._sleep(delay, init.signal ?? undefined);
          continue;
        }

        break;
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /** Exponential backoff with jitter. Respects Retry-After header for 429s. */
  private _getBackoffDelay(attempt: number, response?: Response): number {
    // Honor Retry-After header if present (common on 429 responses)
    if (response) {
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds > 0 && seconds <= 60) {
          return seconds * 1000;
        }
      }
    }

    // Exponential backoff: 1s, 2s, 4s (with ±25% jitter)
    const base = this.retry.retryDelay * Math.pow(2, attempt);
    const jitter = base * 0.25 * (Math.random() * 2 - 1);
    return Math.round(base + jitter);
  }

  /**
   * Only retry safe methods by default. Mutating requests are retried only
   * when the caller supplies an Idempotency-Key header.
   */
  private _isRetryAllowed(init: RequestInit): boolean {
    const method = (init.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    return this._hasHeader(init.headers, 'Idempotency-Key');
  }

  private _hasHeader(
    headers: HeadersInit | undefined,
    target: string
  ): boolean {
    if (!headers) {
      return false;
    }

    if (headers instanceof Headers) {
      return headers.has(target);
    }

    if (Array.isArray(headers)) {
      return headers.some(([key]) => key.toLowerCase() === target.toLowerCase());
    }

    return Object.keys(headers).some((key) => key.toLowerCase() === target.toLowerCase());
  }

  /** Sleep that aborts early if the signal fires. */
  private _sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }

      const timer = setTimeout(resolve, ms);

      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        },
        { once: true }
      );
    });
  }
}
