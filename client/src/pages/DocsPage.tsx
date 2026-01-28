import React from 'react';
import { MarketingPage } from './MarketingPage';
import { Card } from '@promptstudio/system/components/ui/card';

export function DocsPage(): React.ReactElement {
  return (
    <MarketingPage
      title="Docs"
      subtitle="Link out to your API docs or embed documentation content here."
    >
      <Card className="mt-8 p-6">
        <p className="text-muted">
          If you have an external docs site, you can point this nav item there later.
        </p>
      </Card>
    </MarketingPage>
  );
}

