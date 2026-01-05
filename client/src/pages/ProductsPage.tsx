import React from 'react';
import { MarketingPage } from './MarketingPage';

export function ProductsPage(): React.ReactElement {
  return (
    <MarketingPage
      title="Products"
      subtitle="Company-level navigation belongs here. Keep app navigation in the sidebar."
    >
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-geist-foreground">Prompt Builder</h3>
          <p className="mt-2 text-geist-accents-6">
            Optimize prompts with structured improvements and history.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-geist-foreground">Docs / API</h3>
          <p className="mt-2 text-geist-accents-6">
            Integrate prompt optimization into your own tools.
          </p>
        </div>
      </div>
    </MarketingPage>
  );
}


