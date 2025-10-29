import { ApiError } from './ApiError';

export class ApiErrorFactory {
  create({ message, status = null, response = null }) {
    return new ApiError(message, status, response);
  }

  createTimeout(message = 'Request timeout') {
    return this.create({ message });
  }

  createNetwork(error) {
    const message = error?.message || 'Network error';
    return this.create({ message });
  }
}
