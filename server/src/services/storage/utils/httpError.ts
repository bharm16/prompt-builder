export type HttpError = Error & {
  statusCode: number;
  details?: Record<string, unknown>;
};

export function createHttpError(
  message: string,
  statusCode: number,
  details?: Record<string, unknown>
): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
}

export function createForbiddenError(
  message: string,
  details?: Record<string, unknown>
): HttpError {
  return createHttpError(message, 403, details);
}
