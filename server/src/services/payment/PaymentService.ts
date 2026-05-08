import Stripe from "stripe";
import { logger } from "@infrastructure/Logger";
import type { IPaymentGateway } from "./IPaymentGateway";
import type {
  BillingPortalLink,
  CheckoutSessionLink,
  InvoiceCreditCalculation,
  PaymentCheckoutSession,
  PaymentCustomer,
  PaymentEvent,
  PaymentInvoice,
  PaymentInvoiceLineItem,
} from "./types";

interface PaymentServiceConfig {
  secretKey: string | undefined;
  webhookSecret: string | undefined;
  priceCreditsJson: string | undefined;
}

type PriceCredits = Record<string, number>;

function normalizeCreditsValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? Math.trunc(value) : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function parsePriceCredits(raw: string | undefined): PriceCredits {
  if (!raw) {
    logger.warn(
      "STRIPE_PRICE_CREDITS is not configured; price mapping will be empty",
    );
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger.error("Failed to parse STRIPE_PRICE_CREDITS JSON", error as Error);
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    logger.warn(
      "STRIPE_PRICE_CREDITS must be a JSON object mapping price IDs to credits",
    );
    return {};
  }

  const mapping: PriceCredits = {};
  for (const [priceId, creditsRaw] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    const credits = normalizeCreditsValue(creditsRaw);
    if (!priceId || !credits) {
      logger.warn("Invalid Stripe price credit mapping entry", {
        priceId,
        credits: creditsRaw,
      });
      continue;
    }
    mapping[priceId] = credits;
  }

  if (Object.keys(mapping).length === 0) {
    logger.warn("STRIPE_PRICE_CREDITS did not include any valid entries");
  }

  return mapping;
}

function trimmedMetadataString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function resolveStripeReferenceId(
  ref: string | { id?: string } | null | undefined,
): string | null {
  if (typeof ref === "string") {
    return ref;
  }
  if (ref && typeof ref === "object" && typeof ref.id === "string") {
    return ref.id;
  }
  return null;
}

function toPaymentInvoiceLineItem(
  line: Stripe.InvoiceLineItem,
): PaymentInvoiceLineItem {
  return {
    priceId: line.price?.id ?? null,
    quantity: typeof line.quantity === "number" ? line.quantity : null,
    amount: typeof line.amount === "number" ? line.amount : null,
    proration: Boolean(line.proration),
    metadataUserId: trimmedMetadataString(line.metadata?.userId),
  };
}

function toPaymentInvoice(invoice: Stripe.Invoice): PaymentInvoice {
  const lineItems = (invoice.lines?.data ?? []).map(toPaymentInvoiceLineItem);
  return {
    id: invoice.id,
    number: invoice.number ?? null,
    status: invoice.status ?? null,
    created: typeof invoice.created === "number" ? invoice.created : null,
    currency: invoice.currency ?? null,
    amountDue:
      typeof invoice.amount_due === "number" ? invoice.amount_due : null,
    amountPaid:
      typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
    livemode: Boolean(invoice.livemode),
    customerId: resolveStripeReferenceId(invoice.customer),
    subscriptionId: resolveStripeReferenceId(invoice.subscription),
    subscriptionDetailsUserId: trimmedMetadataString(
      invoice.subscription_details?.metadata?.userId,
    ),
    lineItems,
  };
}

function toPaymentCheckoutSession(
  session: Stripe.Checkout.Session,
): PaymentCheckoutSession {
  return {
    id: session.id,
    mode: session.mode ?? "payment",
    livemode: Boolean(session.livemode),
    metadataUserId: trimmedMetadataString(session.metadata?.userId),
    clientReferenceId: trimmedMetadataString(session.client_reference_id),
    customerId: resolveStripeReferenceId(session.customer),
    subscriptionId: resolveStripeReferenceId(session.subscription),
    creditAmountMetadata:
      typeof session.metadata?.creditAmount === "string"
        ? session.metadata.creditAmount
        : null,
  };
}

function toPaymentEvent(event: Stripe.Event): PaymentEvent {
  const base = {
    id: event.id,
    livemode: Boolean(event.livemode),
    created: typeof event.created === "number" ? event.created : 0,
  };

  if (event.type === "checkout.session.completed") {
    return {
      ...base,
      type: "checkout.session.completed",
      payload: toPaymentCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
      ),
    };
  }

  if (event.type === "invoice.paid") {
    return {
      ...base,
      type: "invoice.paid",
      payload: toPaymentInvoice(event.data.object as Stripe.Invoice),
    };
  }

  return {
    ...base,
    type: "__other__",
    rawType: event.type,
    payload: event.data.object,
  };
}

export class PaymentService implements IPaymentGateway {
  private stripe: Stripe | null = null;
  private readonly priceCredits: PriceCredits;
  private readonly webhookSecret: string | undefined;

