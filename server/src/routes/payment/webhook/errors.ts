import { DomainError } from "../../../errors/DomainError";

export class WebhookUnresolvedError extends DomainError {
  readonly code = "WEBHOOK_UNRESOLVED";

  constructor(message: string) {
    super(message);
    this.name = "WebhookUnresolvedError";
  }

  getHttpStatus(): number {
    return 500;
  }

  getUserMessage(): string {
    return "An internal error occurred processing the webhook.";
  }
}
