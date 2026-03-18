#!/usr/bin/env node

/**
 * Migration: Move legacy flat image-preview assets into userId-scoped paths.
 *
 * Background:
 *   A code change introduced userId-scoped storage paths for image previews:
 *     Before: image-previews/{assetId}
 *     After:  image-previews/{userId}/{assetId}
 *
 *   ~280 legacy assets were stored at the flat path. The application now checks
 *   both paths (with a fallback), but this migration moves assets to the new
 *   canonical path so the fallback can eventually be removed.
 *
 * Strategy:
 *   1. Scan all Firestore session documents to build an assetId→userId map
 *   2. List all GCS objects at the flat prefix (image-previews/{uuid})
 *   3. For each flat object, look up the owner userId and copy to the new path
 *   4. Optionally delete the original flat object (--delete-originals)
 *
 * Usage:
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-image-assets-to-user-scoped.ts --dry-run
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-image-assets-to-user-scoped.ts --apply
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-image-assets-to-user-scoped.ts --apply --delete-originals
 *
 * Options:
 *   --dry-run              Preview only (default when --apply is omitted)
 *   --apply                Actually copy files in GCS
 *   --delete-originals     After successful copy, delete the flat original
 *   --batch-size=N         Firestore query page size (default: 200)
 *   --default-user=UID     Assign orphaned assets (no Firestore match) to this userId
 */

import { Storage } from '@google-cloud/storage';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { resolveBucketName } from '../../server/src/config/storageBucket.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = 'dry-run' | 'apply';

interface MigrationOptions {
  mode: Mode;
  deleteOriginals: boolean;
  batchSize: number;
  defaultUserId: string | null;
}

interface MigrationStats {
  sessionsScanned: number;
  assetMappingsFound: number;
  flatObjectsInGcs: number;
  alreadyMigrated: number;
  orphaned: number;
  copied: number;
  deleted: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Option parsing
// ---------------------------------------------------------------------------

function parseOptions(argv: string[]): MigrationOptions {
  const hasApply = argv.includes('--apply');
  const hasDryRun = argv.includes('--dry-run');

  if (hasApply && hasDryRun) {
    throw new Error('Use exactly one of --dry-run or --apply');
  }

  const batchSizeRaw = argv.find((a) => a.startsWith('--batch-size='))?.split('=')[1];
  const batchSize = Number.parseInt(batchSizeRaw || '200', 10);

  const defaultUserRaw = argv.find((a) => a.startsWith('--default-user='))?.split('=')[1];
  const defaultUserId = defaultUserRaw?.trim() || null;

  return {
    mode: hasApply ? 'apply' : 'dry-run',
    deleteOriginals: argv.includes('--delete-originals'),
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 200,
    defaultUserId,
  };
}

// ---------------------------------------------------------------------------
// UserId sanitization (must match GcsImageAssetStore.sanitizeUserId)
// ---------------------------------------------------------------------------

function sanitizeUserId(userId: string): string {
  const trimmed = userId.trim();
  if (trimmed.length === 0) return 'anonymous';
  return trimmed.replace(/[^a-zA-Z0-9._:@-]/g, '_');
}

// ---------------------------------------------------------------------------
// UUID detection (flat objects are bare UUIDs, userId-scoped have a / prefix)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isBareUuid(name: string): boolean {
  return UUID_RE.test(name);
}

// ---------------------------------------------------------------------------
// Firestore scan: build assetId → userId map
// ---------------------------------------------------------------------------

interface AssetOwnerResult {
  assetToUser: Map<string, string>;
  sessionsScanned: number;
}

