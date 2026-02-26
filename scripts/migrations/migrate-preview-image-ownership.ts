#!/usr/bin/env node

/**
 * Backfill owner-scoped preview image objects in GCS.
 *
 * Usage:
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-preview-image-ownership.ts --dry-run
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-preview-image-ownership.ts --apply
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-preview-image-ownership.ts --dry-run --userId=<uid>
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-preview-image-ownership.ts --dry-run --limit=100
 */

import { Storage } from '@google-cloud/storage';
import { pathToFileURL } from 'node:url';
import { resolveBucketName } from '../../server/src/config/storageBucket.js';
import { initializeFirebaseAdmin } from './firebase-admin-init.js';

type Mode = 'dry-run' | 'apply';

interface Options {
  mode: Mode;
  userId?: string;
  limit: number | null;
}

export interface MappingEntry {
  assetId: string;
  userId: string;
  sources: Set<string>;
}

export interface Stats {
  scannedSessions: number;
  scannedContinuitySessions: number;
  mappingsDiscovered: number;
  uniqueUserAssetMappings: number;
  uniqueAssetIds: number;
  conflicts: number;
  plannedCopies: number;
  copied: number;
  skippedConflicts: number;
  skippedTargetExists: number;
  missingSource: number;
  errors: number;
}

function parseOptions(argv: string[]): Options {
  const hasApply = argv.includes('--apply');
  const hasDryRun = argv.includes('--dry-run');
  if (hasApply && hasDryRun) {
    throw new Error('Use exactly one of --dry-run or --apply');
  }

  const userIdRaw = argv.find((arg) => arg.startsWith('--userId='))?.split('=')[1];
  const limitRaw = argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1];
  const limitParsed = Number.parseInt(limitRaw || '', 10);

  return {
    mode: hasApply ? 'apply' : 'dry-run',
    ...(typeof userIdRaw === 'string' && userIdRaw.trim().length > 0
      ? { userId: userIdRaw.trim() }
      : {}),
    limit: Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : null,
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function sanitizeUserId(userId: string): string {
  const trimmed = userId.trim();
  if (trimmed.length === 0) {
    return 'anonymous';
  }
  return trimmed.replace(/[^a-zA-Z0-9._:@-]/g, '_');
}

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripImageExtension(value: string): string {
  return value.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '');
}

export function containsImagePreviewMarker(value: string): boolean {
  const decoded = decodeSafely(value).toLowerCase();
  return decoded.includes('image-previews/') || decoded.includes('image-previews%2f');
}

export function isPlainSingleSegmentToken(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (trimmed.includes('/') || trimmed.includes('?') || trimmed.includes('#')) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return false;
  }
  return true;
}

