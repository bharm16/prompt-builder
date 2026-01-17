import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingPage } from './MarketingPage';
import { Button } from '@promptstudio/system/components/ui/button';
import { Card } from '@promptstudio/system/components/ui/card';

export function HomePage(): React.ReactElement {
  return (
    <MarketingPage
      title="Vidra"
      subtitle="Better prompts, faster. Keep the app focused—keep the company navigation global."
    >
      <div className="mt-8 flex flex-col gap-4">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground">Prompt Builder</h2>
          <p className="mt-2 text-muted">
            Jump into the app to create and optimize prompts.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link to="/">Open app</Link>
            </Button>
          </div>
        </Card>
      </div>
    </MarketingPage>
  );
}

