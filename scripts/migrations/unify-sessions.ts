#!/usr/bin/env node

/**
 * Unify Sessions Migration
 *
 * Migrates legacy prompt documents and continuity sessions into unified session documents.
 *
 * Usage:
 *   tsx --tsconfig server/tsconfig.json scripts/migrations/unify-sessions.ts [options]
 *
 * Options:
 *   --dry-run              Preview changes without writing
 *   --userId=USER_ID       Process only a specific user
 *   --limit=N              Limit number of records per collection
 *   --batch-size=N         Batch size for writes (default 50)
 */

import { initializeFirebaseAdmin, admin } from './firebase-admin-init.js';

const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  userId: args.find((arg) => arg.startsWith('--userId='))?.split('=')[1],
  limit: Number.parseInt(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '0', 10) || null,
  batchSize: Number.parseInt(args.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] || '50', 10),
};

const stats = {
  promptDocs: 0,
  continuityDocs: 0,
  promptMigrated: 0,
  continuityMigrated: 0,
  promptSkipped: 0,
  continuitySkipped: 0,
  collisions: 0,
  errors: 0,
  samples: [] as Array<{ type: string; id: string; payload: Record<string, unknown> }>,
};

const getTimestampMs = (value: unknown): number => {
  if (!value) return Date.now();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || Date.now();
  if (typeof value === 'object' && value && 'toDate' in (value as Record<string, unknown>)) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.getTime();
  }
  return Date.now();
};

const buildPromptSessionPayload = (docId: string, data: Record<string, unknown>) => {
  const input = typeof data.input === 'string' ? data.input : '';
  const output = typeof data.output === 'string' ? data.output : '';
  const createdAtMs = getTimestampMs(data.timestamp ?? data.createdAt);
  const updatedAtMs = getTimestampMs(data.timestamp ?? data.updatedAt ?? data.createdAt);
  const promptUuid = typeof data.uuid === 'string' ? data.uuid : null;

  const payload: Record<string, unknown> = {
    userId: data.userId,
    ...(typeof data.title === 'string' || data.title === null ? { name: data.title ?? undefined } : {}),
    status: 'active',
    prompt: {
      uuid: promptUuid ?? undefined,
      title: data.title ?? undefined,
      input,
      output,
      score: data.score ?? null,
      mode: data.mode ?? undefined,
      targetModel: data.targetModel ?? null,
      generationParams: data.generationParams ?? null,
      keyframes: data.keyframes ?? null,
      brainstormContext: data.brainstormContext ?? null,
      highlightCache: data.highlightCache ?? null,
      versions: Array.isArray(data.versions) ? data.versions : [],
    },
    ...(promptUuid ? { promptUuid } : {}),
    hasContinuity: false,
    createdAtMs,
    updatedAtMs,
  };

  return { id: docId, payload };
};

const buildContinuitySessionPayload = (docId: string, data: Record<string, unknown>) => {
  const createdAtMs = getTimestampMs(data.createdAtMs ?? data.createdAt);
  const updatedAtMs = getTimestampMs(data.updatedAtMs ?? data.updatedAt ?? data.createdAt);

  const payload: Record<string, unknown> = {
    userId: data.userId,
    ...(typeof data.name === 'string' ? { name: data.name } : {}),
    ...(typeof data.description === 'string' ? { description: data.description } : {}),
    status: data.status ?? 'active',
    continuity: data,
    hasContinuity: true,
    createdAtMs,
    updatedAtMs,
  };

  return { id: docId, payload };
};

async function migrateCollection(
  db: FirebaseFirestore.Firestore,
  source: FirebaseFirestore.CollectionReference,
  builder: (id: string, data: Record<string, unknown>) => { id: string; payload: Record<string, unknown> },
  label: 'prompt' | 'continuity'
) {
  let query: FirebaseFirestore.Query = source;
  if (options.userId) {
    query = query.where('userId', '==', options.userId);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  if (label === 'prompt') stats.promptDocs = snapshot.size;
  if (label === 'continuity') stats.continuityDocs = snapshot.size;

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data() as Record<string, unknown>;
      if (!data.userId) {
        if (label === 'prompt') stats.promptSkipped += 1;
        if (label === 'continuity') stats.continuitySkipped += 1;
        continue;
      }
      const { id, payload } = builder(doc.id, data);
      const sessionRef = db.collection('sessions').doc(id);
      const existing = await sessionRef.get();
      if (existing.exists) {
        stats.collisions += 1;
        continue;
      }

      if (!options.dryRun) {
        batch.set(sessionRef, {
          ...payload,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount += 1;
      }

      if (label === 'prompt') stats.promptMigrated += 1;
      if (label === 'continuity') stats.continuityMigrated += 1;

      if (stats.samples.length < 4) {
        stats.samples.push({ type: label, id, payload });
      }

      if (batchCount >= options.batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    } catch (error) {
      stats.errors += 1;
      console.error(`Error migrating ${label} doc ${doc.id}:`, error);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }
}

async function run(): Promise<void> {
  await initializeFirebaseAdmin();
  const db = admin.firestore();

  console.log('Starting session unification migration', options);

  await migrateCollection(db, db.collection('prompts'), buildPromptSessionPayload, 'prompt');
  await migrateCollection(db, db.collection('continuity_sessions'), buildContinuitySessionPayload, 'continuity');

  console.log('\nMigration Summary');
  console.log(JSON.stringify({
    ...stats,
    dryRun: options.dryRun,
  }, null, 2));

  if (stats.samples.length) {
    console.log('\nSample payloads:');
    for (const sample of stats.samples) {
      console.log(`- ${sample.type}:${sample.id}`);
      console.log(JSON.stringify(sample.payload, null, 2));
    }
  }
}

run().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
