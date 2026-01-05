import React from 'react';
import { MarketingPage } from './MarketingPage';

export function PrivacyPolicyPage(): React.ReactElement {
  return (
    <MarketingPage title="Privacy Policy" subtitle="Placeholder privacy policy page.">
      <div className="mt-8 card p-6">
        <p className="text-geist-accents-6">
          Add your privacy policy content here.
        </p>
      </div>
    </MarketingPage>
  );
}


