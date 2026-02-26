#!/usr/bin/env node

/**
 * Inventory preview image references across Firestore session collections.
 *
 * Usage:
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/inventory-preview-image-references.ts --dry-run
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/inventory-preview-image-references.ts --dry-run --userId=<uid>
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/inventory-preview-image-references.ts --dry-run --limit=100
 */

import { initializeFirebaseAdmin } from './firebase-admin-init.js';
import { pathToFileURL } from 'node:url';

type CollectionName = 'sessions' | 'continuity_sessions';

interface Options {
  dryRun: boolean;
  limit: number | null;
  userId?: string;
}

interface FieldStat {
  collection: CollectionName;
  path: string;
  count: number;
  reasons: Set<string>;
  sampleDocIds: Set<string>;
  sampleValues: Set<string>;
}

interface CollectionScanStats {
  docsScanned: number;
  matches: number;
}

const COLLECTIONS: CollectionName[] = ['sessions', 'continuity_sessions'];

function parseOptions(argv: string[]): Options {
  const dryRun = argv.includes('--dry-run');
  const limitRaw = argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1];
  const limitParsed = Number.parseInt(limitRaw || '', 10);
  const userId = argv.find((arg) => arg.startsWith('--userId='))?.split('=')[1];

  return {
    dryRun,
    limit: Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : null,
    ...(typeof userId === 'string' && userId.trim().length > 0 ? { userId: userId.trim() } : {}),
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function truncate(value: string, max = 160): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
}

function normalizePath(path: string[]): string {
  return path.join('.');
}

export function findReasons(path: string, value: string): string[] {
  const reasons = new Set<string>();
  const key = path.split('.').at(-1)?.toLowerCase() ?? '';
  const normalizedValue = value.toLowerCase();
  const normalizedPath = path.toLowerCase();

  if (normalizedValue.includes('image-previews/')) {
    reasons.add('value:contains-image-previews-path');
  }
  if (normalizedValue.includes('image-previews%2f')) {
    reasons.add('value:contains-encoded-image-previews-path');
  }
  if (key === 'previewassetid') {
    reasons.add('key:previewAssetId');
  }
  if (key === 'assetid' && normalizedPath.includes('.preview.')) {
    reasons.add('key:preview.assetId');
  }
  if (key === 'storagepath' && normalizedPath.includes('.preview.')) {
    reasons.add('key:preview.storagePath');
  }
  if (key === 'imageurl' && normalizedPath.includes('.preview.')) {
    reasons.add('key:preview.imageUrl');
  }
  if (
    normalizedPath.includes('.continuity.shots[].previewassetid') ||
    normalizedPath.includes('.shots[].previewassetid')
  ) {
    reasons.add('path:continuity-shot-previewAssetId');
  }
  if (normalizedPath.includes('.generations.[].mediaurls.[]')) {
    reasons.add('path:generations-mediaUrls');
  }
  if (normalizedPath.includes('.generations.[].thumbnailurl')) {
    reasons.add('path:generations-thumbnailUrl');
  }
  if (normalizedPath.includes('.generations.[].mediaassetids.[]')) {
    reasons.add('path:generations-mediaAssetIds');
  }
  if (normalizedPath.includes('.keyframes.[].url')) {
    reasons.add('path:keyframes-url');
  }
  if (normalizedPath.includes('.keyframes.[].storagepath')) {
    reasons.add('path:keyframes-storagePath');
  }
  if (normalizedPath.includes('.keyframes.[].assetid')) {
    reasons.add('path:keyframes-assetId');
  }

  return Array.from(reasons);
}

