/**
 * ApiClient - Centralized HTTP Client
 *
 * Refactored to follow SOLID principles by decomposing responsibilities
 * into dedicated collaborators and depending on abstractions for transport
 * and error handling.
 */

import { API_CONFIG } from '../config/api.config';
import { HttpClientConfig } from './http/HttpClientConfig';
import { ApiRequestBuilder } from './http/ApiRequestBuilder';
import { InterceptorManager } from './http/InterceptorManager';
import { FetchHttpTransport } from './http/FetchHttpTransport';
import { ApiError } from './http/ApiError';
import { ApiErrorFactory } from './http/ApiErrorFactory';
import { ApiResponseHandler } from './http/ApiResponseHandler';

interface BuiltRequest {
  url: string;
  init: RequestInit;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeout?: number;
  fetchOptions?: RequestInit;
}

interface ApiClientOptions {
  config?: HttpClientConfig;
  transport?: FetchHttpTransport;
  requestBuilder?: ApiRequestBuilder;
  responseHandler?: ApiResponseHandler;
  requestInterceptors?: InterceptorManager<BuiltRequest>;
  responseInterceptors?: InterceptorManager<Response>;
}

export class ApiClient {
  private readonly config: HttpClientConfig;
  private readonly transport: FetchHttpTransport;
  private readonly requestBuilder: ApiRequestBuilder;
  private readonly responseHandler: ApiResponseHandler;
  private readonly requestInterceptors: InterceptorManager<BuiltRequest>;
  private readonly responseInterceptors: InterceptorManager<Response>;

  constructor({
    config = HttpClientConfig.fromApiConfig(API_CONFIG),
    transport = new FetchHttpTransport(),
    requestBuilder = new ApiRequestBuilder(config),
    responseHandler = new ApiResponseHandler(new ApiErrorFactory()),
    requestInterceptors = new InterceptorManager<BuiltRequest>(),
    responseInterceptors = new InterceptorManager<Response>(),
  }: ApiClientOptions = {}) {
    this.config = config;
    this.transport = transport;
    this.requestBuilder = requestBuilder;
    this.responseHandler = responseHandler;
    this.requestInterceptors = requestInterceptors;
    this.responseInterceptors = responseInterceptors;
  }

  addRequestInterceptor(interceptor: (payload: BuiltRequest) => BuiltRequest | Promise<BuiltRequest> | undefined): void {
    this.requestInterceptors.use(interceptor);
  }

  addResponseInterceptor(interceptor: (payload: Response) => Response | Promise<Response> | undefined): void {
    this.responseInterceptors.use(interceptor);
  }

  async request(endpoint: string, options: RequestOptions = {}): Promise<unknown> {
    const builtRequest = this.requestBuilder.build(endpoint, options);
    const interceptedRequest = await this.requestInterceptors.run(builtRequest);
    const { url, init } = interceptedRequest;

    try {
      const response = await this.transport.send(url, init);
      const processedResponse = await this.responseInterceptors.run(response);
      return await this.responseHandler.handle(processedResponse);
    } catch (error) {
      throw this.responseHandler.mapError(error);
    }
  }

  async get(endpoint: string, options: RequestOptions = {}): Promise<unknown> {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint: string, body: unknown, options: RequestOptions = {}): Promise<unknown> {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  async put(endpoint: string, body: unknown, options: RequestOptions = {}): Promise<unknown> {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  async delete(endpoint: string, options: RequestOptions = {}): Promise<unknown> {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  async patch(endpoint: string, body: unknown, options: RequestOptions = {}): Promise<unknown> {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }
}

export { ApiError } from './http/ApiError';

export const apiClient = new ApiClient();

// Enable logging in development
if ((import.meta as { env?: { MODE?: string } }).env?.MODE === 'development') {
  import('./http/LoggingInterceptors').then(({ setupApiLogging }) => {
    setupApiLogging(apiClient);
  });
}

