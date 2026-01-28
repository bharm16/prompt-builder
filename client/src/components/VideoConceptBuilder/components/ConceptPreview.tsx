/**
 * Concept Preview Component
 *
 * Displays a live preview of the composed concept.
 */

import { Lightbulb } from '@promptstudio/system/components/ui';

interface ConceptPreviewProps {
  text: string;
}

export function ConceptPreview({ text }: ConceptPreviewProps): React.ReactElement | null {
  if (!text) return null;

  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/90 px-5 py-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Lightbulb className="h-5 w-5 flex-shrink-0 text-emerald-500" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Live concept preview
          </div>
          <p className="mt-2 text-sm text-neutral-700 leading-relaxed">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

