/**
 * Span Labeling Result Emitter Utilities
 *
 * Handles result emission with deduplication to prevent duplicate callbacks.
 */

import { sanitizeText, hashString } from '../utils/index.ts';
import type {
  LabeledSpan,
  SpanMeta,
  SpanLabelingResult,
} from '../hooks/types.ts';

export interface ResultEmitterParams {
  spans: LabeledSpan[];
  meta: SpanMeta | null;
  text: string;
  cacheId?: string | null;
  signature?: string;
}

/**
 * Create result emitter with deduplication
 */
export function createResultEmitter(
  onResult: ((result: SpanLabelingResult) => void) | undefined
): (params: ResultEmitterParams, source: SpanLabelingResult['source']) => void {
  let lastEmitKey: string | null = null;

  return (params: ResultEmitterParams, source: SpanLabelingResult['source']): void => {
    if (!onResult) return;
    if (!Array.isArray(params.spans) || !params.spans.length) return;

    const normalizedText = sanitizeText(params.text);
    const effectiveSignature = params.signature ?? hashString(normalizedText ?? '');
    const key = `${effectiveSignature}::${source}`;

    if (lastEmitKey === key) {
      return;
    }

    lastEmitKey = key;
    onResult({
      spans: params.spans,
      meta: params.meta ?? null,
      text: normalizedText,
      signature: effectiveSignature,
      cacheId: params.cacheId ?? null,
      source,
    });
  };
}

