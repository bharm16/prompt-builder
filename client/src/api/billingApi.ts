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

export type InvoiceSummary = z.infer<typeof InvoiceSummarySchema>;

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
