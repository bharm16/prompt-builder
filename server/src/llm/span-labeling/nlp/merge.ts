import { NEURO_SYMBOLIC } from '@llm/span-labeling/config/SpanLabelingConfig';
import { getParentCategory } from '#shared/taxonomy.ts';
import type { NlpSpan } from './types';

export function mergeSpans(closedSpans: NlpSpan[], openSpans: NlpSpan[]): NlpSpan[] {
  return deduplicateSpans([...closedSpans, ...openSpans]);
}

export function deduplicateSpans(spans: NlpSpan[]): NlpSpan[] {
  if (spans.length === 0) return [];

  const seen = new Set<string>();
  const sorted = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end;
    return b.confidence - a.confidence;
  });

  const accepted: NlpSpan[] = [];
  for (const span of sorted) {
    const key = `${span.start}|${span.end}|${span.role}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const overlaps: Array<{ index: number; span: NlpSpan }> = [];
    const spanParent = getParentCategory(span.role) || span.role;

    for (let i = accepted.length - 1; i >= 0; i--) {
      const existing = accepted[i];
      if (!existing) continue;
      if (existing.end <= span.start) break;

      const existingParent = getParentCategory(existing.role) || existing.role;
      if (existingParent !== spanParent) {
        continue;
      }

      const overlap = span.start < existing.end && existing.start < span.end;
      if (overlap) {
        overlaps.push({ index: i, span: existing });
      }
    }

    if (overlaps.length === 0) {
      accepted.push(span);
      continue;
    }

    const preferClosed = NEURO_SYMBOLIC.MERGE.CLOSED_VOCAB_PRIORITY;
    const strategy = NEURO_SYMBOLIC.MERGE.OVERLAP_STRATEGY;

    const getSourcePriority = (source?: NlpSpan['source']): number => {
      if (!preferClosed) return 0;
      if (source === 'aho-corasick' || source === 'pattern') return 4;
      if (source === 'compromise') return 3;
      if (source === 'lighting') return 2;
      if (source === 'gliner') return 1;
      if (source === 'heuristic') return 0;
      return 0;
    };

    const getSpecificity = (role: string): number => role.split('.').length;

    const isPreferred = (candidate: NlpSpan, current: NlpSpan): boolean => {
      const candidateSource = getSourcePriority(candidate.source);
      const currentSource = getSourcePriority(current.source);
      if (candidateSource !== currentSource) {
        return candidateSource > currentSource;
      }

      const candidateSpecificity = getSpecificity(candidate.role);
      const currentSpecificity = getSpecificity(current.role);
      if (candidateSpecificity !== currentSpecificity) {
        return candidateSpecificity > currentSpecificity;
      }

      const candidateLength = candidate.end - candidate.start;
      const currentLength = current.end - current.start;

      if (strategy === 'longest-match') {
        if (candidateLength !== currentLength) return candidateLength > currentLength;
        if (candidate.confidence !== current.confidence) return candidate.confidence > current.confidence;
      } else {
        if (candidate.confidence !== current.confidence) return candidate.confidence > current.confidence;
        if (candidateLength !== currentLength) return candidateLength > currentLength;
      }

      return candidate.start <= current.start;
    };

    let winner = span;
    for (const overlap of overlaps) {
      if (!isPreferred(winner, overlap.span)) {
        winner = overlap.span;
      }
    }

    if (winner === span) {
      overlaps
        .sort((a, b) => b.index - a.index)
        .forEach(({ index }) => {
          accepted.splice(index, 1);
        });
      accepted.push(span);
    }
  }

  return accepted.sort((a, b) => a.start - b.start);
}
