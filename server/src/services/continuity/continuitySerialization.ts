import { z } from 'zod';
import type { ContinuitySession, ContinuityShot } from './types';

const StoredShotSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  sequenceIndex: z.number(),
  userPrompt: z.string(),
  continuityMode: z.enum(['frame-bridge', 'style-match', 'native', 'none']),
  styleStrength: z.number(),
  styleReferenceId: z.string().nullable(),
  modelId: z.string(),
  status: z.enum(['draft', 'generating-keyframe', 'generating-video', 'completed', 'failed']),
  createdAt: z.number(),
}).passthrough();

export interface StoredContinuitySession {
  userId: string;
  name: string;
  description?: string;
  primaryStyleReference: Record<string, unknown>;
  sceneProxy?: Record<string, unknown>;
  shots: Array<Record<string, unknown>>;
  defaultSettings: ContinuitySession['defaultSettings'];
  status: ContinuitySession['status'];
  createdAtMs: number;
  updatedAtMs: number;
  version?: number;
}

export const serializeContinuitySession = (session: ContinuitySession): StoredContinuitySession => ({
  userId: session.userId,
  name: session.name,
  ...(typeof session.description === 'string' ? { description: session.description } : {}),
  primaryStyleReference: serializeStyleReference(session.primaryStyleReference),
  ...(session.sceneProxy ? { sceneProxy: serializeSceneProxy(session.sceneProxy) } : {}),
  shots: session.shots.map((shot) => serializeShot(shot)),
  defaultSettings: session.defaultSettings,
  status: session.status,
  createdAtMs: session.createdAt.getTime(),
  updatedAtMs: session.updatedAt.getTime(),
  ...(typeof session.version === 'number' ? { version: session.version } : {}),
});

export const deserializeContinuitySession = (
  sessionId: string,
  stored: StoredContinuitySession
): ContinuitySession => {
  const sceneProxy = stored.sceneProxy ? deserializeSceneProxy(stored.sceneProxy) : undefined;
  const storedRecord = stored as unknown as Record<string, unknown>;
  const version = typeof storedRecord.version === 'number'
    ? storedRecord.version
    : undefined;
  return {
    id: sessionId,
    userId: stored.userId,
    name: stored.name,
    ...(typeof stored.description === 'string' ? { description: stored.description } : {}),
    primaryStyleReference: deserializeStyleReference(stored.primaryStyleReference),
    ...(sceneProxy ? { sceneProxy } : {}),
    shots: stored.shots.map((shot) => deserializeShot(shot)),
    defaultSettings: stored.defaultSettings,
    status: stored.status,
    ...(version !== undefined ? { version } : {}),
    createdAt: new Date(stored.createdAtMs),
    updatedAt: new Date(stored.updatedAtMs),
  };
};

export const serializeShot = (shot: ContinuityShot): Record<string, unknown> => ({
  ...shot,
  createdAt: shot.createdAt.getTime(),
  generatedAt: shot.generatedAt ? shot.generatedAt.getTime() : undefined,
  frameBridge: shot.frameBridge
    ? {
        ...shot.frameBridge,
        extractedAt: shot.frameBridge.extractedAt.getTime(),
      }
    : undefined,
  styleReference: shot.styleReference ? serializeStyleReference(shot.styleReference) : undefined,
  seedInfo: shot.seedInfo
    ? {
        ...shot.seedInfo,
        extractedAt: shot.seedInfo.extractedAt.getTime(),
      }
    : undefined,
});

export const deserializeShot = (raw: Record<string, unknown>): ContinuityShot => {
  const parsed = StoredShotSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid shot data in Firestore: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const createdAt = new Date(data.createdAt);
  const generatedAt =
    typeof raw.generatedAt === 'number' ? new Date(raw.generatedAt) : undefined;
  const seedInfoRaw = raw.seedInfo as Record<string, unknown> | undefined;
  const frameBridgeRaw = raw.frameBridge as Record<string, unknown> | undefined;
  const seedInfo =
    seedInfoRaw && typeof seedInfoRaw.seed === 'number'
      ? {
          seed: seedInfoRaw.seed as number,
          provider: String(seedInfoRaw.provider || ''),
          modelId: String(seedInfoRaw.modelId || ''),
          extractedAt:
            typeof seedInfoRaw.extractedAt === 'number'
              ? new Date(seedInfoRaw.extractedAt)
              : new Date(),
        }
      : undefined;

  const styleReferenceRaw = raw.styleReference as Record<string, unknown> | undefined;

  const shot = raw as unknown as ContinuityShot;
  shot.createdAt = createdAt;
  if (generatedAt) {
    shot.generatedAt = generatedAt;
  }
  if (seedInfo) {
    shot.seedInfo = seedInfo;
  }
  if (frameBridgeRaw) {
    shot.frameBridge = {
      ...(frameBridgeRaw as Record<string, unknown>),
      extractedAt:
        typeof frameBridgeRaw.extractedAt === 'number'
          ? new Date(frameBridgeRaw.extractedAt)
          : new Date(),
    } as NonNullable<ContinuityShot['frameBridge']>;
  }
  if (styleReferenceRaw) {
    shot.styleReference = deserializeStyleReference(styleReferenceRaw);
  }

  return shot;
};

export const serializeStyleReference = (ref: ContinuitySession['primaryStyleReference']): Record<string, unknown> => ({
  ...ref,
  extractedAt: ref.extractedAt.getTime(),
});

export const deserializeStyleReference = (
  raw: Record<string, unknown>
): ContinuitySession['primaryStyleReference'] => {
  const extractedAt = typeof raw.extractedAt === 'number' ? new Date(raw.extractedAt) : new Date();
  const ref = raw as unknown as ContinuitySession['primaryStyleReference'];
  ref.extractedAt = extractedAt;
  return ref;
};

export const serializeSceneProxy = (
  proxy: ContinuitySession['sceneProxy']
): Record<string, unknown> => ({
  ...proxy,
  createdAt: proxy?.createdAt ? proxy.createdAt.getTime() : Date.now(),
});

export const deserializeSceneProxy = (
  raw: Record<string, unknown>
): ContinuitySession['sceneProxy'] => {
  const createdAt = typeof raw.createdAt === 'number' ? new Date(raw.createdAt) : new Date();
  const proxy = raw as unknown as ContinuitySession['sceneProxy'];
  if (!proxy) {
    return proxy;
  }
  return { ...proxy, createdAt };
};
