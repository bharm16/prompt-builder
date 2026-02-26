export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_REQUEST'
  | 'INSUFFICIENT_CREDITS'
  | 'SERVICE_UNAVAILABLE'
  | 'GENERATION_FAILED'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'REQUEST_IN_PROGRESS';

export interface ApiError {
  error: string;
  code?: ApiErrorCode;
  details?: string;
  requestId?: string;
}
