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

export class ApiClient {
  constructor({
    config = HttpClientConfig.fromApiConfig(API_CONFIG),
    transport = new FetchHttpTransport(),
    requestBuilder = new ApiRequestBuilder(config),
    responseHandler = new ApiResponseHandler({ errorFactory: new ApiErrorFactory() }),
    requestInterceptors = new InterceptorManager(),
    responseInterceptors = new InterceptorManager(),
  } = {}) {
    this.config = config;
    this.transport = transport;
    this.requestBuilder = requestBuilder;
    this.responseHandler = responseHandler;
    this.requestInterceptors = requestInterceptors;
    this.responseInterceptors = responseInterceptors;
  }

  addRequestInterceptor(interceptor) {
    this.requestInterceptors.use(interceptor);
  }

  addResponseInterceptor(interceptor) {
    this.responseInterceptors.use(interceptor);
  }

  async request(endpoint, options = {}) {
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

  async get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  async put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  async patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }
}

export { ApiError } from './http/ApiError';

export const apiClient = new ApiClient();

if (import.meta.env.MODE === 'development') {
  apiClient.addRequestInterceptor((config) => config);
  apiClient.addResponseInterceptor((response) => response);
}
