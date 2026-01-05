import React from 'react';
import { MarketingPage } from './MarketingPage';

export function DocsPage(): React.ReactElement {
  return (
    <MarketingPage
      title="Docs"
      subtitle="Link out to your API docs or embed documentation content here."
    >
      <div className="mt-8 card p-6">
        <p className="text-geist-accents-6">
          If you have an external docs site, you can point this nav item there later.
        </p>
      </div>
    </MarketingPage>
  );
}


