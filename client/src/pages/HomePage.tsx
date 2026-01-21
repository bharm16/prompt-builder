import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { MarketingPage } from './MarketingPage';

export function HomePage(): ReactElement {
  return (
    <MarketingPage
      title="Better prompts. Better video."
      subtitle="Optimize your AI video prompts for Sora, Veo, Runway, and more."
      actions={
        <>
          <Link
            to="/"
            className="inline-flex h-9 items-center rounded-md bg-white px-3 text-[13px] font-semibold text-slate-900 shadow-sm transition hover:-translate-y-px hover:shadow-md"
          >
            Try Vidra
          </Link>
          <Link
            to="/signup"
            className="inline-flex h-9 items-center rounded-md border border-border bg-surface-1 px-3 text-[13px] font-semibold text-foreground transition hover:border-border-strong"
          >
            Create account
          </Link>
        </>
      }
    >
      {/* Intentionally no body content on the marketing home page */}
    </MarketingPage>
  );
}
