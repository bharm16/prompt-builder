import type { LLMSpan } from '@llm/span-labeling/types';

export function evaluateStructuralCompleteness(spans: LLMSpan[]): number {
  const parents = new Set((spans || []).map((s) => (s.role || '').split('.')[0]));
  const hasSubject = parents.has('subject');
  const hasAction = parents.has('action');
  const hasEnvironment = parents.has('environment');
  const hasCameraOrLighting =
    parents.has('camera') || parents.has('lighting') || parents.has('shot');

  const present = [hasSubject, hasAction, hasEnvironment, hasCameraOrLighting].filter(Boolean).length;
  return present / 4;
}
