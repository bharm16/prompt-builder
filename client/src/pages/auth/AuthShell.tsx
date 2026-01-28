import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Sparkles, Zap } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';

type AuthShellProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
          <Icon className="h-4 w-4 text-white/80" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white">{title}</p>
          <p className="mt-1 text-[13px] leading-snug text-white/60">{description}</p>
        </div>
      </div>
    </div>
  );
}

function AuthBackground(): React.ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(1200px 700px at 10% 0%, rgba(168,85,247,0.22), transparent 58%), radial-gradient(1000px 520px at 92% 12%, rgba(12,143,235,0.18), transparent 55%), radial-gradient(900px 520px at 50% 92%, rgba(255,56,92,0.16), transparent 55%), linear-gradient(180deg, #050508 0%, #070711 100%)',
        }}
      />

      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div
        className="absolute -top-48 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(255,56,92,0.35), transparent 55%), radial-gradient(circle at 70% 20%, rgba(168,85,247,0.35), transparent 55%), radial-gradient(circle at 50% 70%, rgba(12,143,235,0.30), transparent 60%)',
          animation: 'float 18s ease-in-out infinite',
        }}
      />

      <div
        className="absolute -bottom-56 left-[-120px] h-[520px] w-[520px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 40% 30%, rgba(12,143,235,0.35), transparent 58%), radial-gradient(circle at 70% 70%, rgba(168,85,247,0.28), transparent 60%)',
          animation: 'float 22s ease-in-out infinite',
          animationDelay: '-6s',
        }}
      />

      <div
        className="absolute -bottom-60 right-[-180px] h-[560px] w-[560px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 40% 40%, rgba(255,56,92,0.28), transparent 60%), radial-gradient(circle at 70% 20%, rgba(12,143,235,0.22), transparent 60%)',
          animation: 'float 26s ease-in-out infinite',
          animationDelay: '-12s',
        }}
      />
    </div>
  );
}

export function AuthShell({
  eyebrow = 'VIDRA • PROMPT BUILDER',
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps): React.ReactElement {
  return (
    <div className="min-h-full h-full overflow-y-auto bg-app text-foreground">
      <div className="relative isolate min-h-full">
        <AuthBackground />

        <div className="relative mx-auto flex min-h-full max-w-6xl flex-col px-6 py-10 sm:py-14">
          <header className="flex items-center justify-between gap-4">
            <Link
              to="/home"
              className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 transition hover:bg-white/[0.06]"
              aria-label="Go to Vidra home"
            >
              <span className="text-[13px] font-semibold tracking-tight">Vidra</span>
              <span className="h-4 w-px bg-white/10" aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-wide text-white/60">
                Company
              </span>
            </Link>

            <div className="flex items-center gap-3 text-[13px] text-white/70">
              <Link to="/pricing" className="hidden sm:inline hover:text-white">
                Pricing
              </Link>
              <Link to="/docs" className="hidden sm:inline hover:text-white">
                Docs
              </Link>
              <Link to="/contact" className="hidden sm:inline hover:text-white">
                Support
              </Link>
              <Link
                to="/"
                className={cn(
                  'group inline-flex items-center gap-2 rounded-full',
                  'border border-white/10 bg-white/[0.04] px-3 py-1.5',
                  'transition hover:bg-white/[0.06] hover:border-white/15 hover:text-white'
                )}
              >
                Open app
                <ArrowRight className="h-3.5 w-3.5 opacity-70 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
          </header>

          <main className="mt-12 grid flex-1 grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <section className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.24em] text-white/55">
                {eyebrow}
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
                {subtitle}
              </p>

              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Feature
                  icon={Zap}
                  title="Speed you can feel"
                  description="A motion-first workspace that keeps you in flow."
                />
                <Feature
                  icon={Sparkles}
                  title="Make prompts look expensive"
                  description="Bold structure, clearer intent, better outputs."
                />
                <Feature
                  icon={ShieldCheck}
                  title="Sync when you want"
                  description="Sign in to save history to the cloud — optional."
                />
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[13px] font-semibold text-white">Product demo energy</p>
                  <p className="mt-1 text-[13px] leading-snug text-white/60">
                    Gradient-heavy, editorial layout, macOS-calm. Marketing is the design.
                  </p>
                </div>
              </div>

              <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-white/50">
                    MINI DEMO
                  </p>
                  <p className="text-[11px] text-white/40">Arc-style storytelling</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-white/40">
                      BEFORE
                    </p>
                    <p className="mt-2 text-[13px] leading-snug text-white/70 ps-line-clamp-3">
                      “Write a prompt for a cinematic product shot.”
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-3">
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-white/50">
                      AFTER
                    </p>
                    <p className="mt-2 text-[13px] leading-snug text-white/80 ps-line-clamp-3">
                      “You are a director of photography. Generate a cinematic product shot with lighting, lens, mood, and composition…”
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <aside className="min-w-0">
              <div
                className={cn(
                  'relative rounded-[22px] p-[1px]',
                  'bg-gradient-to-b from-white/25 via-white/10 to-white/5',
                  'shadow-[0_28px_90px_rgba(0,0,0,0.65)]',
                  'animate-slide-in-from-bottom'
                )}
              >
                <div className="rounded-2xl border border-border bg-surface-1/70 p-6 backdrop-blur-xl">
                  {children}
                </div>
              </div>

              {footer ? (
                <div className="mt-5 text-center text-[13px] text-white/60">
                  {footer}
                </div>
              ) : null}
            </aside>
          </main>
        </div>
      </div>
    </div>
  );
}
