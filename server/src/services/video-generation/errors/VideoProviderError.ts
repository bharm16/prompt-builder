import { DomainError } from '@server/errors/DomainError';

type VideoProviderErrorCategory = 'provider' | 'timeout' | 'validation' | 'auth' | 'rate_limit' | 'unknown';

interface VideoProviderErrorOptions {
  provider: string;
  message: string;
  statusCode?: number;
  providerCode?: string;
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

const CATEGORY_CODES: Record<VideoProviderErrorCategory, string> = {
  auth: 'VIDEO_PROVIDER_AUTH',
  rate_limit: 'VIDEO_PROVIDER_RATE_LIMIT',
  validation: 'VIDEO_PROVIDER_VALIDATION',
  timeout: 'VIDEO_PROVIDER_TIMEOUT',
  provider: 'VIDEO_PROVIDER_ERROR',
  unknown: 'VIDEO_PROVIDER_ERROR',
};

const CATEGORY_HTTP_STATUS: Record<VideoProviderErrorCategory, number> = {
  auth: 403,
  rate_limit: 429,
  validation: 400,
  timeout: 504,
  provider: 502,
  unknown: 500,
};

const CATEGORY_USER_MESSAGE: Record<VideoProviderErrorCategory, string> = {
  auth: 'Authentication failed with video provider.',
  rate_limit: 'Video provider rate limit reached. Please try again later.',
  validation: 'Invalid video generation request.',
  timeout: 'Video generation timed out. Please try again.',
  provider: 'Video generation failed. Please try again.',
  unknown: 'Video generation failed. Please try again.',
};

export class VideoProviderError extends DomainError {
  readonly code: string;
  readonly provider: string;
  readonly statusCode: number | undefined;
  readonly providerCode: string | undefined;
  readonly retryable: boolean;
  readonly category: VideoProviderErrorCategory;
  override readonly cause: unknown;

  constructor(options: VideoProviderErrorOptions) {
    const category = options.category ?? categorize(options.statusCode, options.message);
    const retryable = options.retryable ?? isRetryable(category, options.statusCode);
    super(options.message, {
      provider: options.provider,
      category,
      retryable,
      ...(options.providerCode !== undefined ? { providerCode: options.providerCode } : {}),
      ...(options.statusCode !== undefined ? { statusCode: options.statusCode } : {}),
    });
    this.name = 'VideoProviderError';
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.providerCode = options.providerCode;
    this.category = category;
    this.code = CATEGORY_CODES[this.category];
    this.retryable = retryable;
    this.cause = options.cause;
  }

  getHttpStatus(): number {
    return this.statusCode ?? CATEGORY_HTTP_STATUS[this.category];
  }

  getUserMessage(): string {
    return CATEGORY_USER_MESSAGE[this.category];
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
  const providerCode = extractCode(error);

  return new VideoProviderError({
    provider,
    message,
    ...(typeof statusCode === 'number' ? { statusCode } : {}),
    ...(providerCode ? { providerCode } : {}),
    cause: error,
  });
}
