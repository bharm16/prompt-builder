/**
 * ApiClient - Centralized HTTP Client
 *
 * Handles all HTTP communication with the backend
 * Benefits:
 * - Single place to configure headers, timeouts, retries
 * - Consistent error handling
 * - Easy to mock for testing
 * - Request/response interceptors
 * - Automatic error transformation
 */

import { API_CONFIG } from '../config/api.config';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }

  isNetworkError() {
    return !this.status;
  }

  isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  isServerError() {
    return this.status >= 500;
  }

  isUnauthorized() {
    return this.status === 401;
  }

  isNotFound() {
    return this.status === 404;
  }

  isRateLimited() {
    return this.status === 429;
  }
}

/**
 * Base API Client
 */
export class ApiClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || API_CONFIG.baseURL;
    this.timeout = config.timeout || API_CONFIG.timeout.default;
    this.apiKey = config.apiKey || API_CONFIG.apiKey;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...config.headers,
    };

    // Request interceptors (can be used for logging, auth tokens, etc.)
    this.requestInterceptors = [];
    // Response interceptors (can be used for logging, error handling, etc.)
    this.responseInterceptors = [];
  }

  /**
   * Add a request interceptor
   * @param {Function} interceptor - Function that takes config and returns modified config
   */
  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add a response interceptor
   * @param {Function} interceptor - Function that takes response and returns modified response
   */
  addResponseInterceptor(interceptor) {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Apply request interceptors
   * @private
   */
  async _applyRequestInterceptors(config) {
    let modifiedConfig = config;
    for (const interceptor of this.requestInterceptors) {
      modifiedConfig = await interceptor(modifiedConfig);
    }
    return modifiedConfig;
  }

  /**
   * Apply response interceptors
   * @private
   */
  async _applyResponseInterceptors(response) {
    let modifiedResponse = response;
    for (const interceptor of this.responseInterceptors) {
      modifiedResponse = await interceptor(modifiedResponse);
    }
    return modifiedResponse;
  }

  /**
   * Make an HTTP request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise<any>}
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    let config = {
      method: options.method || 'GET',
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeout),
      url, // Add URL to config for interceptors
    };

    // Add body for non-GET requests
    if (options.body && config.method !== 'GET') {
      config.body = JSON.stringify(options.body);
    }

    // Apply request interceptors
    config = await this._applyRequestInterceptors(config);

    // Remove url from config before passing to fetch (fetch doesn't expect url in config)
    const { url: _, ...fetchConfig } = config;

    try {
      const response = await fetch(url, fetchConfig);

      // Apply response interceptors
      await this._applyResponseInterceptors(response);

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      // Parse JSON response
      const data = await response.json();
      return data;
    } catch (error) {
      // Handle network errors
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new ApiError('Request timeout', null, null);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      // Generic network error
      throw new ApiError(
        error.message || 'Network error',
        null,
        null
      );
    }
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }
}

/**
 * Create and export a default API client instance
 */
export const apiClient = new ApiClient({
  baseURL: API_CONFIG.baseURL,
  apiKey: API_CONFIG.apiKey,
  timeout: API_CONFIG.timeout.default,
});

// Add logging interceptor in development
if (import.meta.env.MODE === 'development') {
  apiClient.addRequestInterceptor((config) => {
    // eslint-disable-next-line no-console
    console.log('[API Request]', config.method, config.url || 'unknown');
    return config;
  });

  apiClient.addResponseInterceptor((response) => {
    // eslint-disable-next-line no-console
    console.log('[API Response]', response.status, response.url);
    return response;
  });
}
