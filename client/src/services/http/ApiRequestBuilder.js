export class ApiRequestBuilder {
  constructor(config) {
    this.config = config;
  }

  build(endpoint, options = {}) {
    const method = options.method || 'GET';
    const url = this.config.buildUrl(endpoint);
    const headers = this.config.mergeHeaders(options.headers);
    const signal = options.signal || this.config.createSignal(options.timeout);

    const init = {
      method,
      headers,
      signal,
      ...options.fetchOptions,
    };

    const body = this.serializeBody(method, options.body);
    if (body !== undefined) {
      init.body = body;
    }

    return { url, init };
  }

  serializeBody(method, body) {
    if (!body || method === 'GET' || method === 'HEAD') {
      return undefined;
    }

    if (body instanceof FormData || typeof body === 'string' || body instanceof Blob) {
      return body;
    }

    return JSON.stringify(body);
  }
}
