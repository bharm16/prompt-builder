import type { Request, Response, NextFunction } from 'express';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const coerceJsonObject = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return isPlainObject(parsed) ? parsed : value;
  } catch {
    return value;
  }
};

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

export function normalizeOptimizationRequest(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const body = isPlainObject(req.body) ? req.body : {};

  const coercedContext = coerceJsonObject(body.context);
  body.context = isPlainObject(coercedContext) || coercedContext === null ? coercedContext : null;

  const coercedBrainstorm = coerceJsonObject(body.brainstormContext);
  body.brainstormContext =
    isPlainObject(coercedBrainstorm) || coercedBrainstorm === null ? coercedBrainstorm : null;

  if (isPlainObject(body.generationParams)) {
    const normalized: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(body.generationParams)) {
      if (isPrimitive(value)) {
        normalized[key] = value;
      }
    }
    body.generationParams = normalized;
  } else if (body.generationParams !== undefined) {
    delete body.generationParams;
  }

  if (Array.isArray(body.lockedSpans)) {
    body.lockedSpans = body.lockedSpans
      .filter((span) => isPlainObject(span))
      .map((span) => {
        const nextSpan: Record<string, unknown> = {};
        if (typeof span.id === 'string') nextSpan.id = span.id;
        if (typeof span.text === 'string') nextSpan.text = span.text;
        if (typeof span.leftCtx === 'string' || span.leftCtx === null) {
          nextSpan.leftCtx = span.leftCtx;
        }
        if (typeof span.rightCtx === 'string' || span.rightCtx === null) {
          nextSpan.rightCtx = span.rightCtx;
        }
        if (typeof span.category === 'string' || span.category === null) {
          nextSpan.category = span.category;
        }
        if (typeof span.source === 'string' || span.source === null) {
          nextSpan.source = span.source;
        }
        if (typeof span.confidence === 'number' && Number.isFinite(span.confidence)) {
          nextSpan.confidence = span.confidence;
        }
        return nextSpan;
      })
      .filter((span) => typeof span.text === 'string' && span.text.trim().length > 0);
  } else if (body.lockedSpans !== undefined) {
    delete body.lockedSpans;
  }

  req.body = body;
  next();
}
