export class ApiError extends Error {
  public readonly status: number | undefined;
  public readonly response: unknown;
  public readonly code: string | undefined;

  constructor(message: string, status?: number, response?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
    this.code = code;
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

  hasCode(code: string): boolean {
    return this.code === code;
  }
}

export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return error.code;
  }
  return undefined;
}

