import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Section } from '@components/layout';

type MarketingPageProps = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export function MarketingPage({
  title,
  subtitle,
  children,
}: MarketingPageProps): React.ReactElement {
  return (
    <div className="h-full overflow-y-auto gradient-neutral">
      <Section spacing="geist-base">
        <Container size="lg">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold text-geist-foreground tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-geist-accents-6 max-w-2xl">{subtitle}</p>
            ) : null}
          </div>
        </Container>
      </Section>

      <Container size="lg">
        <div className="pb-16">{children}</div>
        <div className="py-8 border-t border-geist-accents-2 text-sm text-geist-accents-6">
          <Link to="/" className="text-geist-foreground hover:underline">
            Go to app
          </Link>
        </div>
      </Container>
    </div>
  );
}


