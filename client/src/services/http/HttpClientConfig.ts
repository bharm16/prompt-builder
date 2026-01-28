interface HttpClientConfigOptions {
  baseURL: string;
  timeout?: number | undefined;
  defaultHeaders?: Record<string, string>;
}

interface ApiConfig {
  baseURL: string;
  timeout?: {
    default?: number;
  };
  apiKey?: string;
}

export class HttpClientConfig {
  private readonly baseURL: string;
  private readonly timeout: number | undefined;
  private readonly defaultHeaders: Record<string, string>;

  constructor({ baseURL, timeout, defaultHeaders = {} }: HttpClientConfigOptions) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.defaultHeaders = { ...defaultHeaders };
  }

  static fromApiConfig(apiConfig: ApiConfig): HttpClientConfig {
    const apiKey = apiConfig.apiKey;
    return new HttpClientConfig({
      baseURL: apiConfig.baseURL,
      timeout: apiConfig.timeout?.default ?? undefined,
      defaultHeaders: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey } : {}),
      },
    });
  }

  buildUrl(endpoint: string = ''): string {
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

  mergeHeaders(headers: Record<string, string> = {}): Record<string, string> {
    return {
      ...this.defaultHeaders,
      ...headers,
    };
  }

  createSignal(timeout?: number): AbortSignal {
    const effectiveTimeout = Number.isFinite(timeout) ? timeout : this.timeout;
    if (typeof AbortSignal?.timeout === 'function' && effectiveTimeout !== undefined) {
      return AbortSignal.timeout(effectiveTimeout);
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), effectiveTimeout ?? 0);
    return controller.signal;
  }
}
