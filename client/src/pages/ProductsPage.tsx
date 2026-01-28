import React from 'react';
import { MarketingPage } from './MarketingPage';
import { Card } from '@promptstudio/system/components/ui/card';

export function ProductsPage(): React.ReactElement {
  return (
    <MarketingPage
      title="Products"
      subtitle="Company-level navigation belongs here. Keep app navigation in the sidebar."
    >
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground">Prompt Builder</h3>
          <p className="mt-2 text-muted">
            Optimize prompts with structured improvements and history.
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground">Docs / API</h3>
          <p className="mt-2 text-muted">
            Integrate prompt optimization into your own tools.
          </p>
        </Card>
      </div>
    </MarketingPage>
  );
}

