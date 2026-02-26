import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingPage } from './MarketingPage';
import { Button } from '@promptstudio/system/components/ui/button';

export function NotFoundPage(): React.ReactElement {
  return (
    <MarketingPage
      eyebrow="404"
      title="Page not found"
      subtitle="The page you're looking for doesn't exist or has been moved."
      actions={
        <Button
          asChild
          variant="ghost"
          className="h-10 rounded-full bg-foreground px-4 text-[13px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)] active:translate-y-0"
        >
          <Link to="/">Back to workspace</Link>
        </Button>
      }
    />
  );
}
