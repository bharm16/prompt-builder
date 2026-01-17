import React from 'react';
import { Link } from 'react-router-dom';
import { Copy, Mail, MessageSquare, ShieldAlert } from 'lucide-react';
import { MarketingPage } from './MarketingPage';
import { Button } from '@promptstudio/system/components/ui/button';
import { Card } from '@promptstudio/system/components/ui/card';
import { Input } from '@promptstudio/system/components/ui/input';
import { Textarea } from '@promptstudio/system/components/ui/textarea';

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
        <Button
          asChild
          variant="ghost"
          className="h-9 rounded-full border border-black/5 bg-gradient-to-br from-violet-500/12 to-blue-500/10 px-3 text-[13px] font-semibold text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:-translate-y-px hover:border-violet-500/25 hover:shadow-[0_10px_30px_rgba(124,58,237,0.18)]"
        >
          <a href={mailto}>
            <Mail className="mr-2 h-4 w-4 text-slate-900/70" aria-hidden="true" />
            Email support
          </a>
        </Button>
      }
    >
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-1 ring-1 ring-black/5">
              <MessageSquare className="h-5 w-5 text-muted" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Support</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">
                Bug reports, billing questions, and account help.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-1 ring-1 ring-black/5">
              <Mail className="h-5 w-5 text-muted" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Email</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">
                <span className="font-mono text-foreground">{supportEmail}</span>
              </p>
              <Button
                type="button"
                onClick={handleCopy}
                variant="ghost"
                className="mt-3 h-8 gap-2 rounded-full border border-border bg-surface-1 px-3 text-[12px] font-medium text-foreground transition hover:bg-white"
              >
                <Copy className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-1 ring-1 ring-black/5">
              <ShieldAlert className="h-5 w-5 text-muted" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Security</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">
                Reporting a vulnerability? Choose “Security report”.
              </p>
              <Button
                asChild
                variant="link"
                className="mt-3 h-auto p-0 text-[13px] font-medium text-foreground hover:underline"
              >
                <Link to="/privacy-policy">Privacy policy</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="ps-border-gradient rounded-lg">
          <Card className="p-6">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                window.location.href = mailto;
              }}
            >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Send a message
              </h2>
              <span className="text-[11px] font-semibold tracking-[0.22em] text-muted">
                FAST ROUTING
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold tracking-[0.22em] text-muted">
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
                      <Button
                        key={option.value}
                        type="button"
                        onClick={() => setTopic(option.value)}
                        variant="ghost"
                        className={[
                          'h-9 rounded-full px-3 text-[13px] font-medium transition',
                          isActive
                            ? 'bg-foreground text-white'
                            : 'border border-border bg-surface-1 text-foreground hover:bg-white',
                        ].join(' ')}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold tracking-[0.22em] text-muted">
                  YOUR EMAIL <span className="font-medium text-faint">(OPTIONAL)</span>
                </label>
                <Input
                  className="mt-2"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="you@company.com"
                  inputMode="email"
                  type="email"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold tracking-[0.22em] text-muted">
                  MESSAGE
                </label>
                <Textarea
                  className="mt-2 min-h-[140px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What can we help with?"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] leading-relaxed text-muted">
                Prefer self-serve? Start with{' '}
                <Button asChild variant="link" className="h-auto p-0 font-medium text-foreground hover:underline">
                  <Link to="/docs">Docs</Link>
                </Button>
                .
              </p>
              <Button
                type="submit"
                variant="ghost"
                className="h-10 rounded-full bg-foreground px-4 text-[13px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)] active:translate-y-0"
              >
                Compose email
              </Button>
            </div>
            </form>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground">What to include</h3>
          <ul className="mt-3 space-y-2 text-[13px] text-muted">
            <li>• Your goal and expected output</li>
            <li>• What happened instead</li>
            <li>• Steps to reproduce</li>
            <li>• Screenshots / recording</li>
            <li>• Your browser + OS</li>
          </ul>

          <div className="mt-6 rounded-lg border border-border bg-surface-1 p-4">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-muted">
              RESPONSE TIME
            </p>
            <p className="mt-2 text-[13px] leading-snug text-muted">
              This is a template page. Add your SLA or support hours here.
            </p>
          </div>
        </Card>
      </div>
    </MarketingPage>
  );
}
