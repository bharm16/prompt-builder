import { ApiError } from './ApiError';

interface CreateErrorOptions {
  message: string;
  status?: number | null;
  response?: unknown;
}

export class ApiErrorFactory {
  create({ message, status = null, response = null }: CreateErrorOptions): ApiError {
    return new ApiError(message, status ?? undefined, response);
  }

  createTimeout(message: string = 'Request timeout'): ApiError {
    return this.create({ message });
  }

  createNetwork(error: unknown): ApiError {
    const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Network error';
    return this.create({ message });
  }
}

