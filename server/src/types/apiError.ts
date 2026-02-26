/**
 * Re-export canonical API error types from the shared contract layer.
 *
 * Previously this file was the sole definition.  It now re-exports so that
 * existing `import { ApiErrorCode } from '@server/types/apiError'` statements
 * continue to work without modification.
 */
export type { ApiErrorCode, ApiErrorResponse as ApiError } from '@shared/types/api';
