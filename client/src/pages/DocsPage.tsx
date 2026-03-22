import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Layers,
  Zap,
  Eye,
  Video,
  Palette,
  Brain,
  SlidersHorizontal,
} from '@promptstudio/system/components/ui';
import { AUTH_COLORS } from './auth/auth-styles';

const CARD: React.CSSProperties = {
  background: AUTH_COLORS.card,
  border: `1px solid ${AUTH_COLORS.cardBorder}`,
  borderRadius: '10px',
};

const INSET: React.CSSProperties = {
  background: AUTH_COLORS.inputBg,
  border: `1px solid ${AUTH_COLORS.inputBorder}`,
  borderRadius: '8px',
};

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd
      className="rounded px-1.5 py-0.5 font-mono text-[11px]"
      style={{ background: AUTH_COLORS.inputBg, border: `1px solid ${AUTH_COLORS.inputBorder}`, color: AUTH_COLORS.textSecondary }}
    >
      {children}
    </kbd>
  );
}

interface FeatureRowProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function FeatureRow({ icon, title, children }: FeatureRowProps): React.ReactElement {
  return (
    <div className="flex items-start gap-3 px-3.5 py-3">
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={INSET}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-white">{title}</h3>
        <div className="mt-1 space-y-1.5 text-[12px] leading-relaxed" style={{ color: AUTH_COLORS.textSecondary }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function DocsPage(): React.ReactElement {
  return (
    <div className="h-full overflow-y-auto" style={{ background: AUTH_COLORS.bg }}>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 px-4 py-3 sm:px-6"
        style={{ background: AUTH_COLORS.bg, borderBottom: `1px solid ${AUTH_COLORS.divider}` }}
      >
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.2em]" style={{ color: AUTH_COLORS.textLabel }}>
              DOCS
            </p>
            <h1 className="text-[15px] font-semibold text-white tracking-tight">How Vidra works</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/contact"
              className="inline-flex h-7 items-center rounded-lg px-3 text-[12px] font-semibold transition"
              style={{ background: AUTH_COLORS.card, border: `1px solid ${AUTH_COLORS.cardBorder}`, color: AUTH_COLORS.text }}
            >
              Get help
            </Link>
            <Link
              to="/"
              className="text-[12px] font-medium hover:text-white transition-colors"
              style={{ color: AUTH_COLORS.textDim }}
            >
              Back to app
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-16">
        <p className="pt-5 pb-1 text-[13px] leading-relaxed" style={{ color: AUTH_COLORS.textSecondary }}>
          Interactive editing canvas for AI video prompts. Write once, optimize for any model, preview before you render.
        </p>

        {/* Getting started */}
        <section className="mt-5">
          <div className="p-4" style={CARD}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-[13px] font-semibold text-white">Getting started</h2>
              <span className="text-[10px] font-semibold tracking-[0.2em]" style={{ color: AUTH_COLORS.textLabel }}>QUICKSTART</span>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: AUTH_COLORS.textSecondary }}>
              Open the{' '}
              <Link to="/" className="font-medium hover:underline" style={{ color: AUTH_COLORS.accent }}>
                workspace
              </Link>
              . Type or paste a prompt, choose a target model, and hit <Kbd>Optimize</Kbd>. Vidra rewrites your prompt
              for the selected model in seconds.
            </p>
          </div>
        </section>

        {/* Workflow steps */}
        <section className="mt-4">
          <div className="p-4" style={CARD}>
            <h2 className="text-[13px] font-semibold text-white mb-3">Typical workflow</h2>
            <div className="overflow-hidden rounded-lg" style={{ border: `1px solid ${AUTH_COLORS.inputBorder}` }}>
              {[
                { label: 'Write or paste', desc: 'a rough prompt describing your video idea.' },
                { label: 'Optimize', desc: '— Vidra rewrites and enriches the prompt. Review the color-coded spans.' },
                { label: 'Refine', desc: '— click any span for alternative suggestions. Swap, edit, or lock phrases.' },
                { label: 'Preview', desc: '— generate a quick image to validate composition.' },
                { label: 'Generate', desc: '— render the final video. Results save to session history.' },
              ].map((step, i) => (
                <div
                  key={step.label}
                  className="flex items-start gap-3 px-3.5 py-2.5"
                  style={{
                    background: AUTH_COLORS.inputBg,
                    ...(i > 0 ? { borderTop: `1px solid ${AUTH_COLORS.inputBorder}` } : {}),
                  }}
                >
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: AUTH_COLORS.accent, color: AUTH_COLORS.bg }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[12px] leading-relaxed" style={{ color: AUTH_COLORS.textSecondary }}>
                    <strong className="text-white">{step.label}</strong> {step.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core features — stacked rows in a single card */}
        <section className="mt-4">
          <div className="overflow-hidden" style={CARD}>
            <div className="px-4 pt-3.5 pb-2">
              <h2 className="text-[13px] font-semibold text-white">Core features</h2>
            </div>
            <div className="divide-y" style={{ borderColor: AUTH_COLORS.cardBorder }}>
              <FeatureRow
                icon={<Sparkles className="h-3.5 w-3.5" style={{ color: AUTH_COLORS.textDim }} aria-hidden="true" />}
                title="Prompt Optimization"
              >
                <p>
                  Two-stage pipeline: a fast model drafts in ~300ms, then a stronger model refines in the background.
                  Modes: <strong className="text-white">enhance</strong>, <strong className="text-white">expand</strong>, <strong className="text-white">brainstorm</strong>.
                </p>
              </FeatureRow>
              <FeatureRow
                icon={<Layers className="h-3.5 w-3.5" style={{ color: AUTH_COLORS.textDim }} aria-hidden="true" />}
                title="Span Labeling"
              >
                <p>
                  Prompts are analyzed into semantic categories (subject, camera, lighting, etc.) and color-highlighted.
                  Click any span for AI-generated alternative suggestions.
                </p>
              </FeatureRow>
              <FeatureRow
                icon={<Eye className="h-3.5 w-3.5" style={{ color: AUTH_COLORS.textDim }} aria-hidden="true" />}
                title="Preview Generation"
              >
                <p>
                  Quick image preview (Flux Schnell) before committing to a full video render.
                  Then render with Sora, Veo, Kling, Luma, Runway, and more.
                </p>
              </FeatureRow>
              <FeatureRow
                icon={<Brain className="h-3.5 w-3.5" style={{ color: AUTH_COLORS.textDim }} aria-hidden="true" />}
                title="Model Intelligence"
              >
                <p>
                  Analyzes your prompt and recommends the best video model based on content, style, and complexity.
                  Includes confidence score and explanation.
                </p>
              </FeatureRow>
            </div>
          </div>
        </section>

        {/* Advanced features */}
        <section className="mt-4">
          <div className="overflow-hidden" style={CARD}>
            <div className="px-4 pt-3.5 pb-2">
              <h2 className="text-[13px] font-semibold text-white">Advanced features</h2>
            </div>
            <div className="divide-y" style={{ borderColor: AUTH_COLORS.cardBorder }}>
              <FeatureRow
                icon={<Video className="h-3.5 w-3.5" style={{ color: AUTH_COLORS.textDim }} aria-hidden="true" />}
                title="Continuity (Multi-Shot)"
              >
                <p>
                  Multi-shot sequences with visual consistency. Strategies: <strong className="text-white">frame-bridge</strong> (last frame as anchor),{' '}
                  <strong className="text-white">style-match</strong> (transfer color/lighting), <strong className="text-white">native</strong> (model built-in).
                </p>
              </FeatureRow>
              <FeatureRow
                icon={<Palette className="h-3.5 w-3.5" style={{ color: AUTH_COLORS.textDim }} aria-hidden="true" />}
                title="Video Concept Wizard"
              >
                <p>
                  Guided flow: subject, action, location, camera angle, lighting, style. Curated suggestions at each step
                  for a coherent, well-structured prompt.
                </p>
              </FeatureRow>
              <FeatureRow
                icon={<Zap className="h-3.5 w-3.5" style={{ color: AUTH_COLORS.textDim }} aria-hidden="true" />}
                title="Model Compilation"
              >
                <p>
                  Compiles your prompt for a specific target model — adjusting terminology, structure,
                  and emphasis to match model conventions.
                </p>
              </FeatureRow>
              <FeatureRow
                icon={<SlidersHorizontal className="h-3.5 w-3.5" style={{ color: AUTH_COLORS.textDim }} aria-hidden="true" />}
                title="Keyboard Shortcuts"
              >
                <p>
                  <Kbd>Cmd+Enter</Kbd> optimize · <Kbd>Cmd+Shift+P</Kbd> preview · <Kbd>Escape</Kbd> dismiss panels
                </p>
              </FeatureRow>
            </div>
          </div>
        </section>

        {/* Help */}
        <section className="mt-4">
          <div className="p-4 flex items-center justify-between gap-3" style={CARD}>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">Need help?</p>
              <p className="mt-0.5 text-[12px]" style={{ color: AUTH_COLORS.textSecondary }}>
                Questions, bug reports, or feature requests.
              </p>
            </div>
            <Link
              to="/contact"
              className="inline-flex h-8 items-center rounded-lg px-3.5 text-[12px] font-semibold transition shrink-0"
              style={{ background: AUTH_COLORS.accent, color: AUTH_COLORS.bg }}
            >
              Contact support
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer
          className="mt-8 py-6 text-[12px]"
          style={{ borderTop: `1px solid ${AUTH_COLORS.cardBorder}`, color: AUTH_COLORS.textDim }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="font-medium text-white hover:underline">Go to app</Link>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link to="/pricing" className="hover:text-white" style={{ color: AUTH_COLORS.textDim }}>Pricing</Link>
              <Link to="/privacy-policy" className="hover:text-white" style={{ color: AUTH_COLORS.textDim }}>Privacy</Link>
              <Link to="/terms-of-service" className="hover:text-white" style={{ color: AUTH_COLORS.textDim }}>Terms</Link>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
