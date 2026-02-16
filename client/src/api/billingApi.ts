import { z } from 'zod';
import { apiClient } from '@/services/ApiClient';

const BillingSessionResponseSchema = z.object({
  url: z.string().url(),
});

const InvoiceSummarySchema = z.object({
  id: z.string(),
  number: z.string().nullable(),
  status: z.string().nullable(),
  created: z.number().nullable(),
  currency: z.string().nullable(),
  amountDue: z.number().nullable(),
  amountPaid: z.number().nullable(),
  hostedInvoiceUrl: z.string().nullable(),
  invoicePdf: z.string().nullable(),
});

const InvoicesResponseSchema = z.object({
  invoices: z.array(InvoiceSummarySchema),
});

const BillingStatusResponseSchema = z.object({
  planTier: z.string().nullable(),
  isSubscribed: z.boolean(),
  starterGrantCredits: z.number().int().nullable(),
  starterGrantGrantedAtMs: z.number().int().nullable(),
});

const CreditTransactionSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: z.number(),
  source: z.string().nullable(),
  reason: z.string().nullable(),
  referenceId: z.string().nullable(),
  createdAtMs: z.number().int(),
});

const CreditHistoryResponseSchema = z.object({
  transactions: z.array(CreditTransactionSchema),
});

export type InvoiceSummary = z.infer<typeof InvoiceSummarySchema>;
export type BillingStatus = z.infer<typeof BillingStatusResponseSchema>;
export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;

export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
  const response = await apiClient.post('/api/payment/checkout', { priceId });
  return BillingSessionResponseSchema.parse(response);
}

export async function createBillingPortalSession(): Promise<{ url: string }> {
  const response = await apiClient.post('/api/payment/portal', {});
  return BillingSessionResponseSchema.parse(response);
}

export async function fetchInvoices(): Promise<InvoiceSummary[]> {
  const response = await apiClient.get('/api/payment/invoices');
  const parsed = InvoicesResponseSchema.parse(response);
  return parsed.invoices;
}

export async function fetchBillingStatus(): Promise<BillingStatus> {
  const response = await apiClient.get('/api/payment/status');
  return BillingStatusResponseSchema.parse(response);
}

export async function fetchCreditHistory(limit?: number): Promise<CreditTransaction[]> {
  const endpoint =
    typeof limit === 'number' && Number.isFinite(limit)
      ? `/api/payment/credits/history?limit=${Math.trunc(limit)}`
      : '/api/payment/credits/history';
  const response = await apiClient.get(endpoint);
  const parsed = CreditHistoryResponseSchema.parse(response);
  return parsed.transactions;
}
