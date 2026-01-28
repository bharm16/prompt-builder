import React from 'react';
import { MarketingPage } from './MarketingPage';
import { Card } from '@promptstudio/system/components/ui/card';

type TocItem = {
  id: string;
  label: string;
};

const TOC: TocItem[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'who', label: 'Who we are' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'billing', label: 'Billing' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'ip', label: 'Your content' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'termination', label: 'Termination' },
  { id: 'changes', label: 'Changes' },
  { id: 'contact', label: 'Contact' },
];

function Toc(): React.ReactElement {
  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-muted">
        ON THIS PAGE
      </p>
      <ul className="mt-3 space-y-2">
        {TOC.map((item) => (
          <li key={item.id}>
            <a
              className="text-[rgb(170,174,187)] hover:text-foreground hover:underline"
              href={`#${item.id}`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }): React.ReactElement {
  return (
    <h2
      id={id}
      className="scroll-mt-24 mb-4 text-2xl font-normal leading-none tracking-tight text-foreground"
    >
      {children}
    </h2>
  );
}

export function TermsOfServicePage(): React.ReactElement {
  const updatedAt = 'January 13, 2026';
  const supportEmail =
    (import.meta as { env?: { VITE_SUPPORT_EMAIL?: string } }).env?.VITE_SUPPORT_EMAIL?.trim() || 'support@yourdomain.com';
  const companyName = 'Vidra';
  const productName = 'Vidra';

  return (
    <MarketingPage
      variant="legal"
      eyebrow="LEGAL"
      title="Terms of Service"
      subtitle={`Terms for using ${productName}. Last updated ${updatedAt}.`}
    >
      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-[calc(var(--global-top-nav-height)+24px)] lg:self-start">
          <Card className="rounded-xl bg-[rgb(23,24,31)] p-4">
            <Toc />
          </Card>
        </aside>

        <div className="ps-border-gradient rounded-xl">
          <Card className="p-8">
            <div className="space-y-12 text-base leading-5 text-[rgb(170,174,187)]">
              <section>
                <SectionHeading id="summary">Summary</SectionHeading>
                <p>
                  These Terms govern your use of {productName} (the “Service”). By accessing or using the Service, you agree to these Terms.
                </p>
              </section>

              <section>
                <SectionHeading id="who">Who we are</SectionHeading>
                <p>
                  The Service is provided by {companyName} (“we”, “us”, “our”). Contact:{' '}
                  <a
                    className="font-medium text-[rgb(236,72,153)] hover:underline"
                    href={`mailto:${supportEmail}`}
                  >
                    {supportEmail}
                  </a>
                  .
                </p>
              </section>

              <section>
                <SectionHeading id="accounts">Accounts</SectionHeading>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You’re responsible for activity under your account.</li>
                  <li>Provide accurate information and keep your credentials secure.</li>
                  <li>We may suspend accounts that violate these Terms or applicable law.</li>
                </ul>
              </section>

              <section>
                <SectionHeading id="acceptable-use">Acceptable use</SectionHeading>
                <p>
                  Don’t misuse the Service. For example, don’t attempt to reverse engineer, disrupt, or overload
                  our systems, and don’t use the Service to generate content that is unlawful, harmful, or infringes
                  others’ rights.
                </p>
              </section>

              <section>
                <SectionHeading id="billing">Billing</SectionHeading>
                <p>
                  Some features require payment. If you purchase a subscription, you authorize us (and our payment provider, Stripe) to charge your payment method
                  on a recurring basis until you cancel.
                </p>
                <ul className="mt-4 list-disc pl-6 space-y-2">
                  <li>Taxes may apply.</li>
                  <li>You can manage billing details, payment methods, and subscription changes via the billing portal (when available).</li>
                  <li>Invoices and receipts are available in the Service after payment.</li>
                  <li>Refunds, if any, follow our posted policy or the requirements of applicable law.</li>
                  <li>We may change prices with advance notice where required.</li>
                </ul>
              </section>

              <section>
                <SectionHeading id="privacy">Privacy</SectionHeading>
                <p>
                  Our Privacy Policy describes how we collect and use information. By using the Service, you agree
                  to the Privacy Policy.
                </p>
              </section>

              <section>
                <SectionHeading id="ip">Your content</SectionHeading>
                <p>
                  You retain ownership of content you submit. You grant us a limited license to host, store, and process
                  that content to operate and improve the Service. If you share content publicly, you are responsible
                  for what you publish.
                </p>
              </section>

              <section>
                <SectionHeading id="disclaimers">Disclaimers</SectionHeading>
                <p>
                  The Service is provided “as is” without warranties of any kind. Outputs generated by AI models may be
                  inaccurate; verify results before relying on them.
                </p>
              </section>

              <section>
                <SectionHeading id="liability">Limitation of liability</SectionHeading>
                <p>
                  To the maximum extent permitted by law, we will not be liable for indirect, incidental, special,
                  consequential, or punitive damages, or any loss of profits or revenues.
                </p>
              </section>

              <section>
                <SectionHeading id="termination">Termination</SectionHeading>
                <p>
                  You may stop using the Service at any time. We may suspend or terminate access if you violate these
                  Terms or if required to comply with law.
                </p>
              </section>

              <section>
                <SectionHeading id="changes">Changes</SectionHeading>
                <p>
                  We may update these Terms from time to time. If changes are material, we will provide notice as required.
                  Continued use after changes means you accept the updated Terms.
                </p>
              </section>

              <section>
                <SectionHeading id="contact">Contact</SectionHeading>
                <p>
                  Questions about these Terms? Email{' '}
                  <a
                    className="font-medium text-[rgb(236,72,153)] hover:underline"
                    href={`mailto:${supportEmail}`}
                  >
                    {supportEmail}
                  </a>
                  .
                </p>
              </section>
            </div>
          </Card>
        </div>
      </div>
    </MarketingPage>
  );
}
