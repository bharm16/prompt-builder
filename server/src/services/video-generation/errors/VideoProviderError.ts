type VideoProviderErrorCategory = 'provider' | 'timeout' | 'validation' | 'auth' | 'rate_limit' | 'unknown';

interface VideoProviderErrorOptions {
  provider: string;
  message: string;
  statusCode?: number;
  code?: string;
  retryable?: boolean;
  category?: VideoProviderErrorCategory;
  cause?: unknown;
}

interface ErrorWithCode {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return undefined;
}

function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const typed = error as ErrorWithCode;
  return coerceNumber(typed.statusCode) ?? coerceNumber(typed.status);
}

function extractCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const code = (error as ErrorWithCode).code;
  return typeof code === 'string' && code.trim().length > 0 ? code : undefined;
}

function normalizeMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (!error || typeof error !== 'object') {
    return String(error);
  }
  const message = (error as ErrorWithCode).message;
  if (typeof message === 'string') {
    return message;
  }
  return String(error);
}

function categorize(statusCode: number | undefined, message: string): VideoProviderErrorCategory {
  const lowered = message.toLowerCase();

  if (statusCode === 401 || statusCode === 403 || lowered.includes('unauthorized') || lowered.includes('forbidden')) {
    return 'auth';
  }
  if (statusCode === 429 || lowered.includes('rate limit') || lowered.includes('too many requests')) {
    return 'rate_limit';
  }
  if (
    statusCode === 400 ||
    statusCode === 404 ||
    statusCode === 422 ||
    lowered.includes('invalid') ||
    lowered.includes('unsupported') ||
    lowered.includes('validation')
  ) {
    return 'validation';
  }
  if (
    lowered.includes('timeout') ||
    lowered.includes('timed out') ||
    lowered.includes('deadline exceeded') ||
    lowered.includes('etimedout')
  ) {
    return 'timeout';
  }
  if (typeof statusCode === 'number' && statusCode >= 500) {
    return 'provider';
  }
  return 'unknown';
}

function isRetryable(category: VideoProviderErrorCategory, statusCode: number | undefined): boolean {
  if (category === 'validation' || category === 'auth') {
    return false;
  }
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
    return false;
  }
  return true;
}

export class VideoProviderError extends Error {
  readonly provider: string;
  readonly statusCode: number | undefined;
  readonly code: string | undefined;
  readonly retryable: boolean;
  readonly category: VideoProviderErrorCategory;
  override readonly cause: unknown;

  constructor(options: VideoProviderErrorOptions) {
    super(options.message);
    this.name = 'VideoProviderError';
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.category = options.category ?? categorize(options.statusCode, options.message);
    this.retryable = options.retryable ?? isRetryable(this.category, options.statusCode);
    this.cause = options.cause;
  }
}

export function isVideoProviderError(error: unknown): error is VideoProviderError {
  return error instanceof VideoProviderError;
}

export function toVideoProviderError(error: unknown, provider: string): VideoProviderError {
  if (isVideoProviderError(error)) {
    return error;
  }

  const message = normalizeMessage(error);
  const statusCode = extractStatusCode(error);
  const code = extractCode(error);

  return new VideoProviderError({
    provider,
    message,
    ...(typeof statusCode === 'number' ? { statusCode } : {}),
    ...(code ? { code } : {}),
    cause: error,
  });
}
