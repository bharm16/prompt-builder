import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Section } from '@components/layout';

type MarketingPageProps = {
  variant?: 'default' | 'legal';
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export function MarketingPage({
  variant = 'default',
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: MarketingPageProps): React.ReactElement {
  const isLegal = variant === 'legal';

  return (
    <div
      className={
        isLegal
          ? 'h-full overflow-y-auto bg-[rgb(13,14,18)] text-base'
          : 'h-full overflow-y-auto bg-app'
      }
    >
      <Section spacing="ps-6">
        <Container size={isLegal ? 'xl' : 'lg'}>
          <div
            className={
              isLegal
                ? 'relative overflow-hidden rounded-2xl border border-border bg-surface-1 p-8 animate-slide-in-from-bottom'
                : 'relative overflow-hidden rounded-lg border border-border bg-surface-1 p-6 animate-slide-in-from-bottom'
            }
          >
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
                  <p
                    className={
                      isLegal
                        ? 'text-[11px] font-medium tracking-[0.22em] uppercase text-muted'
                        : 'text-[11px] font-semibold tracking-[0.22em] text-muted'
                    }
                  >
                    {eyebrow}
                  </p>
                ) : null}
                <h1
                  className={
                    isLegal
                      ? 'text-5xl font-normal leading-[1.1] tracking-[-0.025em] text-foreground'
                      : 'text-3xl font-semibold text-foreground tracking-tight sm:text-4xl'
                  }
                >
                  {title}
                </h1>
                {subtitle ? (
                  <p
                    className={
                      isLegal
                        ? 'max-w-2xl text-base leading-5 text-[rgb(170,174,187)]'
                        : 'text-muted max-w-2xl text-[15px] leading-relaxed'
                    }
                  >
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

      <Container size={isLegal ? 'xl' : 'lg'}>
        <div className="pb-16">{children}</div>
        <footer className="py-8 border-t border-border text-sm text-muted">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="text-foreground hover:underline font-medium">
              Go to app
            </Link>
            <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
              <Link to="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
              <Link to="/contact" className="hover:text-foreground">
                Support
              </Link>
              <Link to="/privacy-policy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link to="/terms-of-service" className="hover:text-foreground">
                Terms
              </Link>
            </nav>
          </div>
        </footer>
      </Container>
    </div>
  );
}