  constructor(config?: PaymentServiceConfig) {
    const resolvedConfig = config ?? {
      secretKey: undefined,
      webhookSecret: undefined,
      priceCreditsJson: undefined,
    };

    this.priceCredits = parsePriceCredits(resolvedConfig.priceCreditsJson);
    this.webhookSecret = resolvedConfig.webhookSecret;

    const secretKey = resolvedConfig.secretKey;

    if (!secretKey) {
      logger.warn(
        "STRIPE_SECRET_KEY is not configured; payment service disabled",
      );
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error("Stripe is not configured");
    }

    return this.stripe;
  }

  private async resolveCheckoutMode(
    priceId: string,
  ): Promise<"subscription" | "payment"> {
    const stripe = this.getStripe();
    const price = await stripe.prices.retrieve(priceId);
    const isRecurring = price.type === "recurring" || Boolean(price.recurring);
    return isRecurring ? "subscription" : "payment";
  }

  public isPriceIdConfigured(priceId: string): boolean {
    const credits = this.priceCredits[priceId];
    return (
      typeof credits === "number" && Number.isFinite(credits) && credits > 0
    );
  }

  public getCreditsForPriceId(priceId: string): number {
    const credits = this.priceCredits[priceId];
    if (
      typeof credits !== "number" ||
      !Number.isFinite(credits) ||
      credits <= 0
    ) {
      throw new Error(`Unknown Stripe price ID: ${priceId}`);
    }
    return credits;
  }

  public calculateCreditsForInvoice(
    invoice: PaymentInvoice,
  ): InvoiceCreditCalculation {
    const missingPriceIds = new Set<string>();
    let credits = 0;

    for (const line of invoice.lineItems) {
      const priceId = line.priceId;
      if (!priceId) {
        continue;
      }

      if (line.proration || (line.amount !== null && line.amount <= 0)) {
        continue;
      }

      const priceCredits = this.priceCredits[priceId];
      if (!priceCredits) {
        missingPriceIds.add(priceId);
        continue;
      }

      const quantity =
        typeof line.quantity === "number" && line.quantity > 0
          ? line.quantity
          : 1;
      credits += priceCredits * quantity;
    }

    return { credits, missingPriceIds: Array.from(missingPriceIds) };
  }

  public async resolveUserIdForInvoice(
    invoice: PaymentInvoice,
  ): Promise<string | null> {
    if (invoice.subscriptionDetailsUserId) {
      return invoice.subscriptionDetailsUserId;
    }

    for (const line of invoice.lineItems) {
      if (line.metadataUserId) {
        return line.metadataUserId;
      }
    }

    if (!invoice.subscriptionId) {
      return null;
    }

    const stripe = this.getStripe();
    const fetched = await stripe.subscriptions.retrieve(invoice.subscriptionId);
    return trimmedMetadataString(fetched.metadata?.userId);
  }

  async createCheckoutSession(
    userId: string,
    priceId: string,
    returnUrl: string,
    customerId?: string,
  ): Promise<CheckoutSessionLink> {
    try {
      const credits = this.getCreditsForPriceId(priceId);
      const stripe = this.getStripe();
      const mode = await this.resolveCheckoutMode(priceId);
      const session = await stripe.checkout.sessions.create({
        ...(customerId ? { customer: customerId } : {}),
        payment_method_types: ["card", "link"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode,
        success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?canceled=true`,
        client_reference_id: userId,
        ...(mode === "subscription"
          ? {
              subscription_data: {
                metadata: {
                  userId,
                },
              },
            }
          : {}),
        metadata: {
          userId,
          creditAmount: String(credits),
        },
        automatic_tax: { enabled: true },
      });

      if (!session.url) {
        throw new Error("Stripe session URL was not generated");
      }

      return { url: session.url };
    } catch (error) {
      logger.error("Stripe Checkout Error", error as Error);
      throw error;
    }
  }

  async createCustomer(userId: string): Promise<PaymentCustomer> {
    const stripe = this.getStripe();
    const customer = await stripe.customers.create({
      metadata: {
        userId,
      },
    });

    return { id: customer.id, livemode: customer.livemode };
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<BillingPortalLink> {
    const stripe = this.getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      throw new Error("Stripe billing portal session URL was not generated");
    }

    return { url: session.url };
  }

  async listInvoices(
    customerId: string,
    limit = 20,
  ): Promise<PaymentInvoice[]> {
    const stripe = this.getStripe();
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data.map(toPaymentInvoice);
  }

  async listRecentEvents(
    type: string,
    createdAfterUnix: number,
  ): Promise<PaymentEvent[]> {
    const stripe = this.getStripe();
    const events: PaymentEvent[] = [];
    for await (const event of stripe.events.list({
      type,
      created: { gte: createdAfterUnix },
      limit: 100,
    })) {
      events.push(toPaymentEvent(event));
    }
    return events;
  }

  constructEvent(payload: string | Buffer, signature: string): PaymentEvent {
    const stripe = this.getStripe();

    if (!this.webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );

    return toPaymentEvent(event);
  }
}
