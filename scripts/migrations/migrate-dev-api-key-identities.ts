#!/usr/bin/env node

/**
 * One-time migration from dev-api-key identities to api-key identities.
 *
 * Usage:
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-dev-api-key-identities.ts --dry-run
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-dev-api-key-identities.ts --apply
 *
 * Options:
 *   --dry-run            Preview only (default when --apply is omitted)
 *   --apply              Execute writes/copies
 *   --threshold=N        Abort dry-run when planned changes exceed N (default: 100)
 */

import { Storage } from '@google-cloud/storage';
import { initializeFirebaseAdmin, admin } from './firebase-admin-init.js';
import { resolveBucketName } from '../../server/src/config/storageBucket.js';

const DEV_PREFIX = 'dev-api-key:';
const API_PREFIX = 'api-key:';

type Mode = 'dry-run' | 'apply';

interface MigrationOptions {
  mode: Mode;
  threshold: number;
}

interface MigrationStats {
  usersFound: number;
  userRootCopied: number;
  userRootSkippedExisting: number;
  userSubDocsCopied: number;
  userSubDocsSkippedExisting: number;
  collectionDocsRewritten: number;
  collectionDocsUnchanged: number;
  objectsFound: number;
  objectsCopied: number;
  objectsSkippedExisting: number;
  errors: number;
}

interface RewriteResult<T> {
  value: T;
  changed: boolean;
}

function parseOptions(argv: string[]): MigrationOptions {
  const hasApply = argv.includes('--apply');
  const hasDryRun = argv.includes('--dry-run');

  if (hasApply && hasDryRun) {
    throw new Error('Use exactly one of --dry-run or --apply');
  }

  const thresholdRaw = argv.find((arg) => arg.startsWith('--threshold='))?.split('=')[1];
  const threshold = Number.parseInt(thresholdRaw || '100', 10);

  return {
    mode: hasApply ? 'apply' : 'dry-run',
    threshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 100,
  };
}

function toTargetUserId(sourceUserId: string): string {
  if (!sourceUserId.startsWith(DEV_PREFIX)) {
    return sourceUserId;
  }
  return `${API_PREFIX}${sourceUserId.slice(DEV_PREFIX.length)}`;
}

function rewriteString(value: string, sourceUserId: string, targetUserId: string): RewriteResult<string> {
  const rawSourcePathPrefix = `users/${sourceUserId}/`;
  const rawTargetPathPrefix = `users/${targetUserId}/`;
  const encodedSourcePathPrefix = encodeURIComponent(rawSourcePathPrefix);
  const encodedTargetPathPrefix = encodeURIComponent(rawTargetPathPrefix);

  let next = value;
  next = next.replaceAll(rawSourcePathPrefix, rawTargetPathPrefix);
  next = next.replaceAll(encodedSourcePathPrefix, encodedTargetPathPrefix);
  if (next === sourceUserId) {
    next = targetUserId;
  }

  return { value: next, changed: next !== value };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function rewriteValue<T>(value: T, sourceUserId: string, targetUserId: string): RewriteResult<T> {
  if (typeof value === 'string') {
    const rewritten = rewriteString(value, sourceUserId, targetUserId);
    return { value: rewritten.value as T, changed: rewritten.changed };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const rewritten = value.map((entry) => {
      const child = rewriteValue(entry, sourceUserId, targetUserId);
      changed = changed || child.changed;
      return child.value;
    });

    return {
      value: (changed ? rewritten : value) as T,
      changed,
    };
  }

  if (isPlainRecord(value)) {
    let changed = false;
    const rewritten: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      const child = rewriteValue(entry, sourceUserId, targetUserId);
      rewritten[key] = child.value;
      changed = changed || child.changed;
    }

    return {
      value: (changed ? rewritten : value) as T,
      changed,
    };
  }

  return { value, changed: false };
}

async function copySubcollections(
  sourceDoc: FirebaseFirestore.DocumentReference,
  targetDoc: FirebaseFirestore.DocumentReference,
  sourceUserId: string,
  targetUserId: string,
  mode: Mode,
  stats: MigrationStats
): Promise<void> {
  const subcollections = await sourceDoc.listCollections();

  for (const subcollection of subcollections) {
    const snapshot = await subcollection.get();

    for (const doc of snapshot.docs) {
      const targetRef = targetDoc.collection(subcollection.id).doc(doc.id);
      const [targetSnapshot] = await Promise.all([targetRef.get()]);

      if (targetSnapshot.exists) {
        stats.userSubDocsSkippedExisting += 1;
      } else {
        const rewritten = rewriteValue(doc.data(), sourceUserId, targetUserId);
        if (mode === 'apply') {
          await targetRef.set(rewritten.value);
        }
        stats.userSubDocsCopied += 1;
      }

      await copySubcollections(doc.ref, targetRef, sourceUserId, targetUserId, mode, stats);
    }
  }
}

