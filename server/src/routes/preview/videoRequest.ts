import type { Response } from 'express';

export type VideoAspectRatio = '16:9' | '9:16' | '21:9' | '1:1';

export interface VideoPreviewPayload {
  prompt: string;
  aspectRatio?: VideoAspectRatio;
  model?: string;
  startImage?: string;
  inputReference?: string;
  generationParams?: unknown;
}

interface VideoPreviewParseSuccess {
  ok: true;
  payload: VideoPreviewPayload;
}

interface VideoPreviewParseFailure {
  ok: false;
  status: number;
  error: string;
}

export type VideoPreviewParseResult = VideoPreviewParseSuccess | VideoPreviewParseFailure;

export const parseVideoPreviewRequest = (body: unknown): VideoPreviewParseResult => {
  const { prompt, aspectRatio, model, startImage, inputReference, generationParams } = (body || {}) as {
    prompt?: unknown;
    aspectRatio?: VideoAspectRatio;
    model?: string;
    startImage?: unknown;
    inputReference?: unknown;
    generationParams?: unknown;
  };

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return { ok: false, status: 400, error: 'Prompt must be a non-empty string' };
  }

  if (startImage !== undefined && typeof startImage !== 'string') {
    return { ok: false, status: 400, error: 'startImage must be a string URL' };
  }

  if (inputReference !== undefined && typeof inputReference !== 'string') {
    return { ok: false, status: 400, error: 'inputReference must be a string URL' };
  }

  return {
    ok: true,
    payload: {
      prompt,
      aspectRatio,
      model,
      ...(startImage ? { startImage } : {}),
      ...(inputReference ? { inputReference } : {}),
      ...(generationParams !== undefined ? { generationParams } : {}),
    },
  };
};

export const sendVideoContent = (
  res: Response,
  entry: { contentType: string; buffer: Buffer }
): Response => {
  res.setHeader('Content-Type', entry.contentType);
  res.setHeader('Cache-Control', 'private, max-age=600');
  return res.send(entry.buffer);
};