async function buildAssetOwnerMap(
  db: FirebaseFirestore.Firestore,
  batchSize: number
): Promise<AssetOwnerResult> {
  const assetToUser = new Map<string, string>();
  let sessionsScanned = 0;
  let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined;

  console.log('Scanning Firestore sessions for assetId → userId mappings...');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = db.collection('sessions').orderBy('__name__').limit(batchSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      sessionsScanned += 1;
      const data = doc.data();
      const userId = data.userId as string | undefined;
      if (!userId) continue;

      // Extract assetIds from prompt versions
      const versions = (data.prompt?.versions ?? []) as Array<Record<string, unknown>>;
      for (const version of versions) {
        // Preview assetId
        const previewAssetId = (version.preview as Record<string, unknown> | undefined)?.assetId;
        if (typeof previewAssetId === 'string' && previewAssetId.trim()) {
          assetToUser.set(previewAssetId.trim(), userId);
        }

        // Generation mediaAssetIds
        const generations = (version.generations ?? []) as Array<Record<string, unknown>>;
        for (const gen of generations) {
          const ids = gen.mediaAssetIds as string[] | undefined;
          if (Array.isArray(ids)) {
            for (const id of ids) {
              if (typeof id === 'string' && id.trim() && !id.startsWith('users/')) {
                assetToUser.set(id.trim(), userId);
              }
            }
          }
        }
      }

      // Extract assetIds from keyframes
      const keyframes = (data.prompt?.keyframes ?? []) as Array<Record<string, unknown>>;
      for (const kf of keyframes) {
        const kfAssetId = kf.assetId;
        if (typeof kfAssetId === 'string' && kfAssetId.trim() && !kfAssetId.startsWith('users/')) {
          assetToUser.set(kfAssetId.trim(), userId);
        }
      }

      // Extract from continuity shots
      const shots = (data.continuity?.shots ?? []) as Array<Record<string, unknown>>;
      for (const shot of shots) {
        for (const field of ['previewAssetId', 'videoAssetId']) {
          const val = shot[field];
          if (typeof val === 'string' && val.trim() && !val.startsWith('users/')) {
            assetToUser.set(val.trim(), userId);
          }
        }
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (sessionsScanned % 500 === 0) {
      console.log(`  ...scanned ${sessionsScanned} sessions, found ${assetToUser.size} mappings`);
    }
  }

  console.log(`Scanned ${sessionsScanned} sessions, found ${assetToUser.size} asset→user mappings`);
  return { assetToUser, sessionsScanned };
}

// ---------------------------------------------------------------------------
// GCS migration
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const bucketName = resolveBucketName();
  const basePath = process.env.IMAGE_STORAGE_BASE_PATH || 'image-previews';

  // Initialize Firebase Admin
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const serviceAccount: ServiceAccount = await import(credPath, { with: { type: 'json' } })
      .then((m) => m.default as ServiceAccount);
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp();
  }
  const db = getFirestore();

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const stats: MigrationStats = {
    sessionsScanned: 0,
    assetMappingsFound: 0,
    flatObjectsInGcs: 0,
    alreadyMigrated: 0,
    orphaned: 0,
    copied: 0,
    deleted: 0,
    errors: 0,
  };

  console.log('='.repeat(70));
  console.log(`Image Asset Migration: flat → userId-scoped (${options.mode})`);
  console.log('='.repeat(70));
  console.log(`Bucket:           ${bucketName}`);
  console.log(`Base path:        ${basePath}`);
  console.log(`Delete originals: ${options.deleteOriginals}`);
  console.log(`Default user:     ${options.defaultUserId ?? '(none — orphans skipped)'}`);
  console.log();

  // Step 1: Build asset→user map from Firestore
  const { assetToUser, sessionsScanned } = await buildAssetOwnerMap(db, options.batchSize);
  stats.sessionsScanned = sessionsScanned;
  stats.assetMappingsFound = assetToUser.size;

  // Step 2: List flat GCS objects under basePath/
  console.log(`\nListing GCS objects under ${basePath}/...`);
  const [allFiles] = await bucket.getFiles({ prefix: `${basePath}/` });

  // Filter to only flat UUID objects (not already in a userId subfolder)
  const flatFiles = allFiles.filter((f) => {
    const relativePath = f.name.slice(`${basePath}/`.length);
    // Flat files have no '/' in the relative path and are bare UUIDs
    return !relativePath.includes('/') && isBareUuid(relativePath);
  });

  stats.flatObjectsInGcs = flatFiles.length;
  console.log(`Found ${flatFiles.length} flat (legacy) objects out of ${allFiles.length} total`);

  // Step 3: Migrate each flat object
  const orphanedAssetIds: string[] = [];

  for (const file of flatFiles) {
    const assetId = file.name.slice(`${basePath}/`.length);
    const userId = assetToUser.get(assetId) ?? options.defaultUserId;

    if (!userId) {
      stats.orphaned += 1;
      orphanedAssetIds.push(assetId);
      continue;
    }

    const sanitized = sanitizeUserId(userId);
    const targetPath = `${basePath}/${sanitized}/${assetId}`;

    // Check if target already exists
    const targetFile = bucket.file(targetPath);
    const [targetExists] = await targetFile.exists();
    if (targetExists) {
      stats.alreadyMigrated += 1;
      continue;
    }

    if (options.mode === 'dry-run') {
      console.log(`  [DRY-RUN] Would copy: ${file.name} → ${targetPath}`);
      stats.copied += 1;
      continue;
    }

    // Copy
    try {
      await file.copy(targetFile);
      stats.copied += 1;

      // Optionally delete original
      if (options.deleteOriginals) {
        await file.delete();
        stats.deleted += 1;
      }

      if (stats.copied % 50 === 0) {
        console.log(`  ...copied ${stats.copied} files`);
      }
    } catch (error) {
      stats.errors += 1;
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  ERROR copying ${file.name}: ${msg}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('Migration Summary');
  console.log('='.repeat(70));
  console.log(JSON.stringify({ mode: options.mode, stats }, null, 2));

  if (orphanedAssetIds.length > 0) {
    console.log(`\nOrphaned assets (no userId found in Firestore): ${orphanedAssetIds.length}`);
    if (orphanedAssetIds.length <= 20) {
      for (const id of orphanedAssetIds) {
        console.log(`  - ${id}`);
      }
    } else {
      for (const id of orphanedAssetIds.slice(0, 10)) {
        console.log(`  - ${id}`);
      }
      console.log(`  ... and ${orphanedAssetIds.length - 10} more`);
    }
    console.log('\nOrphaned assets will continue to work via the legacy fallback path.');
    console.log('They may belong to deleted sessions or anonymous/test users.');
  }

  if (stats.errors > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Migration aborted', error);
  process.exit(1);
});
