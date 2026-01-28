/**
 * Common Types
 *
 * Shared types used across the application
 */

export interface ErrorMetadata {
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown> | undefined;

  constructor(message: string, code: string, statusCode: number = 500, details?: Record<string, unknown> | undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface Metadata {
  timestamp?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

