export class HttpClientConfig {
  constructor({ baseURL, timeout, defaultHeaders = {} }) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.defaultHeaders = { ...defaultHeaders };
  }

  static fromApiConfig(apiConfig) {
    return new HttpClientConfig({
      baseURL: apiConfig.baseURL,
      timeout: apiConfig.timeout?.default,
      defaultHeaders: {
        'Content-Type': 'application/json',
        'X-API-Key': apiConfig.apiKey,
      },
    });
  }

  buildUrl(endpoint = '') {
    if (!endpoint) {
      return this.baseURL;
    }

    const baseEndsWithSlash = this.baseURL.endsWith('/');
    const endpointStartsWithSlash = endpoint.startsWith('/');

    if (baseEndsWithSlash && endpointStartsWithSlash) {
      return `${this.baseURL}${endpoint.substring(1)}`;
    }

    if (!baseEndsWithSlash && !endpointStartsWithSlash) {
      return `${this.baseURL}/${endpoint}`;
    }

    return `${this.baseURL}${endpoint}`;
  }

  mergeHeaders(headers = {}) {
    return {
      ...this.defaultHeaders,
      ...headers,
    };
  }

  createSignal(timeout) {
    const effectiveTimeout = Number.isFinite(timeout) ? timeout : this.timeout;
    if (typeof AbortSignal?.timeout === 'function') {
      return AbortSignal.timeout(effectiveTimeout);
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), effectiveTimeout);
    return controller.signal;
  }
}
