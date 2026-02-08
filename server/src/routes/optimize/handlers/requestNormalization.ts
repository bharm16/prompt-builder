import type { PromptRequest } from '@config/schemas/promptSchemas';
import type { InferredContext, LockedSpan } from '@services/prompt-optimization/types';

const BACKGROUND_LEVELS: ReadonlySet<InferredContext['backgroundLevel']> = new Set([
  'beginner',
  'intermediate',
  'advanced',
]);

export function normalizeTargetModel(targetModel: PromptRequest['targetModel']): string | undefined {
  if (typeof targetModel !== 'string') return undefined;
  const normalized = targetModel.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeContext(context: PromptRequest['context']): InferredContext | null {
  if (!context) return null;
  const backgroundCandidate = context.backgroundLevel;
  const backgroundLevel = BACKGROUND_LEVELS.has(backgroundCandidate as InferredContext['backgroundLevel'])
    ? (backgroundCandidate as InferredContext['backgroundLevel'])
    : 'intermediate';
  return {
    specificAspects: typeof context.specificAspects === 'string' ? context.specificAspects : '',
    backgroundLevel,
    intendedUse: typeof context.intendedUse === 'string' ? context.intendedUse : '',
  };
}

export function normalizeLockedSpans(lockedSpans: PromptRequest['lockedSpans']): LockedSpan[] {
  if (!Array.isArray(lockedSpans)) return [];
  return lockedSpans.map((span) => ({
    text: span.text,
    ...(typeof span.id === 'string' ? { id: span.id } : {}),
    ...(span.leftCtx !== undefined ? { leftCtx: span.leftCtx } : {}),
    ...(span.rightCtx !== undefined ? { rightCtx: span.rightCtx } : {}),
    ...(span.category !== undefined ? { category: span.category } : {}),
    ...(span.source !== undefined ? { source: span.source } : {}),
    ...(span.confidence !== undefined ? { confidence: span.confidence } : {}),
  }));
}
