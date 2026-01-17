import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CreditCard, ExternalLink, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiClient } from '@/services/ApiClient';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import { cn } from '@/utils/cn';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import type { User } from '@hooks/types';
import { AuthShell } from './auth/AuthShell';

type InvoiceSummary = {
  id: string;
  number: string | null;
  status: string | null;
  created: number | null;
  currency: string | null;
  amountDue: number | null;
  amountPaid: number | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

function formatStripeAmount(amountMinor: number | null, currency: string | null): string {
  if (!currency || typeof currency !== 'string') return '—';
  if (typeof amountMinor !== 'number' || !Number.isFinite(amountMinor)) return '—';

  const normalizedCurrency = currency.trim().toUpperCase();
  if (!normalizedCurrency) return '—';

  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: normalizedCurrency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const factor = 10 ** fractionDigits;
  return formatter.format(amountMinor / factor);
}

function formatInvoiceDate(epochSeconds: number | null): string {
  if (typeof epochSeconds !== 'number' || !Number.isFinite(epochSeconds)) return '—';
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function normalizeInvoices(payload: unknown): InvoiceSummary[] {
  if (!payload || typeof payload !== 'object') return [];
  const invoices = 'invoices' in payload ? (payload as { invoices?: unknown }).invoices : null;
  if (!Array.isArray(invoices)) return [];

  return invoices
    .map((invoice): InvoiceSummary | null => {
      if (!invoice || typeof invoice !== 'object') return null;
      const record = invoice as Partial<InvoiceSummary>;
      if (!record.id || typeof record.id !== 'string') return null;
      return {
        id: record.id,
        number: typeof record.number === 'string' ? record.number : null,
        status: typeof record.status === 'string' ? record.status : null,
        created: typeof record.created === 'number' ? record.created : null,
        currency: typeof record.currency === 'string' ? record.currency : null,
        amountDue: typeof record.amountDue === 'number' ? record.amountDue : null,
        amountPaid: typeof record.amountPaid === 'number' ? record.amountPaid : null,
        hostedInvoiceUrl: typeof record.hostedInvoiceUrl === 'string' ? record.hostedInvoiceUrl : null,
        invoicePdf: typeof record.invoicePdf === 'string' ? record.invoicePdf : null,
      };
    })
    .filter((invoice): invoice is InvoiceSummary => Boolean(invoice));
}

function resolveInvoiceLabel(status: string | null): { label: string; tone: 'good' | 'warn' | 'neutral' } {
  switch ((status ?? '').toLowerCase()) {
    case 'paid':
      return { label: 'Paid', tone: 'good' };
    case 'open':
    case 'uncollectible':
      return { label: status === 'open' ? 'Payment due' : 'Payment issue', tone: 'warn' };
    case 'void':
      return { label: 'Voided', tone: 'neutral' };
    case 'draft':
      return { label: 'Draft', tone: 'neutral' };
    default:
      return { label: status ? status : 'Unknown', tone: 'neutral' };
  }
}

export function BillingInvoicesPage(): React.ReactElement {
  const toast = useToast();
  const location = useLocation();
  const log = React.useMemo(() => logger.child('BillingInvoicesPage'), []);

  const [user, setUser] = React.useState<User | null>(null);
  const [invoices, setInvoices] = React.useState<InvoiceSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const signInLink = React.useMemo(() => {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return `/signin?redirect=${redirect}`;
  }, [location.pathname, location.search]);

  const loadInvoices = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/payment/invoices');
      setInvoices(normalizeInvoices(response));
    } catch (err) {
      const info = sanitizeError(err);
      log.error('Failed to load invoices', err instanceof Error ? err : new Error(info.message), { operation: 'loadInvoices' });
      setError('Failed to load invoices. Billing may not be configured yet.');
    } finally {
      setIsLoading(false);
    }
  }, [log, user]);

  React.useEffect(() => {
    if (!user) return;
    void loadInvoices();
  }, [loadInvoices, user]);

  const handleOpenPortal = async (): Promise<void> => {
    if (!user) {
      toast.error('Sign in to manage billing.');
      return;
    }
    setIsBusy(true);
    try {
      const response = await apiClient.post('/api/payment/portal', {});
      const url = (response as { url?: string }).url;
      if (!url) throw new Error('Missing billing portal URL');
      window.location.href = url;
    } catch (err) {
      const info = sanitizeError(err);
      log.error('Failed to create billing portal session', err instanceof Error ? err : new Error(info.message), {
        operation: 'billingPortal',
      });
      toast.error('Billing portal unavailable. Subscribe first or contact support.');
    } finally {
      setIsBusy(false);
    }
  };

  const hasPaymentIssue = invoices.some((invoice) => ['open', 'uncollectible'].includes((invoice.status ?? '').toLowerCase()));

  return (
    <AuthShell
      title="Invoices."
      subtitle="Receipts, payment status, and a one-click escape hatch to Stripe for edge cases."
      footer={
        <>
          Need help?{' '}
          <Link to="/contact" className="text-white hover:underline">
            Contact support
          </Link>
          .
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!user ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[13px] font-semibold text-white">Sign in to view receipts</p>
            <p className="mt-1 text-[13px] leading-snug text-white/60">
              Invoices are tied to your account so you can grab receipts anytime.
            </p>
            <Button
              asChild
              variant="ghost"
              className="mt-4 h-10 rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)]"
            >
              <Link to={signInLink}>Sign in</Link>
            </Button>
          </div>
        ) : null}

        {user && hasPaymentIssue ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-100/90" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-amber-100">Payment issue detected</p>
                <p className="mt-1 text-[13px] leading-snug text-amber-100/70">
                  One of your invoices needs attention. Open the billing portal to update your payment method or retry.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {user && error ? (
          <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-100">
            {error}
          </div>
        ) : null}

        {user ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              onClick={handleOpenPortal}
              disabled={isBusy}
              variant="ghost"
              className={cn(
                'h-11 gap-2 rounded-[12px]',
                'border border-white/10 bg-white/[0.04]',
                'text-[14px] font-semibold text-white transition hover:bg-white/[0.06]',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Manage billing
            </Button>

            <Button
              type="button"
              onClick={() => void loadInvoices()}
              disabled={isLoading || isBusy}
              variant="ghost"
              className={cn(
                'h-11 gap-2 rounded-[12px]',
                'border border-white/10 bg-black/30',
                'text-[14px] font-semibold text-white/80 transition hover:bg-black/40 hover:text-white',
                'disabled:cursor-not-allowed disabled:opacity-60'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading ? 'animate-spin' : null)} aria-hidden="true" />
              Refresh
            </Button>
          </div>
        ) : null}

        {user ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-white">Payment history</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  Download PDFs or open hosted invoices for receipts.
                </p>
              </div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-white/50">
                {isLoading ? 'LOADING' : `${invoices.length} INVOICES`}
              </p>
            </div>

            {isLoading ? (
              <p className="mt-4 text-[13px] text-white/60">Loading…</p>
            ) : invoices.length === 0 ? (
              <p className="mt-4 text-[13px] text-white/60">No invoices yet.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {invoices.map((invoice) => {
                  const status = resolveInvoiceLabel(invoice.status);
                  const pdfUrl = invoice.invoicePdf;
                  const hostedUrl = invoice.hostedInvoiceUrl;
                  const primaryLink = pdfUrl || hostedUrl;
                  const primaryLabel = pdfUrl ? 'Download PDF' : 'Open invoice';
                  return (
                    <div key={invoice.id} className="rounded-2xl border border-white/10 bg-[#07070D]/50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-white">
                            {invoice.number ? `Invoice ${invoice.number}` : 'Invoice'}
                          </p>
                          <p className="mt-1 text-[13px] text-white/60">
                            {formatInvoiceDate(invoice.created)} •{' '}
                            <span className="font-medium text-white">
                              {formatStripeAmount(invoice.amountPaid ?? invoice.amountDue, invoice.currency)}
                            </span>
                          </p>
                        </div>

                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide',
                            status.tone === 'good'
                              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                              : status.tone === 'warn'
                                ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
                                : 'border-white/10 bg-white/[0.06] text-white/70'
                          )}
                        >
                          {status.label}
                        </span>
                      </div>

                      {primaryLink ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            asChild
                            variant="ghost"
                            className="h-9 gap-2 rounded-[12px] border border-white/10 bg-white/[0.04] px-3 text-[13px] font-semibold text-white transition hover:bg-white/[0.06]"
                          >
                            <a href={primaryLink} target="_blank" rel="noreferrer">
                              {pdfUrl ? (
                                <FileText className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                              )}
                              {primaryLabel}
                            </a>
                          </Button>

                          {pdfUrl && hostedUrl ? (
                            <Button
                              asChild
                              variant="ghost"
                              className="h-9 gap-2 rounded-[12px] border border-white/10 bg-black/30 px-3 text-[13px] font-semibold text-white/80 transition hover:bg-black/40 hover:text-white"
                            >
                              <a href={hostedUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                Open hosted invoice
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-4 text-[13px] text-white/60">Receipt links aren’t available for this invoice.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}
