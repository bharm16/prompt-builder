import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingPage } from './MarketingPage';
import { Card } from '@promptstudio/system/components/ui/card';
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

interface DocSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function DocSection({ icon, title, children }: DocSectionProps): React.ReactElement {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-1 ring-1 ring-black/5">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted">
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DocsPage(): React.ReactElement {
  return (
    <MarketingPage
      eyebrow="DOCUMENTATION"
      title="How Vidra works"
      subtitle="Vidra is an interactive editing canvas for AI video prompts. Write once, optimize for any model, and preview before you render."
    >
      <div className="mt-8 space-y-10">
        {/* Getting Started */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Getting started
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
            Open the{' '}
            <Link to="/" className="font-medium text-foreground hover:underline">
              workspace
            </Link>{' '}
            to begin. Type or paste a prompt, choose a target model, and hit{' '}
            <kbd className="rounded border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[12px]">
              Optimize
            </kbd>
            . Vidra rewrites your prompt for the selected model in seconds.
          </p>
        </section>

        {/* Core Features */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Core features
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <DocSection
              icon={<Sparkles className="h-5 w-5 text-muted" aria-hidden="true" />}
              title="Prompt Optimization"
            >
              <p>
                Two-stage pipeline for fast, high-quality results. A fast model drafts an
                improved prompt in ~300ms, then a stronger model refines it in the background.
                You see the draft immediately and the refinement streams in progressively.
              </p>
              <p>
                Supports multiple modes: <strong>enhance</strong> (improve detail and structure),{' '}
                <strong>expand</strong> (add cinematic detail), and{' '}
                <strong>brainstorm</strong> (generate creative variations from a concept).
              </p>
            </DocSection>

            <DocSection
              icon={<Layers className="h-5 w-5 text-muted" aria-hidden="true" />}
              title="Span Labeling"
            >
              <p>
                Every prompt is analyzed into semantic categories: subject, action, camera,
                lighting, color, mood, style, environment, and more. Each span is
                color-highlighted in the canvas so you can see the structure at a glance.
              </p>
              <p>
                Click any highlighted span to get AI-generated alternative suggestions
                (enhancement). Accept a suggestion to swap it in, or edit freely.
              </p>
            </DocSection>

            <DocSection
              icon={<Eye className="h-5 w-5 text-muted" aria-hidden="true" />}
              title="Preview Generation"
            >
              <p>
                Generate a quick image preview (Flux Schnell) before committing to a full
                video render. Previews take a few seconds and give you visual feedback on
                composition, color, and framing.
              </p>
              <p>
                When you&apos;re satisfied, render the final video with your choice of model
                (Sora, Veo, Kling, Luma, Runway, and more).
              </p>
            </DocSection>

            <DocSection
              icon={<Brain className="h-5 w-5 text-muted" aria-hidden="true" />}
              title="Model Intelligence"
            >
              <p>
                Not sure which video model to use? Model Intelligence analyzes your prompt
                and recommends the best model based on the content, style, and complexity
                of your description.
              </p>
              <p>
                Each recommendation includes a confidence score and an explanation of why
                the model was chosen.
              </p>
            </DocSection>
          </div>
        </section>

        {/* Advanced Features */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Advanced features
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <DocSection
              icon={<Video className="h-5 w-5 text-muted" aria-hidden="true" />}
              title="Continuity (Multi-Shot)"
            >
              <p>
                Build multi-shot sequences with visual consistency between shots.
                Continuity mode extracts style references and frame bridges from previous
                shots to maintain color palette, lighting, and character identity.
              </p>
              <p>
                Three continuity strategies:{' '}
                <strong>frame-bridge</strong> (extract the last frame as a visual anchor),{' '}
                <strong>style-match</strong> (transfer color and lighting characteristics),{' '}
                and <strong>native</strong> (use the model&apos;s built-in continuity features).
              </p>
            </DocSection>

            <DocSection
              icon={<Palette className="h-5 w-5 text-muted" aria-hidden="true" />}
              title="Video Concept Wizard"
            >
              <p>
                Not sure how to start? The guided wizard walks you through building a prompt
                step by step: subject, action, location, camera angle, lighting, and style.
              </p>
              <p>
                Each step offers curated suggestions based on your previous choices, so
                you always get a coherent, well-structured prompt.
              </p>
            </DocSection>

            <DocSection
              icon={<Zap className="h-5 w-5 text-muted" aria-hidden="true" />}
              title="Model Compilation"
            >
              <p>
                Each video model has different prompt conventions. After optimization,
                Vidra can compile your prompt for a specific target model — adjusting
                terminology, structure, and emphasis to match what the model expects.
              </p>
            </DocSection>

            <DocSection
              icon={<SlidersHorizontal className="h-5 w-5 text-muted" aria-hidden="true" />}
              title="Keyboard Shortcuts"
            >
              <p>
                The canvas supports keyboard-driven workflows.{' '}
                Press <kbd className="rounded border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[12px]">Cmd+Enter</kbd>{' '}
                to optimize,{' '}
                <kbd className="rounded border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[12px]">Cmd+Shift+P</kbd>{' '}
                to generate a preview, and{' '}
                <kbd className="rounded border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[12px]">Escape</kbd>{' '}
                to dismiss suggestion panels.
              </p>
            </DocSection>
          </div>
        </section>

        {/* Workflow */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Typical workflow
          </h2>
          <Card className="mt-4 p-6">
            <ol className="space-y-3 text-[14px] leading-relaxed text-muted">
              <li className="flex gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-bold text-white">
                  1
                </span>
                <span>
                  <strong className="text-foreground">Write or paste</strong> a rough prompt
                  describing your video idea.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-bold text-white">
                  2
                </span>
                <span>
                  <strong className="text-foreground">Optimize</strong> — Vidra rewrites and
                  enriches the prompt. Review the color-coded spans to see what was added.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-bold text-white">
                  3
                </span>
                <span>
                  <strong className="text-foreground">Refine</strong> — click any span to get
                  alternative suggestions. Swap, edit, or lock specific phrases.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-bold text-white">
                  4
                </span>
                <span>
                  <strong className="text-foreground">Preview</strong> — generate a quick image
                  to validate composition before committing to a video render.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-bold text-white">
                  5
                </span>
                <span>
                  <strong className="text-foreground">Generate</strong> — render the final video
                  with your chosen model. Results are saved to your session history.
                </span>
              </li>
            </ol>
          </Card>
        </section>

        {/* Help */}
        <section className="pb-4">
          <Card className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Need help?</h3>
                <p className="mt-1 text-[13px] text-muted">
                  Questions, bug reports, or feature requests — we&apos;re here to help.
                </p>
              </div>
              <Link
                to="/contact"
                className="inline-flex h-9 items-center justify-center rounded-full bg-foreground px-4 text-[13px] font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_10px_30px_rgba(0,0,0,0.15)] active:translate-y-0"
              >
                Contact support
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </MarketingPage>
  );
}
