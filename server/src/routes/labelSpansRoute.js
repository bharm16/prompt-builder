import { Router } from 'express';
import { logger } from '../infrastructure/Logger.js';
import { labelSpans } from '../llm/spanLabeler.js';

export const labelSpansRoute = Router();

const sanitizeNumber = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

labelSpansRoute.post('/', async (req, res) => {
  const { text, maxSpans, minConfidence, policy, templateVersion } = req.body || {};

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const safeMaxSpans = sanitizeNumber(maxSpans);
  if (safeMaxSpans !== undefined && (!Number.isInteger(safeMaxSpans) || safeMaxSpans <= 0 || safeMaxSpans > 50)) {
    return res.status(400).json({ error: 'maxSpans must be an integer between 1 and 50' });
  }

  const safeMinConfidence = sanitizeNumber(minConfidence);
  if (
    safeMinConfidence !== undefined &&
    (typeof safeMinConfidence !== 'number' ||
      Number.isNaN(safeMinConfidence) ||
      safeMinConfidence < 0 ||
      safeMinConfidence > 1)
  ) {
    return res.status(400).json({ error: 'minConfidence must be between 0 and 1' });
  }

  const payload = {
    text,
    maxSpans: safeMaxSpans,
    minConfidence: safeMinConfidence,
    policy,
    templateVersion,
  };

  try {
    const result = await labelSpans(payload);
    return res.json(result);
  } catch (error) {
    logger.warn('label-spans request failed', {
      error: error?.message,
    });
    return res.status(502).json({
      error: 'LLM span labeling failed',
      message: error?.message || 'Unknown error',
    });
  }
});