function addFieldHit(
  hits: Map<string, FieldStat>,
  collection: CollectionName,
  path: string,
  docId: string,
  value: string,
  reasons: string[]
): void {
  const key = `${collection}:${path}`;
  const current = hits.get(key);
  if (current) {
    current.count += 1;
    reasons.forEach((reason) => current.reasons.add(reason));
    if (current.sampleDocIds.size < 5) {
      current.sampleDocIds.add(docId);
    }
    if (current.sampleValues.size < 5) {
      current.sampleValues.add(truncate(value));
    }
    return;
  }

  hits.set(key, {
    collection,
    path,
    count: 1,
    reasons: new Set(reasons),
    sampleDocIds: new Set([docId]),
    sampleValues: new Set([truncate(value)]),
  });
}

function walkAndCollect(
  value: unknown,
  path: string[],
  visit: (fieldPath: string, stringValue: string) => void
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkAndCollect(entry, [...path, '[]'], visit);
    }
    return;
  }

  const record = toRecord(value);
  if (record) {
    for (const [key, child] of Object.entries(record)) {
      walkAndCollect(child, [...path, key], visit);
    }
    return;
  }

  if (typeof value === 'string') {
    visit(normalizePath(path), value);
  }
}

async function scanCollection(
  db: FirebaseFirestore.Firestore,
  collection: CollectionName,
  options: Options,
  hits: Map<string, FieldStat>
): Promise<CollectionScanStats> {
  let query: FirebaseFirestore.Query = db.collection(collection);
  if (options.userId) {
    query = query.where('userId', '==', options.userId);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  let matches = 0;

  for (const doc of snapshot.docs) {
    const docData = doc.data();
    walkAndCollect(docData, [], (fieldPath, stringValue) => {
      const reasons = findReasons(fieldPath, stringValue);
      if (reasons.length === 0) {
        return;
      }
      addFieldHit(hits, collection, fieldPath, doc.id, stringValue, reasons);
      matches += 1;
    });
  }

  return {
    docsScanned: snapshot.size,
    matches,
  };
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const db = initializeFirebaseAdmin();
  const fieldHits = new Map<string, FieldStat>();
  const collectionStats = new Map<CollectionName, CollectionScanStats>();

  console.log('Running preview image reference inventory');
  console.log(
    JSON.stringify(
      {
        mode: options.dryRun ? 'dry-run' : 'read-only',
        limit: options.limit ?? null,
        userId: options.userId ?? null,
        collections: COLLECTIONS,
      },
      null,
      2
    )
  );

  for (const collection of COLLECTIONS) {
    const stats = await scanCollection(db, collection, options, fieldHits);
    collectionStats.set(collection, stats);
  }

  const fields = Array.from(fieldHits.values())
    .map((entry) => ({
      collection: entry.collection,
      path: entry.path,
      count: entry.count,
      reasons: Array.from(entry.reasons).sort(),
      sampleDocIds: Array.from(entry.sampleDocIds),
      sampleValues: Array.from(entry.sampleValues),
    }))
    .sort((a, b) => b.count - a.count || a.collection.localeCompare(b.collection) || a.path.localeCompare(b.path));

  const result = {
    mode: options.dryRun ? 'dry-run' : 'read-only',
    scanned: {
      sessions: collectionStats.get('sessions')?.docsScanned ?? 0,
      continuity_sessions: collectionStats.get('continuity_sessions')?.docsScanned ?? 0,
      total:
        (collectionStats.get('sessions')?.docsScanned ?? 0) +
        (collectionStats.get('continuity_sessions')?.docsScanned ?? 0),
    },
    matches: {
      sessions: collectionStats.get('sessions')?.matches ?? 0,
      continuity_sessions: collectionStats.get('continuity_sessions')?.matches ?? 0,
      total:
        (collectionStats.get('sessions')?.matches ?? 0) +
        (collectionStats.get('continuity_sessions')?.matches ?? 0),
    },
    fieldCount: fields.length,
    fields,
  };

  console.log('\nInventory summary');
  console.log(JSON.stringify(result, null, 2));
}

const isDirectExecution =
  typeof process.argv[1] === 'string' && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectExecution) {
  run().catch((error) => {
    console.error('Inventory failed', error);
    process.exit(1);
  });
}
