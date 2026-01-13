import React from 'react';
import { MarketingPage } from './MarketingPage';

export function PrivacyPolicyPage(): React.ReactElement {
  const updatedAt = 'January 13, 2026';
  const supportEmail =
    (import.meta as { env?: { VITE_SUPPORT_EMAIL?: string } }).env?.VITE_SUPPORT_EMAIL?.trim() || 'support@yourdomain.com';
  const companyName = 'Vidra';
  const productName = 'Vidra';

  return (
    <MarketingPage
      eyebrow="LEGAL"
      title="Privacy Policy"
      subtitle={`How ${companyName} collects, uses, and shares information when you use ${productName}. Last updated ${updatedAt}.`}
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
                    Information we collect
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
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#retention">
                    Retention
                  </a>
                </li>
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#choices">
                    Your choices & rights
                  </a>
                </li>
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#security">
                    Security
                  </a>
                </li>
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#transfers">
                    International transfers
                  </a>
                </li>
                <li>
                  <a className="text-geist-accents-6 hover:text-geist-foreground hover:underline" href="#changes">
                    Changes
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
            <div className="mt-6 space-y-8 text-[14px] leading-relaxed text-geist-accents-6">
              <section>
                <h2 id="overview" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Overview
                </h2>
                <p className="mt-2">
                  This Privacy Policy explains how {companyName} (“we”, “us”, “our”) collects, uses, and shares information when you use{' '}
                  {productName} (the “Service”).
                </p>
                <p className="mt-2">
                  If you have questions about this policy or want to exercise a privacy right, contact us at{' '}
                  <span className="font-medium text-geist-foreground">{supportEmail}</span>.
                </p>
              </section>

              <section>
                <h2 id="data" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Information we collect
                </h2>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>
                    <span className="font-medium text-geist-foreground">Account information</span>: email address, display name, and authentication identifiers from our auth provider.
                  </li>
                  <li>
                    <span className="font-medium text-geist-foreground">Content you submit</span>: prompts, generated outputs, and any text or assets you choose to save. If you create a share link, shared content may be accessible to anyone with the link.
                  </li>
                  <li>
                    <span className="font-medium text-geist-foreground">Usage and device information</span>: interactions with the Service, pages/screens viewed, diagnostic logs, and performance metrics (including via analytics tooling).
                  </li>
                  <li>
                    <span className="font-medium text-geist-foreground">Billing information</span>: payments are processed by Stripe. We receive limited billing metadata such as subscription status and invoice details; we do not receive full card numbers.
                  </li>
                  <li>
                    <span className="font-medium text-geist-foreground">Support communications</span>: information you include when contacting support (e.g., email, message content, attachments).
                  </li>
                </ul>
                <p className="mt-3">
                  <span className="font-medium text-geist-foreground">AI processing.</span> When you use features that call an AI model (for example,
                  generating suggestions or previews), we send the inputs you provide to the relevant AI provider to process your request and return results.
                </p>
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
                  We share information with service providers that help us operate the Service (e.g., hosting, analytics, error monitoring, and payment processing),
                  as well as AI providers you choose to use through the Service. We may also share information to comply with law, protect rights and safety,
                  or in connection with a business transfer (e.g., merger or acquisition). We do not sell personal information.
                </p>
              </section>

              <section>
                <h2 id="retention" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Retention
                </h2>
                <p className="mt-2">
                  We retain information for as long as needed to provide the Service and for legitimate business purposes such as security, fraud prevention,
                  dispute resolution, and compliance with legal obligations. You can request deletion, and we will honor requests subject to these requirements.
                </p>
              </section>

              <section>
                <h2 id="choices" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Your choices & rights
                </h2>
                <ul className="mt-2 list-disc pl-5 space-y-2">
                  <li>You can access and update certain account information in the Service.</li>
                  <li>You can request deletion of your account and saved content, subject to legal and operational requirements.</li>
                  <li>You can opt out of non-essential communications.</li>
                  <li>If you are in the EEA/UK or certain other regions, you may have additional rights (e.g., access, correction, portability, objection, restriction).</li>
                </ul>
              </section>

              <section>
                <h2 id="security" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Security
                </h2>
                <p className="mt-2">
                  We use administrative, technical, and physical safeguards designed to protect information. No method of transmission or storage is 100% secure,
                  so we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 id="transfers" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  International transfers
                </h2>
                <p className="mt-2">
                  We and our service providers may process and store information in countries other than where you live. When we transfer information internationally,
                  we take steps to protect it as required by applicable law.
                </p>
              </section>

              <section>
                <h2 id="changes" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Changes
                </h2>
                <p className="mt-2">
                  We may update this policy from time to time. If changes are material, we will provide notice as required by law. The “Last updated” date above reflects
                  the effective date of the latest version.
                </p>
              </section>

              <section>
                <h2 id="contact" className="scroll-mt-24 text-lg font-semibold tracking-tight text-geist-foreground">
                  Contact
                </h2>
                <p className="mt-2">
                  Questions about this policy? Email <span className="font-medium text-geist-foreground">{supportEmail}</span>.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </MarketingPage>
  );
}
