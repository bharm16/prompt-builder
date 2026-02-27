export class WebhookUnresolvedError extends Error {
  readonly code = 'WEBHOOK_UNRESOLVED';

  constructor(message: string) {
    super(message);
    this.name = 'WebhookUnresolvedError';
  }
}
