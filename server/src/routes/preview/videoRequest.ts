import type { Response } from 'express';

export type VideoAspectRatio = '16:9' | '9:16' | '21:9' | '1:1';

export interface VideoPreviewPayload {
  prompt: string;
  aspectRatio?: VideoAspectRatio;
  model?: string;
  startImage?: string;
  inputReference?: string;
  generationParams?: unknown;
  characterAssetId?: string;
  autoKeyframe?: boolean;
  faceSwapAlreadyApplied?: boolean;
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
  const {
    prompt,
    aspectRatio,
    model,
    startImage,
    inputReference,
    generationParams,
    characterAssetId,
    autoKeyframe,
    faceSwapAlreadyApplied,
  } = (body || {}) as {
    prompt?: unknown;
    aspectRatio?: VideoAspectRatio;
    model?: string;
    startImage?: unknown;
    inputReference?: unknown;
    generationParams?: unknown;
    characterAssetId?: unknown;
    autoKeyframe?: unknown;
    faceSwapAlreadyApplied?: unknown;
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

  if (characterAssetId !== undefined && typeof characterAssetId !== 'string') {
    return { ok: false, status: 400, error: 'characterAssetId must be a string' };
  }

  if (autoKeyframe !== undefined && typeof autoKeyframe !== 'boolean') {
    return { ok: false, status: 400, error: 'autoKeyframe must be a boolean' };
  }

  if (faceSwapAlreadyApplied !== undefined && typeof faceSwapAlreadyApplied !== 'boolean') {
    return { ok: false, status: 400, error: 'faceSwapAlreadyApplied must be a boolean' };
  }

  const resolvedCharacterAssetId =
    typeof characterAssetId === 'string' && characterAssetId.trim().length > 0
      ? characterAssetId.trim()
      : undefined;
  const resolvedAutoKeyframe = autoKeyframe !== false;
  const resolvedFaceSwapAlreadyApplied = faceSwapAlreadyApplied === true;

  return {
    ok: true,
    payload: {
      prompt,
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(model ? { model } : {}),
      ...(startImage ? { startImage } : {}),
      ...(inputReference ? { inputReference } : {}),
      ...(generationParams !== undefined ? { generationParams } : {}),
      ...(resolvedCharacterAssetId ? { characterAssetId: resolvedCharacterAssetId } : {}),
      autoKeyframe: resolvedAutoKeyframe,
      ...(resolvedFaceSwapAlreadyApplied ? { faceSwapAlreadyApplied: true } : {}),
    },
  };
};

export const sendVideoContent = (
  res: Response,
  entry: { contentType: string; stream: NodeJS.ReadableStream; contentLength?: number }
): Response => {
  res.setHeader('Content-Type', entry.contentType);
  if (entry.contentLength) {
    res.setHeader('Content-Length', String(entry.contentLength));
  }
  res.setHeader('Cache-Control', 'private, max-age=600');
  entry.stream.pipe(res);
  return res;
};
