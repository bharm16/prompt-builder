const PARSER_DEBUG_FLAG = 'PARSER_DEBUG';

let cachedDebugState: boolean | null = null;

const coerceBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return null;
};

const readEnvFlag = (): boolean => {
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, unknown> }).env) {
    const env = (import.meta as unknown as { env: Record<string, unknown> }).env;
    const value =
      env[`VITE_${PARSER_DEBUG_FLAG}`] ??
      env[PARSER_DEBUG_FLAG] ??
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
    const windowValue = (window as unknown as Record<string, unknown>)[PARSER_DEBUG_FLAG];
    if (windowValue !== undefined) {
      const coerced = coerceBoolean(windowValue);
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

export const isParserDebugEnabled = (): boolean => {
  if (cachedDebugState === null) {
    cachedDebugState = readEnvFlag();
  }
  return cachedDebugState;
};

export const setParserDebugCache = (state: boolean): void => {
  cachedDebugState = state;
};

interface BaseEventPayload {
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

const baseEvent = (event: string, payload: Record<string, unknown> = {}): BaseEventPayload => ({
  event,
  timestamp: new Date().toISOString(),
  ...payload,
});

export const parserDebugLog = (event: string, payload: Record<string, unknown> = {}): void => {
  if (!isParserDebugEnabled()) return;
  const record = baseEvent(event, payload);
  if (typeof console !== 'undefined' && typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(`%c[PARSER_DEBUG] ${event}`, 'color: #2563eb; font-weight: 600;');
    
    console.groupEnd();
  } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    // Fallback for environments without groupCollapsed
  }
};

interface SpanLifecyclePayload {
  stage: string;
  span?: {
    source?: string;
    category?: string;
    start?: number;
    end?: number;
    text?: string;
    validatorPass?: boolean;
    droppedReason?: string | null;
  } | null;
  reason?: string | null;
  extra?: Record<string, unknown>;
}

export const logSpanLifecycle = ({ stage, span, reason = null, extra = {} }: SpanLifecyclePayload): void => {
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

interface PipelineMetricPayload {
  metric: string;
  value: unknown;
  context?: Record<string, unknown>;
}

export const logPipelineMetric = ({ metric, value, context = {} }: PipelineMetricPayload): void => {
  if (!isParserDebugEnabled()) return;
  parserDebugLog(`metric:${metric}`, { value, ...context });
};

