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
