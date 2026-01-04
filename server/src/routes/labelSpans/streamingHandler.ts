import type { Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { labelSpansStream } from '@llm/span-labeling/SpanLabelingService';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { LabelSpansParams } from '@llm/span-labeling/types';
import { toPublicSpan } from './transform';

interface StreamHandlerInput {
  res: Response;
  payload: LabelSpansParams;
  aiService: AIModelService;
  requestId?: string;
  userId?: string;
}

export async function handleLabelSpansStreamRequest({
  res,
  payload,
  aiService,
  requestId,
  userId,
}: StreamHandlerInput): Promise<void> {
  const operation = 'labelSpansStream';

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = labelSpansStream(payload, aiService);
    for await (const span of stream) {
      res.write(JSON.stringify(toPublicSpan(span)) + '\n');
    }
    res.end();
  } catch (error) {
    logger.error(`${operation} failed`, error as Error, {
      operation,
      requestId,
      userId,
    });
    if (!res.headersSent) {
      res.status(502).json({ error: 'Streaming failed' });
      return;
    }
    res.write(JSON.stringify({ error: 'Streaming failed' }) + '\n');
    res.end();
  }
}
