import { logSpanLifecycle } from '../../../utils/parserDebug.js';

const CONTEXT_WINDOW = 20;

const ensureNumber = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

let spanCounter = 0;

export const nextSpanId = () => {
  spanCounter += 1;
  return `span_${spanCounter}`;
};

export const resetSpanCounter = () => {
  spanCounter = 0;
};

export const createSpan = ({
  canonical,
  start,
  end,
  category,
  source,
  confidence = 1,
  metadata = {},
}) => {
  if (!canonical) {
    throw new Error('canonical text instance is required to create spans');
  }

  const normalizedStart = ensureNumber(start);
  const normalizedEnd = Math.max(normalizedStart, ensureNumber(end, normalizedStart));

  const startGrapheme = canonical.graphemeIndexForCodeUnit(normalizedStart);
  const endGrapheme = canonical.graphemeIndexForCodeUnit(normalizedEnd);

  const leftWindowStart = Math.max(0, startGrapheme - CONTEXT_WINDOW);
  const rightWindowEnd = Math.min(canonical.length, endGrapheme + CONTEXT_WINDOW);

  const quote = canonical.sliceGraphemes(startGrapheme, endGrapheme);
  const leftCtx = canonical.sliceGraphemes(leftWindowStart, startGrapheme);
  const rightCtx = canonical.sliceGraphemes(endGrapheme, rightWindowEnd);

  const fingerprint = `${quote}::${leftCtx}::${rightCtx}`;

  const span = {
    id: nextSpanId(),
    source,
    category,
    confidence,
    start: normalizedStart,
    end: normalizedEnd,
    startGrapheme,
    endGrapheme,
    text: quote,
    quote,
    leftCtx,
    rightCtx,
    idempotencyKey: fingerprint,
    validatorPass: null,
    droppedReason: null,
    metadata,
  };

  logSpanLifecycle({ stage: 'created', span });

  return span;
};

export const flagSpanDropped = (span, reason) => {
  if (!span) return span;
  span.droppedReason = reason;
  logSpanLifecycle({ stage: 'dropped', span, reason });
  return span;
};

export const markValidatorResult = (span, result, reason = null) => {
  if (!span) return span;
  span.validatorPass = result;
  if (!result && reason) {
    span.droppedReason = reason;
  }
  logSpanLifecycle({ stage: result ? 'validated' : 'invalid', span, extra: { reason } });
  return span;
};

export const cloneSpan = (span, overrides = {}) => ({
  ...span,
  ...overrides,
  metadata: {
    ...(span.metadata ?? {}),
    ...(overrides.metadata ?? {}),
  },
});

export const spansOverlap = (a, b) => {
  if (!a || !b) return false;
  return Math.max(a.start, b.start) < Math.min(a.end, b.end);
};

