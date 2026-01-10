import React from 'react';
import { MarketingPage } from './MarketingPage';

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
    <nav aria-label="On this page" className="text-[13px]">
      <p className="text-[11px] font-semibold tracking-[0.22em] text-geist-accents-5">
        ON THIS PAGE
      </p>
      <ul className="mt-3 space-y-2">
        {TOC.map((item) => (
          <li key={item.id}>
            <a
              className="text-geist-accents-6 hover:text-geist-foreground hover:underline"
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
      className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground"
    >
      {children}
    </h2>
  );
}

export function TermsOfServicePage(): React.ReactElement {
  const updatedAt = 'January 9, 2026';

  return (
    <MarketingPage
      eyebrow="LEGAL"
      title="Terms of Service"
      subtitle={`Template terms for Vidra. Replace placeholders and have counsel review. Last updated ${updatedAt}.`}
    >
      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-[calc(var(--global-top-nav-height)+24px)] lg:self-start">
          <div className="card p-5">
            <Toc />
          </div>
        </aside>

        <div className="border-gradient rounded-geist-lg">
          <div className="card p-6">
            <div className="rounded-geist-lg border border-warning-500/25 bg-warning-50 px-4 py-3">
              <p className="text-[13px] text-warning-900">
                This page is a starter template, not legal advice. Update company details, billing terms,
                and policy links to match your product.
              </p>
            </div>

            <div className="mt-6 space-y-8 text-[14px] leading-relaxed text-geist-accents-6">
              <section>
                <SectionHeading id="summary">Summary</SectionHeading>
                <p className="mt-2">
                  These Terms govern your use of Vidra (the “Service”). By accessing or using the Service, you agree
                  to these Terms.
                </p>
              </section>

              <section>
                <SectionHeading id="who">Who we are</SectionHeading>
                <p className="mt-2">
                  The Service is provided by <span className="font-medium text-geist-foreground">[Your Company Name]</span>{' '}
                  (“we”, “us”, “our”). Contact: <span className="font-medium text-geist-foreground">[support@yourdomain.com]</span>.
                </p>
              </section>

              <section>
                <SectionHeading id="accounts">Accounts</SectionHeading>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>You’re responsible for activity under your account.</li>
                  <li>Provide accurate information and keep your credentials secure.</li>
                  <li>We may suspend accounts that violate these Terms or applicable law.</li>
                </ul>
              </section>

              <section>
                <SectionHeading id="acceptable-use">Acceptable use</SectionHeading>
                <p className="mt-2">
                  Don’t misuse the Service. For example, don’t attempt to reverse engineer, disrupt, or overload
                  our systems, and don’t use the Service to generate content that is unlawful, harmful, or infringes
                  others’ rights.
                </p>
              </section>

              <section>
                <SectionHeading id="billing">Billing</SectionHeading>
                <p className="mt-2">
                  Some features may require payment. If you purchase a subscription, you authorize us (and our payment
                  provider) to charge your payment method on a recurring basis until you cancel.
                </p>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>Taxes may apply.</li>
                  <li>Refunds, if any, follow our posted policy or the requirements of applicable law.</li>
                  <li>We may change prices with advance notice where required.</li>
                </ul>
              </section>

              <section>
                <SectionHeading id="privacy">Privacy</SectionHeading>
                <p className="mt-2">
                  Our Privacy Policy describes how we collect and use information. By using the Service, you agree
                  to the Privacy Policy.
                </p>
              </section>

              <section>
                <SectionHeading id="ip">Your content</SectionHeading>
                <p className="mt-2">
                  You retain ownership of content you submit. You grant us a limited license to host, store, and process
                  that content to operate and improve the Service. If you share content publicly, you are responsible
                  for what you publish.
                </p>
              </section>

              <section>
                <SectionHeading id="disclaimers">Disclaimers</SectionHeading>
                <p className="mt-2">
                  The Service is provided “as is” without warranties of any kind. Outputs generated by AI models may be
                  inaccurate; verify results before relying on them.
                </p>
              </section>

              <section>
                <SectionHeading id="liability">Limitation of liability</SectionHeading>
                <p className="mt-2">
                  To the maximum extent permitted by law, we will not be liable for indirect, incidental, special,
                  consequential, or punitive damages, or any loss of profits or revenues.
                </p>
              </section>

              <section>
                <SectionHeading id="termination">Termination</SectionHeading>
                <p className="mt-2">
                  You may stop using the Service at any time. We may suspend or terminate access if you violate these
                  Terms or if required to comply with law.
                </p>
              </section>

              <section>
                <SectionHeading id="changes">Changes</SectionHeading>
                <p className="mt-2">
                  We may update these Terms from time to time. If changes are material, we will provide notice as required.
                  Continued use after changes means you accept the updated Terms.
                </p>
              </section>

              <section>
                <SectionHeading id="contact">Contact</SectionHeading>
                <p className="mt-2">
                  Questions about these Terms? Email <span className="font-medium text-geist-foreground">[support@yourdomain.com]</span>.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </MarketingPage>
  );
}

