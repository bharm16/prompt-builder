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
  let clientClosed = false;

  res.on('close', () => {
    clientClosed = true;
  });

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const stream = labelSpansStream(payload, aiService);
    for await (const span of stream) {
      if (clientClosed || res.writableEnded || res.destroyed) {
        break;
      }
      res.write(JSON.stringify(toPublicSpan(span)) + '\n');
    }
    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  } catch (error) {
    logger.error('Operation failed.', error as Error, {
      operation,
      requestId,
      userId,
    });
    if (clientClosed || res.writableEnded || res.destroyed) {
      return;
    }
    if (!res.headersSent) {
      res.status(502).json({ error: 'Streaming failed' });
      return;
    }
    try {
      res.write(JSON.stringify({ error: 'Streaming failed' }) + '\n');
    } finally {
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    }
  }
}
