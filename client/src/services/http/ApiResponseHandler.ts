import { ApiError } from './ApiError';
import type { ApiErrorFactory } from './ApiErrorFactory';

interface SafeParseOptions {
  allowEmpty?: boolean;
}

export class ApiResponseHandler {
  private readonly errorFactory: ApiErrorFactory;

  constructor(errorFactory: ApiErrorFactory) {
    this.errorFactory = errorFactory;
  }

  async handle(response: Response | null): Promise<unknown> {
    if (!response) {
      throw this.errorFactory.create({ message: 'Empty response received' });
    }

    if (!response.ok) {
      const errorPayload = await this.safeParseJson(response, { allowEmpty: true });
      const message =
        (errorPayload && typeof errorPayload === 'object' && 'error' in errorPayload && typeof errorPayload.error === 'string'
          ? errorPayload.error
          : null) ||
        (errorPayload && typeof errorPayload === 'object' && 'message' in errorPayload && typeof errorPayload.message === 'string'
          ? errorPayload.message
          : null) ||
        `HTTP ${response.status}`;

      throw this.errorFactory.create({
        message,
        status: response.status,
        response: errorPayload,
      });
    }

    if (response.status === 204) {
      return null;
    }

    return this.safeParseJson(response, { allowEmpty: true });
  }

  mapError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error && typeof error === 'object' && 'name' in error) {
      const name = error.name;
      if (name === 'AbortError' || name === 'TimeoutError') {
        return this.errorFactory.createTimeout();
      }
    }

    return this.errorFactory.createNetwork(error);
  }

  async safeParseJson(response: Response, { allowEmpty = false }: SafeParseOptions = {}): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      if (allowEmpty && this.isEmptyBody(response)) {
        return null;
      }

      throw this.errorFactory.create({
        message: 'Failed to parse JSON response',
        status: response.status,
      });
    }
  }

  private isEmptyBody(response: Response): boolean {
    const contentLength = response.headers.get('content-length');
    return response.status === 204 || contentLength === '0' || contentLength === null;
  }
}