async function migrateUsersCollection(
  db: FirebaseFirestore.Firestore,
  mode: Mode,
  stats: MigrationStats
): Promise<void> {
  const users = db.collection('users');
  const sourceUsers = await users
    .where(admin.firestore.FieldPath.documentId(), '>=', DEV_PREFIX)
    .where(admin.firestore.FieldPath.documentId(), '<=', `${DEV_PREFIX}\uf8ff`)
    .get();

  stats.usersFound = sourceUsers.size;

  for (const sourceUserDoc of sourceUsers.docs) {
    const sourceUserId = sourceUserDoc.id;
    const targetUserId = toTargetUserId(sourceUserId);
    const targetUserDoc = users.doc(targetUserId);

    const [targetSnapshot] = await Promise.all([targetUserDoc.get()]);

    if (targetSnapshot.exists) {
      stats.userRootSkippedExisting += 1;
    } else {
      const rewritten = rewriteValue(sourceUserDoc.data(), sourceUserId, targetUserId);
      if (mode === 'apply') {
        await targetUserDoc.set(rewritten.value);
      }
      stats.userRootCopied += 1;
    }

    await copySubcollections(sourceUserDoc.ref, targetUserDoc, sourceUserId, targetUserId, mode, stats);
  }
}

async function migrateTopLevelUserIdCollections(
  db: FirebaseFirestore.Firestore,
  mode: Mode,
  stats: MigrationStats
): Promise<void> {
  const collections = await db.listCollections();

  for (const collection of collections) {
    if (collection.id === 'users') {
      continue;
    }

    let snapshot: FirebaseFirestore.QuerySnapshot;
    try {
      snapshot = await collection
        .where('userId', '>=', DEV_PREFIX)
        .where('userId', '<=', `${DEV_PREFIX}\uf8ff`)
        .get();
    } catch {
      continue;
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const sourceUserId = typeof data.userId === 'string' ? data.userId : null;
      if (!sourceUserId || !sourceUserId.startsWith(DEV_PREFIX)) {
        stats.collectionDocsUnchanged += 1;
        continue;
      }

      const targetUserId = toTargetUserId(sourceUserId);
      const rewritten = rewriteValue(data, sourceUserId, targetUserId);

      if (!rewritten.changed) {
        stats.collectionDocsUnchanged += 1;
        continue;
      }

      if (mode === 'apply') {
        await doc.ref.set(rewritten.value, { merge: false });
      }
      stats.collectionDocsRewritten += 1;
    }
  }
}

async function copyGcsObjects(mode: Mode, stats: MigrationStats): Promise<void> {
  const bucketName = resolveBucketName();
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const [files] = await bucket.getFiles({ prefix: `users/${DEV_PREFIX}` });
  stats.objectsFound = files.length;

  for (const sourceFile of files) {
    const targetPath = sourceFile.name.replace(/^users\/dev-api-key:/, 'users/api-key:');
    const targetFile = bucket.file(targetPath);
    const [targetExists] = await targetFile.exists();

    if (targetExists) {
      stats.objectsSkippedExisting += 1;
      continue;
    }

    if (mode === 'apply') {
      await sourceFile.copy(targetFile);
    }
    stats.objectsCopied += 1;
  }
}

function summarizeImpacted(stats: MigrationStats): number {
  return (
    stats.userRootCopied +
    stats.userSubDocsCopied +
    stats.collectionDocsRewritten +
    stats.objectsCopied
  );
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  await initializeFirebaseAdmin();
  const db = admin.firestore();

  const stats: MigrationStats = {
    usersFound: 0,
    userRootCopied: 0,
    userRootSkippedExisting: 0,
    userSubDocsCopied: 0,
    userSubDocsSkippedExisting: 0,
    collectionDocsRewritten: 0,
    collectionDocsUnchanged: 0,
    objectsFound: 0,
    objectsCopied: 0,
    objectsSkippedExisting: 0,
    errors: 0,
  };

  console.log(`Starting dev-api-key identity migration (${options.mode})`);

  try {
    await migrateUsersCollection(db, options.mode, stats);
    await migrateTopLevelUserIdCollections(db, options.mode, stats);
    await copyGcsObjects(options.mode, stats);
  } catch (error) {
    stats.errors += 1;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Migration failed:', errorMessage);
    throw error;
  }

  const impacted = summarizeImpacted(stats);

  if (options.mode === 'dry-run' && impacted > options.threshold) {
    console.error(
      `Dry-run planned changes (${impacted}) exceed threshold (${options.threshold}). Manual review required.`
    );
    console.log(JSON.stringify({ options, impacted, stats }, null, 2));
    process.exit(2);
  }

  console.log('\nMigration summary');
  console.log(
    JSON.stringify(
      {
        mode: options.mode,
        threshold: options.threshold,
        impacted,
        stats,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error('Migration aborted', error);
  process.exit(1);
});
