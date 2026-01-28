import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, CreditCard, FileText } from '@promptstudio/system/components/ui';
import { apiClient } from '@/services/ApiClient';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import { cn } from '@/utils/cn';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import { useUserCreditBalance } from '@hooks/useUserCreditBalance';
import type { User } from '@hooks/types';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from '@/features/billing/subscriptionTiers';
import { CREDIT_PACKS } from '@/features/billing/creditPacks';
import { AuthShell } from './auth/AuthShell';

function formatInteger(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function deriveCheckoutStatus(search: string): { sessionId: string | null; canceled: boolean } {
  const params = new URLSearchParams(search);
  return {
    sessionId: params.get('session_id'),
    canceled: params.get('canceled') === 'true',
  };
}

export function BillingPage(): React.ReactElement {
  const toast = useToast();
  const location = useLocation();
  const log = React.useMemo(() => logger.child('BillingPage'), []);

  const [user, setUser] = React.useState<User | null>(null);
  const [isBusy, setIsBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const { balance, isLoading: isLoadingBalance, error: balanceError } = useUserCreditBalance(user?.uid ?? null);
  const checkout = React.useMemo(() => deriveCheckoutStatus(location.search), [location.search]);
  const selectedPlan = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('plan');
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  }, [location.search]);

  const signInLink = React.useMemo(() => {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return `/signin?redirect=${redirect}`;
  }, [location.pathname, location.search]);

  const handleCheckout = async (priceId: string): Promise<void> => {
    if (!user) {
      toast.error('Sign in to manage billing.');
      return;
    }

    setIsBusy(priceId);
    try {
      const response = await apiClient.post('/api/payment/checkout', { priceId });
      const redirectUrl = (response as { url?: string }).url;

      if (!redirectUrl) {
        throw new Error('Missing checkout URL');
      }

      window.location.href = redirectUrl;
    } catch (error) {
      const info = sanitizeError(error);
      log.error('Checkout failed', error instanceof Error ? error : new Error(info.message), {
        operation: 'checkout',
        priceId,
      });
      toast.error('Checkout failed. Billing may not be configured.');
    } finally {
      setIsBusy(null);
    }
  };

  const handleSubscribe = async (tier: SubscriptionTier): Promise<void> => {
    await handleCheckout(tier.priceId);
  };

  const handleOpenPortal = async (): Promise<void> => {
    if (!user) {
      toast.error('Sign in to manage billing.');
      return;
    }

    setIsBusy('portal');
    try {
      const response = await apiClient.post('/api/payment/portal', {});
      const redirectUrl = (response as { url?: string }).url;

      if (!redirectUrl) {
        throw new Error('Missing billing portal URL');
      }

      window.location.href = redirectUrl;
    } catch (error) {
      const info = sanitizeError(error);
      log.error('Billing portal failed', error instanceof Error ? error : new Error(info.message), {
        operation: 'portal',
      });
      toast.error('Billing portal unavailable. Subscribe first or contact support.');
    } finally {
      setIsBusy(null);
    }
  };

  return (
    <AuthShell
      title="Billing."
      subtitle="Upgrade your monthly credits. Stripe checkout, premium vibes, and a tiny obsession with speed."
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
        {checkout.sessionId ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
            <p className="text-[13px] font-semibold text-emerald-100">Checkout complete</p>
            <p className="mt-1 text-[13px] leading-snug text-emerald-100/80">
              Your subscription is being confirmed. Credits land when the invoice is paid.
            </p>
          </div>
        ) : null}

        {checkout.canceled ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[13px] font-semibold text-white">Checkout canceled</p>
            <p className="mt-1 text-[13px] leading-snug text-white/60">
              No changes were made. You can pick a plan anytime.
            </p>
          </div>
        ) : null}

        {!user ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[13px] font-semibold text-white">Sign in to manage billing</p>
            <p className="mt-1 text-[13px] leading-snug text-white/60">
              Billing is tied to your account so credits sync everywhere you work.
            </p>
            <Button
              asChild
              variant="ghost"
              className="mt-4 h-10 rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)]"
            >
              <Link to={signInLink}>Sign in</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Credit balance</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  Used for generation and previews.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold tracking-[0.22em] text-white/50">CREDITS</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {isLoadingBalance ? '—' : formatInteger(balance ?? 0)}
                </p>
              </div>
            </div>
            {balanceError ? (
              <p className="mt-3 text-[13px] text-red-200">
                {balanceError}
              </p>
            ) : null}
          </div>
        )}

        {user ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              onClick={handleOpenPortal}
              disabled={isBusy !== null}
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
              asChild
              variant="ghost"
              className={cn(
                'h-11 gap-2 rounded-[12px]',
                'border border-white/10 bg-black/30',
                'text-[14px] font-semibold text-white/80 transition hover:bg-black/40 hover:text-white'
              )}
            >
              <Link to="/settings/billing/invoices">
                <FileText className="h-4 w-4" aria-hidden="true" />
                View invoices
              </Link>
            </Button>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-white">Plans</h2>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-white/50">MONTHLY</p>
          </div>

          <div className="mt-4 grid gap-3">
            {SUBSCRIPTION_TIERS.map((tier) => {
              const isSelected = selectedPlan === tier.priceId;
              return (
                <div
                  key={tier.priceId}
                  className={cn(
                    'rounded-[22px] p-[1px]',
                    tier.highlight || isSelected
                      ? 'bg-gradient-to-br from-accent-500/55 via-fuchsia-500/30 to-blue-500/30'
                      : 'bg-white/10'
                  )}
                >
                  <div className="rounded-2xl border border-border bg-surface-1/70 p-5 backdrop-blur-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-semibold text-white">{tier.name}</p>
                          {tier.highlight ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white/70">
                              MOST POPULAR
                            </span>
                          ) : null}
                          {isSelected && !tier.highlight ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white/70">
                              SELECTED
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-white/60">{tier.description}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-semibold text-white tabular-nums">
                          {tier.priceMonthly}
                          <span className="ml-1 text-[13px] font-medium text-white/50">/mo</span>
                        </p>
                        <p className="mt-1 text-[12px] text-white/60 tabular-nums">
                          {formatInteger(tier.creditsPerMonth)} credits
                        </p>
                      </div>
                    </div>

                    <ul className="mt-4 space-y-2 text-[13px] text-white/70">
                      {tier.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 text-white/60" aria-hidden="true" />
                          <span className="min-w-0">{bullet}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5">
                      <Button
                        type="button"
                        onClick={() => handleSubscribe(tier)}
                        disabled={!user || isBusy !== null}
                        variant="ghost"
                        className={cn(
                          'h-11 w-full gap-2 rounded-[12px]',
                          'border border-white/10 bg-white/[0.04]',
                          'text-[14px] font-semibold text-white',
                          'transition hover:bg-white/[0.06]',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                          tier.highlight || isSelected
                            ? 'bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 border-transparent shadow-[0_18px_40px_rgba(255,56,92,0.20)] hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)] hover:-translate-y-px'
                            : null
                        )}
                      >
                        <CreditCard className="h-4 w-4" aria-hidden="true" />
                        {isBusy === tier.priceId ? 'Redirecting…' : 'Subscribe'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[12px] leading-relaxed text-white/45">
            Subscriptions are processed by Stripe. Credits are granted on successful invoice payment. Image previews cost 1 credit per
            image. For changes or cancellations, contact support.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-white">Credit packs</h2>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-white/50">ONE-TIME</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.priceId}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-white">{pack.name}</p>
                    <p className="mt-1 text-[13px] leading-snug text-white/60">
                      {pack.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-white tabular-nums">{pack.price}</p>
                    <p className="mt-1 text-[12px] text-white/60 tabular-nums">
                      {formatInteger(pack.credits)} credits
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Button
                    type="button"
                    onClick={() => handleCheckout(pack.priceId)}
                    disabled={!user || isBusy !== null}
                    variant="ghost"
                    className={cn(
                      'h-10 w-full rounded-[12px]',
                      'border border-white/10 bg-black/30',
                      'text-[13px] font-semibold text-white/80 transition hover:bg-black/40 hover:text-white',
                      'disabled:cursor-not-allowed disabled:opacity-60'
                    )}
                  >
                    {isBusy === pack.priceId ? 'Redirecting…' : 'Buy credits'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[12px] leading-relaxed text-white/45">
            Credit packs are one-time purchases and add credits immediately after checkout confirmation.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
