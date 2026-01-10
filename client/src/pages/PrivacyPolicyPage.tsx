import React from 'react';
import { MarketingPage } from './MarketingPage';

export function PrivacyPolicyPage(): React.ReactElement {
  const updatedAt = 'January 9, 2026';
  return (
    <MarketingPage
      eyebrow="LEGAL"
      title="Privacy Policy"
      subtitle={`Template privacy policy for Vidra. Replace placeholders and have counsel review. Last updated ${updatedAt}.`}
    >
      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-[calc(var(--global-top-nav-height)+24px)] lg:self-start">
          <div className="card p-5">
            <nav aria-label="On this page" className="text-[13px]">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-geist-accents-5">
                ON THIS PAGE
              </p>
              <ul className="mt-3 space-y-2">
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#overview">
                    Overview
                  </a>
                </li>
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#data">
                    Data we collect
                  </a>
                </li>
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#use">
                    How we use data
                  </a>
                </li>
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#sharing">
                    Sharing
                  </a>
                </li>
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#choices">
                    Your choices
                  </a>
                </li>
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#contact">
                    Contact
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </aside>

        <div className="border-gradient rounded-geist-lg">
          <div className="card p-6">
            <div className="rounded-geist-lg border border-warning-500/25 bg-warning-50 px-4 py-3">
              <p className="text-[13px] text-warning-900">
                This page is a starter template, not legal advice. Replace bracketed placeholders and align the policy
                with your actual data flows.
              </p>
            </div>

            <div className="mt-6 space-y-8 text-[14px] leading-relaxed text-geist-accents-6">
              <section>
                <h2 id="overview" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Overview
                </h2>
                <p className="mt-2">
                  This Privacy Policy explains how <span className="font-medium text-geist-foreground">[Your Company Name]</span>{' '}
                  (“we”, “us”, “our”) collects, uses, and shares information when you use Vidra (the “Service”).
                </p>
              </section>

              <section>
                <h2 id="data" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Data we collect
                </h2>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>
                    <span className="font-medium text-geist-foreground">Account data</span>: email, display name, authentication identifiers.
                  </li>
                  <li>
                    <span className="font-medium text-geist-foreground">Usage data</span>: feature interactions, diagnostics, performance metrics.
                  </li>
                  <li>
                    <span className="font-medium text-geist-foreground">Content you provide</span>: prompts and outputs you save or share.
                  </li>
                  <li>
                    <span className="font-medium text-geist-foreground">Billing data</span>: handled by our payment provider (e.g., Stripe). We may receive limited metadata such as subscription status.
                  </li>
                </ul>
              </section>

              <section>
                <h2 id="use" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  How we use data
                </h2>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>Provide, maintain, and improve the Service.</li>
                  <li>Authenticate you and secure accounts.</li>
                  <li>Process payments and prevent fraud.</li>
                  <li>Debug issues and measure performance.</li>
                  <li>Communicate with you about updates and support requests.</li>
                </ul>
              </section>

              <section>
                <h2 id="sharing" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Sharing
                </h2>
                <p className="mt-2">
                  We share information with service providers that help us operate the Service (e.g., hosting, analytics, payment processing),
                  and when required by law. We do not sell your personal information.
                </p>
              </section>

              <section>
                <h2 id="choices" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Your choices
                </h2>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>You can access and update your account information.</li>
                  <li>You can request deletion subject to legal and operational requirements.</li>
                  <li>You can opt out of non-essential communications.</li>
                </ul>
              </section>

              <section>
                <h2 id="contact" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Contact
                </h2>
                <p className="mt-2">
                  Questions about this policy? Email <span className="font-medium text-geist-foreground">[support@yourdomain.com]</span>.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </MarketingPage>
  );
}

