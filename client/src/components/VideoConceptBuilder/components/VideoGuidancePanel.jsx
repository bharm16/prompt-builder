/**
 * Video Guidance Panel Component
 *
 * Displays examples and best practices for video prompt writing.
 */

import { Lightbulb, X, CheckCircle, Sparkles } from 'lucide-react';

export function VideoGuidancePanel({ showGuidance, onToggle }) {
  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/90 shadow-sm">
      <button
        onClick={onToggle}
        className="group flex w-full items-center justify-between gap-4 rounded-3xl px-5 py-4 text-left transition-all duration-300 hover:bg-neutral-50"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2 ring-1 ring-emerald-500/20 transition-all group-hover:ring-emerald-500/30">
            <Lightbulb className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-900">Video Prompt Writing Guide</div>
            <p className="text-xs text-neutral-500">
              Calibrate each element with examples inspired by top creative apps.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
          <span>{showGuidance ? 'Hide' : 'Show examples'}</span>
          <div className={`transition-transform duration-300 ${showGuidance ? 'rotate-180' : ''}`}>
            <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {showGuidance && (
        <div className="border-t border-neutral-100 px-6 py-6 animate-[slideDown_0.3s_ease-out]">
          <div className="space-y-5">
            {/* Subject Examples */}
            <div className="group/section">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-violet-500 to-violet-300" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900">Subject</h4>
              </div>
              <div className="space-y-2.5 pl-3.5">
                <div className="flex items-start gap-3 rounded-lg border border-red-100/50 bg-red-50/50 p-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100">
                      <X className="h-2.5 w-2.5 text-red-600" />
                    </div>
                  </div>
                  <span className="text-xs leading-relaxed text-neutral-700">"a person" or "a nice car"</span>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-emerald-100/50 bg-emerald-50/50 p-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                    </div>
                  </div>
                  <span className="text-xs leading-relaxed text-neutral-700">
                    "elderly street musician with weathered hands and silver harmonica"
                  </span>
                </div>
              </div>
            </div>

            {/* Action Examples */}
            <div className="group/section pt-1">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-blue-500 to-blue-300" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900">Action</h4>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                  ONE ONLY
                </span>
              </div>
              <div className="space-y-2.5 pl-3.5">
                <div className="flex items-start gap-3 rounded-lg border border-red-100/50 bg-red-50/50 p-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100">
                      <X className="h-2.5 w-2.5 text-red-600" />
                    </div>
                  </div>
                  <span className="text-xs leading-relaxed text-neutral-700">
                    "running, jumping, and spinning"{' '}
                    <span className="text-neutral-500">(multiple actions degrade quality)</span>
                  </span>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-emerald-100/50 bg-emerald-50/50 p-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                    </div>
                  </div>
                  <span className="text-xs leading-relaxed text-neutral-700">
                    "leaping over concrete barriers in slow motion"
                  </span>
                </div>
              </div>
            </div>

            {/* Style Examples */}
            <div className="group/section pt-1">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-amber-500 to-amber-300" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900">Style</h4>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                  USE TECHNICAL TERMS
                </span>
              </div>
              <div className="space-y-2.5 pl-3.5">
                <div className="flex items-start gap-3 rounded-lg border border-red-100/50 bg-red-50/50 p-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100">
                      <X className="h-2.5 w-2.5 text-red-600" />
                    </div>
                  </div>
                  <span className="text-xs leading-relaxed text-neutral-700">
                    "cinematic" or "artistic" or "moody"
                  </span>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-emerald-100/50 bg-emerald-50/50 p-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                    </div>
                  </div>
                  <span className="text-xs leading-relaxed text-neutral-700">
                    "shot on 35mm film with shallow depth of field" or "film noir aesthetic with Rembrandt lighting"
                  </span>
                </div>
              </div>
            </div>

            {/* Key Principle */}
            <div className="pt-2">
              <div className="relative overflow-hidden rounded-xl border border-neutral-200/60 bg-gradient-to-br from-neutral-50 via-white to-neutral-50/50">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent" />
                <div className="relative px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <div className="rounded-lg bg-blue-500/10 p-1.5 ring-1 ring-blue-500/20">
                        <Sparkles className="h-3.5 w-3.5 text-blue-700" />
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-700">
                      <span className="font-semibold text-neutral-900">Remember:</span> Describe only what the camera can SEE. Translate emotions into visible actions and environmental details.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
