import { ApiError } from './ApiError';

export class ApiResponseHandler {
  constructor({ errorFactory }) {
    this.errorFactory = errorFactory;
  }

  async handle(response) {
    if (!response) {
      throw this.errorFactory.create({ message: 'Empty response received' });
    }

    if (!response.ok) {
      const errorPayload = await this.safeParseJson(response, { allowEmpty: true });
      const message =
        errorPayload?.error ||
        errorPayload?.message ||
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

  mapError(error) {
    if (error instanceof ApiError) {
      return error;
    }

    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      return this.errorFactory.createTimeout();
    }

    return this.errorFactory.createNetwork(error);
  }

  async safeParseJson(response, { allowEmpty = false } = {}) {
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

  isEmptyBody(response) {
    const contentLength = response.headers.get('content-length');
    return response.status === 204 || contentLength === '0' || contentLength === null;
  }
}
