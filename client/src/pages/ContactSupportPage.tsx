import React from 'react';
import { Link } from 'react-router-dom';
import { Copy, Mail, MessageSquare, ShieldAlert } from 'lucide-react';
import { MarketingPage } from './MarketingPage';

const DEFAULT_SUPPORT_EMAIL = 'support@yourdomain.com';

function buildMailto(params: { to: string; subject: string; body: string }): string {
  const query = new URLSearchParams();
  query.set('subject', params.subject);
  query.set('body', params.body);
  return `mailto:${params.to}?${query.toString()}`;
}

export function ContactSupportPage(): React.ReactElement {
  const supportEmail = (import.meta as { env?: { VITE_SUPPORT_EMAIL?: string } }).env?.VITE_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;

  const [topic, setTopic] = React.useState<'support' | 'feedback' | 'security'>('support');
  const [fromEmail, setFromEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(supportEmail);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const mailto = buildMailto({
    to: supportEmail,
    subject:
      topic === 'security'
        ? 'Security report'
        : topic === 'feedback'
          ? 'Product feedback'
          : 'Support request',
    body: [
      `From: ${fromEmail || '[your email]'}`,
      `Topic: ${topic}`,
      '',
      message || '[describe what you need help with]',
      '',
      '—',
      'If relevant, include:',
      '- What you expected',
      '- What happened',
      '- Steps to reproduce',
      '- Screenshots/screen recording',
    ].join('\n'),
  });

  return (
    <MarketingPage
      eyebrow="CONTACT"
      title="Support"
      subtitle="Help, feedback, or a bug report — we’ll route it fast."
      actions={
        <a
          href={mailto}
          className="inline-flex h-9 items-center rounded-full border border-black/5 bg-gradient-to-br from-violet-500/12 to-blue-500/10 px-3 text-[13px] font-semibold text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:-translate-y-px hover:border-violet-500/25 hover:shadow-[0_10px_30px_rgba(124,58,237,0.18)]"
        >
          <Mail className="mr-2 h-4 w-4 text-slate-900/70" aria-hidden="true" />
          Email support
        </a>
      }
    >
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-geist-accents-1 ring-1 ring-black/5">
              <MessageSquare className="h-5 w-5 text-geist-accents-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-geist-foreground">Support</p>
              <p className="mt-1 text-[13px] leading-snug text-geist-accents-6">
                Bug reports, billing questions, and account help.
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-geist-accents-1 ring-1 ring-black/5">
              <Mail className="h-5 w-5 text-geist-accents-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-geist-foreground">Email</p>
              <p className="mt-1 text-[13px] leading-snug text-geist-accents-6">
                <span className="font-mono text-geist-foreground">{supportEmail}</span>
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-geist-accents-2 bg-geist-accents-1 px-3 py-1.5 text-[12px] font-medium text-geist-foreground transition hover:bg-white"
              >
                <Copy className="h-3.5 w-3.5 text-geist-accents-6" aria-hidden="true" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-geist-accents-1 ring-1 ring-black/5">
              <ShieldAlert className="h-5 w-5 text-geist-accents-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-geist-foreground">Security</p>
              <p className="mt-1 text-[13px] leading-snug text-geist-accents-6">
                Reporting a vulnerability? Choose “Security report”.
              </p>
              <Link to="/privacy-policy" className="mt-3 inline-block text-[13px] font-medium text-geist-foreground hover:underline">
                Privacy policy
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="border-gradient rounded-geist-lg">
          <form
            className="card p-6"
            onSubmit={(event) => {
              event.preventDefault();
              window.location.href = mailto;
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-geist-foreground">
                Send a message
              </h2>
              <span className="text-[11px] font-semibold tracking-[0.22em] text-geist-accents-5">
                FAST ROUTING
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold tracking-[0.22em] text-geist-accents-5">
                  TOPIC
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      { value: 'support', label: 'Support request' },
                      { value: 'feedback', label: 'Product feedback' },
                      { value: 'security', label: 'Security report' },
                    ] as const
                  ).map((option) => {
                    const isActive = option.value === topic;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTopic(option.value)}
                        className={[
                          'inline-flex h-9 items-center rounded-full px-3 text-[13px] font-medium transition',
                          isActive
                            ? 'bg-geist-foreground text-white'
                            : 'border border-geist-accents-2 bg-geist-accents-1 text-geist-foreground hover:bg-white',
                        ].join(' ')}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold tracking-[0.22em] text-geist-accents-5">
                  YOUR EMAIL <span className="font-medium text-geist-accents-4">(OPTIONAL)</span>
                </label>
                <input
                  className="input mt-2"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="you@company.com"
                  inputMode="email"
                  type="email"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold tracking-[0.22em] text-geist-accents-5">
                  MESSAGE
                </label>
                <textarea
                  className="textarea mt-2 min-h-[140px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What can we help with?"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] leading-relaxed text-geist-accents-6">
                Prefer self-serve? Start with <Link to="/docs" className="text-geist-foreground hover:underline font-medium">Docs</Link>.
              </p>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-geist-foreground px-4 text-[13px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)] active:translate-y-0"
              >
                Compose email
              </button>
            </div>
          </form>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-geist-foreground">What to include</h3>
          <ul className="mt-3 space-y-2 text-[13px] text-geist-accents-6">
            <li>• Your goal and expected output</li>
            <li>• What happened instead</li>
            <li>• Steps to reproduce</li>
            <li>• Screenshots / recording</li>
            <li>• Your browser + OS</li>
          </ul>

          <div className="mt-6 rounded-geist-lg border border-geist-accents-2 bg-geist-accents-1 p-4">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-geist-accents-5">
              RESPONSE TIME
            </p>
            <p className="mt-2 text-[13px] leading-snug text-geist-accents-6">
              This is a template page. Add your SLA or support hours here.
            </p>
          </div>
        </div>
      </div>
    </MarketingPage>
  );
}

