#!/usr/bin/env node

/**
 * Cleanup script for legacy dev-api-key objects after migration soak period.
 *
 * Usage:
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/cleanup-dev-api-key-objects.ts --dry-run
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/cleanup-dev-api-key-objects.ts --apply
 *
 * Options:
 *   --dry-run            Preview only (default when --apply is omitted)
 *   --apply              Delete eligible objects
 *   --min-age-days=N     Minimum age in days before delete (default: 7)
 */

import { Storage } from '@google-cloud/storage';
import { resolveBucketName } from '../../server/src/config/storageBucket.js';

type Mode = 'dry-run' | 'apply';

interface CleanupOptions {
  mode: Mode;
  minAgeDays: number;
}

interface CleanupStats {
  objectsFound: number;
  eligible: number;
  deleted: number;
  skippedYoung: number;
  errors: number;
}

function parseOptions(argv: string[]): CleanupOptions {
  const hasApply = argv.includes('--apply');
  const hasDryRun = argv.includes('--dry-run');

  if (hasApply && hasDryRun) {
    throw new Error('Use exactly one of --dry-run or --apply');
  }

  const minAgeDaysRaw = argv.find((arg) => arg.startsWith('--min-age-days='))?.split('=')[1];
  const minAgeDays = Number.parseInt(minAgeDaysRaw || '7', 10);

  return {
    mode: hasApply ? 'apply' : 'dry-run',
    minAgeDays: Number.isFinite(minAgeDays) && minAgeDays > 0 ? minAgeDays : 7,
  };
}

function resolveCreatedAtMs(metadata: { timeCreated?: string }): number | null {
  if (!metadata.timeCreated) {
    return null;
  }
  const parsed = Date.parse(metadata.timeCreated);
  return Number.isFinite(parsed) ? parsed : null;
}

async function run(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const bucketName = resolveBucketName();
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const cutoffMs = Date.now() - options.minAgeDays * 24 * 60 * 60 * 1000;

  const stats: CleanupStats = {
    objectsFound: 0,
    eligible: 0,
    deleted: 0,
    skippedYoung: 0,
    errors: 0,
  };

  console.log(`Starting dev-api-key object cleanup (${options.mode})`);
  console.log(`Bucket: ${bucketName}`);
  console.log(`Minimum age: ${options.minAgeDays} day(s)`);

  const [files] = await bucket.getFiles({ prefix: 'users/dev-api-key:' });
  stats.objectsFound = files.length;

  for (const file of files) {
    try {
      const [metadata] = await file.getMetadata();
      const createdAtMs = resolveCreatedAtMs(metadata);

      if (createdAtMs !== null && createdAtMs > cutoffMs) {
        stats.skippedYoung += 1;
        continue;
      }

      stats.eligible += 1;
      if (options.mode === 'apply') {
        await file.delete();
      }
      stats.deleted += 1;
    } catch (error) {
      stats.errors += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed processing ${file.name}: ${errorMessage}`);
    }
  }

  console.log('\nCleanup summary');
  console.log(
    JSON.stringify(
      {
        mode: options.mode,
        minAgeDays: options.minAgeDays,
        stats,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error('Cleanup aborted', error);
  process.exit(1);
});
