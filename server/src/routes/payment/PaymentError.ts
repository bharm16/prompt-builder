import { DomainError } from '@server/errors/DomainError';

type PaymentErrorKind =
  | 'NO_BILLING_PROFILE'
  | 'BILLING_URL_NOT_CONFIGURED'
  | 'UNKNOWN_PRICE_ID';

const STATUS_MAP: Record<PaymentErrorKind, number> = {
  NO_BILLING_PROFILE: 400,
  BILLING_URL_NOT_CONFIGURED: 500,
  UNKNOWN_PRICE_ID: 400,
};

export class PaymentError extends DomainError {
  readonly code: string;

  constructor(
    readonly kind: PaymentErrorKind,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, details);
    this.code = kind;
    this.name = 'PaymentError';
  }

  getHttpStatus(): number {
    return STATUS_MAP[this.kind];
  }

  getUserMessage(): string {
    return this.message;
  }
}
