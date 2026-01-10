import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Section } from '@components/layout';

type MarketingPageProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export function MarketingPage({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: MarketingPageProps): React.ReactElement {
  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-neutral-50 via-white to-neutral-50">
      <Section spacing="geist-base">
        <Container size="lg">
          <div className="relative overflow-hidden rounded-geist-lg border border-geist-accents-2 bg-white p-6 animate-slide-in-from-bottom">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              aria-hidden="true"
              style={{
                background:
                  'radial-gradient(1000px 340px at 8% 10%, rgba(12,143,235,0.16), transparent 60%), radial-gradient(960px 340px at 92% 0%, rgba(168,85,247,0.14), transparent 55%), radial-gradient(820px 300px at 50% 100%, rgba(255,56,92,0.12), transparent 58%)',
              }}
            />

            <div className="relative flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                {eyebrow ? (
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-geist-accents-5">
                    {eyebrow}
                  </p>
                ) : null}
                <h1 className="text-3xl font-semibold text-geist-foreground tracking-tight sm:text-4xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="text-geist-accents-6 max-w-2xl text-[15px] leading-relaxed">
                    {subtitle}
                  </p>
                ) : null}
              </div>

              {actions ? (
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
              ) : null}
            </div>
          </div>
        </Container>
      </Section>

      <Container size="lg">
        <div className="pb-16">{children}</div>
        <footer className="py-8 border-t border-geist-accents-2 text-sm text-geist-accents-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="text-geist-foreground hover:underline font-medium">
              Go to app
            </Link>
            <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
              <Link to="/pricing" className="hover:text-geist-foreground">
                Pricing
              </Link>
              <Link to="/contact" className="hover:text-geist-foreground">
                Support
              </Link>
              <Link to="/privacy-policy" className="hover:text-geist-foreground">
                Privacy
              </Link>
              <Link to="/terms-of-service" className="hover:text-geist-foreground">
                Terms
              </Link>
            </nav>
          </div>
        </footer>
      </Container>
    </div>
  );
}

