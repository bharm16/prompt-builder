export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_REQUEST'
  | 'INSUFFICIENT_CREDITS'
  | 'SERVICE_UNAVAILABLE'
  | 'GENERATION_FAILED';

export interface ApiError {
  error: string;
  code?: ApiErrorCode;
  details?: string;
  requestId?: string;
}
