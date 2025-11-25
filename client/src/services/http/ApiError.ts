export class ApiError extends Error {
  public readonly status: number | undefined;
  public readonly response: unknown;

  constructor(message: string, status?: number, response?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }

  isNetworkError(): boolean {
    return this.status === undefined;
  }

  isClientError(): boolean {
    return this.status !== undefined && this.status >= 400 && this.status < 500;
  }

  isServerError(): boolean {
    return this.status !== undefined && this.status >= 500;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }
}

