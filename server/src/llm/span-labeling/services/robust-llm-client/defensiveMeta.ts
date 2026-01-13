import SpanLabelingConfig from '../../config/SpanLabelingConfig';
import type { ProcessingOptions } from '../../types';

export function injectDefensiveMeta(
  value: Record<string, unknown>,
  options: ProcessingOptions,
  nlpSpansAttempted?: number
): void {
  if (!value) return;

  if (typeof value.analysis_trace !== 'string') {
    value.analysis_trace = `Analyzed input text and identified ${Array.isArray(value.spans) ? value.spans.length : 0} potential spans for labeling.`;
  }

  if (!value.meta || typeof value.meta !== 'object') {
    value.meta = {
      version: options.templateVersion || 'v1',
      notes: `Labeled ${Array.isArray(value.spans) ? value.spans.length : 0} spans`,
    };
  } else {
    const meta = value.meta as Record<string, unknown>;
    if (!meta.version) {
      meta.version = options.templateVersion || 'v1';
    }
    if (typeof meta.notes !== 'string') {
      meta.notes = '';
    }
  }

  if (SpanLabelingConfig.NLP_FAST_PATH.TRACK_METRICS && nlpSpansAttempted !== undefined && nlpSpansAttempted > 0) {
    const meta = value.meta as Record<string, unknown>;
    meta.nlpAttempted = true;
    meta.nlpSpansFound = nlpSpansAttempted;
    meta.nlpBypassFailed = true;
  }
}
