const PARSER_DEBUG_FLAG = 'PARSER_DEBUG';

let cachedDebugState = null;

const coerceBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return null;
};

const readEnvFlag = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const value =
      import.meta.env[`VITE_${PARSER_DEBUG_FLAG}`] ??
      import.meta.env[PARSER_DEBUG_FLAG] ??
      null;
    const coerced = coerceBoolean(value);
    if (coerced !== null) return coerced;
  }

  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[PARSER_DEBUG_FLAG] ?? null;
    const coerced = coerceBoolean(value);
    if (coerced !== null) return coerced;
  }

  if (typeof window !== 'undefined') {
    if (window[PARSER_DEBUG_FLAG] !== undefined) {
      const coerced = coerceBoolean(window[PARSER_DEBUG_FLAG]);
      if (coerced !== null) return coerced;
    }

    try {
      const value = window.localStorage?.getItem(PARSER_DEBUG_FLAG);
      const coerced = coerceBoolean(value);
      if (coerced !== null) return coerced;
    } catch (error) {
      console.warn('[PARSER_DEBUG] Unable to read localStorage flag:', error);
    }
  }

  return false;
};

export const isParserDebugEnabled = () => {
  if (cachedDebugState === null) {
    cachedDebugState = readEnvFlag();
  }
  return cachedDebugState;
};

export const setParserDebugCache = (state) => {
  cachedDebugState = state;
};

const baseEvent = (event, payload) => ({
  event,
  timestamp: new Date().toISOString(),
  ...payload,
});

export const parserDebugLog = (event, payload = {}) => {
  if (!isParserDebugEnabled()) return;
  const record = baseEvent(event, payload);
  if (typeof console !== 'undefined' && console.groupCollapsed) {
    console.groupCollapsed(`%c[PARSER_DEBUG] ${event}`, 'color: #2563eb; font-weight: 600;');
    console.log(record);
    console.groupEnd();
  } else if (typeof console !== 'undefined' && console.debug) {
    console.debug('[PARSER_DEBUG]', record);
  }
};

export const logSpanLifecycle = ({ stage, span, reason = null, extra = {} }) => {
  if (!isParserDebugEnabled()) return;
  parserDebugLog(`span:${stage}`, {
    source: span?.source,
    category: span?.category,
    start: span?.start,
    end: span?.end,
    text: span?.text,
    validatorPass: span?.validatorPass ?? null,
    droppedReason: reason ?? span?.droppedReason ?? null,
    ...extra,
  });
};

export const logPipelineMetric = ({ metric, value, context = {} }) => {
  if (!isParserDebugEnabled()) return;
  parserDebugLog(`metric:${metric}`, { value, ...context });
};

