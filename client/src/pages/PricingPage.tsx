import React from 'react';
import { MarketingPage } from './MarketingPage';

export function PricingPage(): React.ReactElement {
  return (
    <MarketingPage
      title="Pricing"
      subtitle="Placeholder pricing page. This is intentionally separate from the app’s task sidebar."
    >
      <div className="mt-8 card p-6">
        <p className="text-geist-accents-6">
          Add your pricing tiers here when ready.
        </p>
      </div>
    </MarketingPage>
  );
}