export function extractAssetIdFromReference(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const decoded = decodeSafely(trimmed).replace(/\\/g, '/');
  const marker = 'image-previews/';
  const markerIndex = decoded.indexOf(marker);

  if (markerIndex === -1) {
    if (
      decoded.includes('/') ||
      decoded.includes('?') ||
      decoded.includes('#') ||
      decoded.toLowerCase().startsWith('http')
    ) {
      return null;
    }
    return stripImageExtension(decoded);
  }

  const afterMarker = decoded.slice(markerIndex + marker.length);
  const pathOnly = afterMarker.split(/[?#]/)[0] || '';
  const segments = pathOnly.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const rawAssetId = segments.at(-1);
  if (!rawAssetId) {
    return null;
  }

  return stripImageExtension(rawAssetId);
}

function addMapping(
  mappings: Map<string, MappingEntry>,
  ownersByAsset: Map<string, Set<string>>,
  assetIdRaw: string | null,
  userIdRaw: string | null,
  source: string
): void {
  if (!assetIdRaw || !userIdRaw) {
    return;
  }

  const assetId = assetIdRaw.trim();
  const userId = userIdRaw.trim();
  if (assetId.length === 0 || userId.length === 0) {
    return;
  }
  if (assetId.includes('/')) {
    return;
  }

  const key = `${userId}::${assetId}`;
  const existing = mappings.get(key);
  if (existing) {
    existing.sources.add(source);
  } else {
    mappings.set(key, {
      assetId,
      userId,
      sources: new Set([source]),
    });
  }

  const owners = ownersByAsset.get(assetId) ?? new Set<string>();
  owners.add(userId);
  ownersByAsset.set(assetId, owners);
}

function collectFromPreviewRecord(
  preview: Record<string, unknown>,
  userId: string,
  sourcePrefix: string,
  mappings: Map<string, MappingEntry>,
  ownersByAsset: Map<string, Set<string>>
): void {
  const directAssetId =
    typeof preview.assetId === 'string' ? extractAssetIdFromReference(preview.assetId) : null;
  const storageAssetId =
    typeof preview.storagePath === 'string'
      ? extractAssetIdFromReference(preview.storagePath)
      : null;
  const imageUrlAssetId =
    typeof preview.imageUrl === 'string'
      ? extractAssetIdFromReference(preview.imageUrl)
      : null;

  addMapping(mappings, ownersByAsset, directAssetId, userId, `${sourcePrefix}.assetId`);
  addMapping(mappings, ownersByAsset, storageAssetId, userId, `${sourcePrefix}.storagePath`);
  addMapping(mappings, ownersByAsset, imageUrlAssetId, userId, `${sourcePrefix}.imageUrl`);
}

function collectFromGenerationRecord(
  generation: Record<string, unknown>,
  userId: string,
  sourcePrefix: string,
  mappings: Map<string, MappingEntry>,
  ownersByAsset: Map<string, Set<string>>
): void {
  const mediaUrls = Array.isArray(generation.mediaUrls) ? generation.mediaUrls : [];
  mediaUrls.forEach((mediaUrl, index) => {
    if (typeof mediaUrl !== 'string' || !containsImagePreviewMarker(mediaUrl)) {
      return;
    }
    addMapping(
      mappings,
      ownersByAsset,
      extractAssetIdFromReference(mediaUrl),
      userId,
      `${sourcePrefix}.mediaUrls[${index}]`
    );
  });

  if (
    typeof generation.thumbnailUrl === 'string' &&
    containsImagePreviewMarker(generation.thumbnailUrl)
  ) {
    addMapping(
      mappings,
      ownersByAsset,
      extractAssetIdFromReference(generation.thumbnailUrl),
      userId,
      `${sourcePrefix}.thumbnailUrl`
    );
  }

  const mediaAssetIds = Array.isArray(generation.mediaAssetIds) ? generation.mediaAssetIds : [];
  mediaAssetIds.forEach((mediaAssetId, index) => {
    if (typeof mediaAssetId !== 'string') {
      return;
    }
    if (
      !containsImagePreviewMarker(mediaAssetId) &&
      !isPlainSingleSegmentToken(mediaAssetId)
    ) {
      return;
    }
    addMapping(
      mappings,
      ownersByAsset,
      extractAssetIdFromReference(mediaAssetId),
      userId,
      `${sourcePrefix}.mediaAssetIds[${index}]`
    );
  });
}

function collectFromKeyframeRecord(
  keyframe: Record<string, unknown>,
  userId: string,
  sourcePrefix: string,
  mappings: Map<string, MappingEntry>,
  ownersByAsset: Map<string, Set<string>>
): void {
  if (typeof keyframe.url === 'string' && containsImagePreviewMarker(keyframe.url)) {
    addMapping(
      mappings,
      ownersByAsset,
      extractAssetIdFromReference(keyframe.url),
      userId,
      `${sourcePrefix}.url`
    );
  }

  if (
    typeof keyframe.storagePath === 'string' &&
    containsImagePreviewMarker(keyframe.storagePath)
  ) {
    addMapping(
      mappings,
      ownersByAsset,
      extractAssetIdFromReference(keyframe.storagePath),
      userId,
      `${sourcePrefix}.storagePath`
    );
  }

  if (
    typeof keyframe.assetId === 'string' &&
    (containsImagePreviewMarker(keyframe.assetId) || isPlainSingleSegmentToken(keyframe.assetId))
  ) {
    addMapping(
      mappings,
      ownersByAsset,
      extractAssetIdFromReference(keyframe.assetId),
      userId,
      `${sourcePrefix}.assetId`
    );
  }
}

export function collectSessionMappings(
  docId: string,
  data: Record<string, unknown>,
  mappings: Map<string, MappingEntry>,
  ownersByAsset: Map<string, Set<string>>
): void {
  const userId = typeof data.userId === 'string' ? data.userId : null;
  if (!userId) {
    return;
  }

  const prompt = toRecord(data.prompt);
  const versions = Array.isArray(prompt?.versions) ? prompt.versions : [];
  versions.forEach((version, index) => {
    const versionRecord = toRecord(version);
    const preview = toRecord(versionRecord?.preview);
    if (preview) {
      collectFromPreviewRecord(
        preview,
        userId,
        `sessions/${docId}.prompt.versions[${index}].preview`,
        mappings,
        ownersByAsset
      );
    }

    const generations = Array.isArray(versionRecord?.generations)
      ? versionRecord.generations
      : [];
    generations.forEach((generation, generationIndex) => {
      const generationRecord = toRecord(generation);
      if (!generationRecord) {
        return;
      }
      collectFromGenerationRecord(
        generationRecord,
        userId,
        `sessions/${docId}.prompt.versions[${index}].generations[${generationIndex}]`,
        mappings,
        ownersByAsset
      );
    });
  });

  const keyframes = Array.isArray(prompt?.keyframes) ? prompt.keyframes : [];
  keyframes.forEach((keyframe, index) => {
    const keyframeRecord = toRecord(keyframe);
    if (!keyframeRecord) {
      return;
    }
    collectFromKeyframeRecord(
      keyframeRecord,
      userId,
      `sessions/${docId}.prompt.keyframes[${index}]`,
      mappings,
      ownersByAsset
    );
  });

  const continuity = toRecord(data.continuity);
  const shots = Array.isArray(continuity?.shots) ? continuity.shots : [];
  shots.forEach((shot, index) => {
    const shotRecord = toRecord(shot);
    if (!shotRecord) {
      return;
    }

    if (typeof shotRecord.previewAssetId === 'string') {
      addMapping(
        mappings,
        ownersByAsset,
        extractAssetIdFromReference(shotRecord.previewAssetId),
        userId,
        `sessions/${docId}.continuity.shots[${index}].previewAssetId`
      );
    }

    const shotPreview = toRecord(shotRecord.preview);
    if (shotPreview) {
      collectFromPreviewRecord(
        shotPreview,
        userId,
        `sessions/${docId}.continuity.shots[${index}].preview`,
        mappings,
        ownersByAsset
      );
    }
  });
}

function collectLegacyContinuityMappings(
  docId: string,
  data: Record<string, unknown>,
  mappings: Map<string, MappingEntry>,
  ownersByAsset: Map<string, Set<string>>
): void {
  const userId = typeof data.userId === 'string' ? data.userId : null;
  if (!userId) {
    return;
  }

  const shots = Array.isArray(data.shots) ? data.shots : [];
  shots.forEach((shot, index) => {
    const shotRecord = toRecord(shot);
    if (!shotRecord) {
      return;
    }

    if (typeof shotRecord.previewAssetId === 'string') {
      addMapping(
        mappings,
        ownersByAsset,
        extractAssetIdFromReference(shotRecord.previewAssetId),
        userId,
        `continuity_sessions/${docId}.shots[${index}].previewAssetId`
      );
    }

    const shotPreview = toRecord(shotRecord.preview);
    if (shotPreview) {
      collectFromPreviewRecord(
        shotPreview,
        userId,
        `continuity_sessions/${docId}.shots[${index}].preview`,
        mappings,
        ownersByAsset
      );
    }
  });
}

async function collectMappings(
  db: FirebaseFirestore.Firestore,
  options: Options
): Promise<{
  mappings: Map<string, MappingEntry>;
  ownersByAsset: Map<string, Set<string>>;
  scannedSessions: number;
  scannedContinuitySessions: number;
}> {
  const mappings = new Map<string, MappingEntry>();
  const ownersByAsset = new Map<string, Set<string>>();
  let scannedSessions = 0;
  let scannedContinuitySessions = 0;

  let sessionsQuery: FirebaseFirestore.Query = db.collection('sessions');
  if (options.userId) {
    sessionsQuery = sessionsQuery.where('userId', '==', options.userId);
  }
  if (options.limit) {
    sessionsQuery = sessionsQuery.limit(options.limit);
  }

  const sessionsSnapshot = await sessionsQuery.get();
  scannedSessions = sessionsSnapshot.size;
  for (const doc of sessionsSnapshot.docs) {
    collectSessionMappings(doc.id, doc.data() as Record<string, unknown>, mappings, ownersByAsset);
  }

  let continuityQuery: FirebaseFirestore.Query = db.collection('continuity_sessions');
  if (options.userId) {
    continuityQuery = continuityQuery.where('userId', '==', options.userId);
  }
  if (options.limit) {
    continuityQuery = continuityQuery.limit(options.limit);
  }

  const continuitySnapshot = await continuityQuery.get();
  scannedContinuitySessions = continuitySnapshot.size;
  for (const doc of continuitySnapshot.docs) {
    collectLegacyContinuityMappings(
      doc.id,
      doc.data() as Record<string, unknown>,
      mappings,
      ownersByAsset
    );
  }

  return {
    mappings,
    ownersByAsset,
    scannedSessions,
    scannedContinuitySessions,
  };
}

export async function migrateMappings(
  bucket: import('@google-cloud/storage').Bucket,
  mappings: Iterable<MappingEntry>,
  conflictedAssetIds: ReadonlySet<string>,
  options: Options,
  stats: Stats
): Promise<void> {
  for (const mapping of mappings) {
    if (conflictedAssetIds.has(mapping.assetId)) {
      stats.skippedConflicts += 1;
      continue;
    }

    const sourcePath = `image-previews/${mapping.assetId}`;
    const targetPath = `image-previews/${sanitizeUserId(mapping.userId)}/${mapping.assetId}`;

    try {
      const targetFile = bucket.file(targetPath);
      const [targetExists] = await targetFile.exists();
      if (targetExists) {
        stats.skippedTargetExists += 1;
        continue;
      }

      const sourceFile = bucket.file(sourcePath);
      const [sourceExists] = await sourceFile.exists();
      if (!sourceExists) {
        stats.missingSource += 1;
        continue;
      }

      stats.plannedCopies += 1;
      if (options.mode === 'apply') {
        await sourceFile.copy(targetFile);
        stats.copied += 1;
      }
    } catch (error) {
      stats.errors += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `Failed to migrate asset ${mapping.assetId} for user ${mapping.userId}: ${errorMessage}`
      );
    }
  }
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const bucketName = resolveBucketName();
  const db = initializeFirebaseAdmin();
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  console.log('Starting preview image ownership migration');
  console.log(
    JSON.stringify(
      {
        mode: options.mode,
        bucket: bucketName,
        userId: options.userId ?? null,
        limit: options.limit ?? null,
      },
      null,
      2
    )
  );

  const {
    mappings,
    ownersByAsset,
    scannedSessions,
    scannedContinuitySessions,
  } = await collectMappings(db, options);

  const conflictEntries = Array.from(ownersByAsset.entries())
    .filter(([, owners]) => owners.size > 1)
    .map(([assetId, owners]) => ({
      assetId,
      userIds: Array.from(owners).sort(),
      ownerCount: owners.size,
    }))
    .sort((a, b) => b.ownerCount - a.ownerCount || a.assetId.localeCompare(b.assetId));
  const conflictedAssetIds = new Set(conflictEntries.map((entry) => entry.assetId));

  const stats: Stats = {
    scannedSessions,
    scannedContinuitySessions,
    mappingsDiscovered: Array.from(mappings.values()).reduce(
      (count, entry) => count + entry.sources.size,
      0
    ),
    uniqueUserAssetMappings: mappings.size,
    uniqueAssetIds: ownersByAsset.size,
    conflicts: conflictEntries.length,
    plannedCopies: 0,
    copied: 0,
    skippedConflicts: 0,
    skippedTargetExists: 0,
    missingSource: 0,
    errors: 0,
  };

  await migrateMappings(bucket, mappings.values(), conflictedAssetIds, options, stats);

  console.log('\nMigration summary');
  console.log(
    JSON.stringify(
      {
        mode: options.mode,
        stats,
        conflicts: {
          count: conflictEntries.length,
          sample: conflictEntries.slice(0, 25),
        },
      },
      null,
      2
    )
  );
}

const isDirectExecution =
  typeof process.argv[1] === 'string' && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectExecution) {
  run().catch((error) => {
    console.error('Migration failed', error);
    process.exit(1);
  });
}
