import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { getAuthRepository } from '@repositories/index';
import type { User } from '@hooks/types';
import { SUBSCRIPTION_TIERS } from '@/features/billing/subscriptionTiers';
import { MarketingPage } from './MarketingPage';
import { Card } from '@promptstudio/system/components/ui/card';

export function PricingPage(): React.ReactElement {
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const billingPath = '/settings/billing';
  const buildBillingLink = React.useCallback(
    (plan: string | null = null) => {
      const params = new URLSearchParams();
      params.set('from', 'pricing');
      if (plan) params.set('plan', plan);
      return `${billingPath}?${params.toString()}`;
    },
    [billingPath]
  );

  const billingLink = buildBillingLink();
  const signInLink = `/signin?redirect=${encodeURIComponent(billingLink)}`;
  const signUpLink = `/signup?redirect=${encodeURIComponent(billingLink)}`;

  return (
    <MarketingPage
      title="Pricing"
      eyebrow="PRICING"
      subtitle="Luxury SaaS energy with Raycast restraint: simple plans that buy you speed."
      actions={
        user ? (
          <Link
            to={billingLink}
            className="inline-flex h-9 items-center rounded-full border border-black/5 bg-gradient-to-br from-violet-500/12 to-blue-500/10 px-3 text-[13px] font-semibold text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:-translate-y-px hover:border-violet-500/25 hover:shadow-[0_10px_30px_rgba(124,58,237,0.18)]"
          >
            Manage billing
          </Link>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={signUpLink}
              className="inline-flex h-9 items-center rounded-full bg-foreground px-3 text-[13px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
            >
              Create account
            </Link>
            <Link
              to={signInLink}
              className="inline-flex h-9 items-center rounded-full border border-border bg-white px-3 text-[13px] font-semibold text-foreground transition hover:-translate-y-px hover:shadow-[0_14px_32px_rgba(0,0,0,0.10)]"
            >
              Sign in
            </Link>
          </div>
        )
      }
    >
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card className="p-6 md:col-span-1">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-muted">
            STARTER
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">Free</h2>
          <p className="mt-2 text-3xl font-semibold text-foreground tabular-nums">
            $0 <span className="text-base font-medium text-muted">/mo</span>
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Try the workflow and keep prompts moving.
          </p>
          <ul className="mt-5 space-y-2 text-[13px] text-muted">
            {['Local history', 'Core prompt optimization', 'Upgrade anytime'].map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex h-10 w-full items-center justify-center rounded-full bg-foreground px-4 text-[13px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
            >
              Open app
            </Link>
          </div>
        </Card>

        <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
          {SUBSCRIPTION_TIERS.map((tier) => (
            <div key={tier.priceId} className={tier.highlight ? 'ps-border-gradient rounded-lg' : ''}>
              <Card className="p-6 h-full flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.22em] text-muted">
                      {tier.highlight ? 'POPULAR' : 'MONTHLY'}
                    </p>
                    <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                      {tier.name}
                    </h3>
                  </div>
                  {tier.highlight ? (
                    <span className="rounded-full border border-border bg-surface-1 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted">
                      Most popular
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-3xl font-semibold text-foreground tabular-nums">
                  {tier.priceMonthly}{' '}
                  <span className="text-base font-medium text-muted">/mo</span>
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {tier.description}
                </p>

                <div className="mt-4 rounded-lg border border-border bg-surface-1 p-4">
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-muted">
                    CREDITS
                  </p>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
                    {tier.creditsPerMonth.toLocaleString()} / month
                  </p>
                </div>

                <ul className="mt-5 space-y-2 text-[13px] text-muted">
                  {tier.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-2">
                  <Link
                    to={
                      user
                        ? buildBillingLink(tier.priceId)
                        : `/signup?redirect=${encodeURIComponent(buildBillingLink(tier.priceId))}`
                    }
                    className={[
                      'inline-flex h-10 w-full items-center justify-center rounded-full px-4 text-[13px] font-semibold transition',
                      tier.highlight
                        ? 'bg-gradient-to-br from-violet-500/12 to-blue-500/10 text-slate-900 border border-black/5 hover:-translate-y-px hover:shadow-[0_10px_30px_rgba(124,58,237,0.18)]'
                        : 'bg-foreground text-white hover:-translate-y-px hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)]',
                    ].join(' ')}
                  >
                    {user ? 'Choose plan' : 'Start with this plan'}
                  </Link>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Design is the marketing',
            body: 'The product is the demo. Pricing should feel like the UI you’re about to use.',
          },
          {
            title: 'Raycast-level restraint',
            body: 'Dense, polished, and calm — no fluff, just decisions you can trust.',
          },
          {
            title: 'Arc editorial energy',
            body: 'Clear narrative: pick a plan, get credits, ship faster.',
          },
        ].map((item) => (
          <Card key={item.title} className="p-6">
            <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">FAQ</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Do I need an account to pay?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Yes — billing attaches to your account so credits sync and purchases are recoverable.
              </p>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">Where do credits show up?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                In the app after the invoice is paid. If you don’t see them, reach out via{' '}
                <Link to="/contact" className="text-foreground hover:underline font-medium">
                  support
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </Card>
    </MarketingPage>
  );
}
