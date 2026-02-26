import { useState } from 'react';
import { createCheckoutSession } from '@/api/billingApi';
import { Button } from '@promptstudio/system/components/ui/button';
import { logger } from '../../services/LoggingService';
import { sanitizeError } from '../../utils/logging';
import { SUBSCRIPTION_TIERS } from './subscriptionTiers';
import { CREDIT_PACKS } from './creditPacks';

export const CreditPurchaseModal = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const log = logger.child('CreditPurchaseModal');

  const handlePurchase = async (priceId: string): Promise<void> => {
    setLoading(priceId);
    try {
      const { url: redirectUrl } = await createCheckoutSession(priceId);

      if (!redirectUrl) {
        throw new Error('Missing checkout URL');
      }

      window.location.href = redirectUrl;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(sanitizeError(error).message);
      log.error('Checkout failed', err, { operation: 'checkout', priceId });
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8 p-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900">Subscriptions</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {SUBSCRIPTION_TIERS.map((tier) => (
            <div
              key={tier.priceId}
              className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-blue-500 flex flex-col"
            >
              <h4 className="text-xl font-bold">{tier.name}</h4>
              <div className="mt-2 text-3xl font-bold">
                {tier.priceMonthly}
                <span className="text-base font-normal text-gray-500">/mo</span>
              </div>
              <p className="mt-1 text-gray-500 font-medium">
                {tier.creditsPerMonth.toLocaleString()} Credits
              </p>
              <p className="mt-2 text-sm text-gray-400 flex-grow">{tier.description}</p>

              <Button
                onClick={() => handlePurchase(tier.priceId)}
                loading={loading === tier.priceId}
                className="mt-6 w-full"
              >
                Subscribe
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900">Credit packs</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.priceId}
              className="rounded-lg border border-gray-200 p-6 transition-colors hover:border-blue-500 flex flex-col"
            >
              <h4 className="text-xl font-bold">{pack.name}</h4>
              <div className="mt-2 text-3xl font-bold">{pack.price}</div>
              <p className="mt-1 text-gray-500 font-medium">
                {pack.credits.toLocaleString()} Credits
              </p>
              <p className="mt-2 text-sm text-gray-400 flex-grow">{pack.description}</p>

              <Button
                onClick={() => handlePurchase(pack.priceId)}
                loading={loading === pack.priceId}
                className="mt-6 w-full"
              >
                Buy credits
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
