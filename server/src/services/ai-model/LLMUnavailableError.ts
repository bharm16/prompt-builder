import { DomainError } from '@server/errors/DomainError';

/**
 * Thrown when no LLM providers are configured or all providers are unavailable.
 *
 * The global error handler maps this to a structured ApiErrorResponse with
 * code "LLM_UNAVAILABLE" and HTTP 503, enabling the client to show a
 * targeted "AI services temporarily unavailable" message.
 */
export class LLMUnavailableError extends DomainError {
  readonly code = 'LLM_UNAVAILABLE';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.name = 'LLMUnavailableError';
  }

  getHttpStatus(): number {
    return 503;
  }

  getUserMessage(): string {
    return 'AI services are temporarily unavailable. Please try again in a moment.';
  }
}
