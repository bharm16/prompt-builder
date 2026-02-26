/**
 * DR Smoke Test — Firestore data integrity verification.
 *
 * Checks:
 * 1. Credit balances match transaction sums per user
 * 2. Video job status distribution is reasonable
 * 3. No orphaned credit transactions (missing user)
 * 4. DLQ entries reference existing job IDs
 *
 * Exit code 0 = all checks pass, 1 = at least one failure.
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const isEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.GCLOUD_PROJECT || 'demo-project';

initializeApp({
  credential: isEmulator ? applicationDefault() : applicationDefault(),
  projectId,
});

const db = getFirestore();
let failures = 0;

function pass(check) {
  console.log(`  PASS  ${check}`);
}

function fail(check, detail) {
  console.log(`  FAIL  ${check}: ${detail}`);
  failures += 1;
}

// --- Check 1: Credit balance vs transaction sum ---

async function checkCreditBalances() {
  console.log('\n[1/4] Credit balance integrity...');

  const balancesSnap = await db.collection('credit_balances').get();
  if (balancesSnap.empty) {
    pass('No credit balances to verify (empty collection)');
    return;
  }

  let checked = 0;
  let mismatches = 0;

  for (const balanceDoc of balancesSnap.docs) {
    const userId = balanceDoc.id;
    const storedBalance = balanceDoc.data().balance ?? 0;

    const txSnap = await db
      .collection('credit_balances')
      .doc(userId)
      .collection('credit_transactions')
      .get();

    let computedBalance = 0;
    for (const txDoc of txSnap.docs) {
      const amount = txDoc.data().amount ?? 0;
      computedBalance += amount;
    }

    if (Math.abs(storedBalance - computedBalance) > 0.01) {
      fail(
        `User ${userId}`,
        `stored=${storedBalance}, computed=${computedBalance}, drift=${storedBalance - computedBalance}`
      );
      mismatches += 1;
    }
    checked += 1;
  }

  if (mismatches === 0) {
    pass(`${checked} user credit balances match transaction sums`);
  }
}

// --- Check 2: Video job status distribution ---

async function checkVideoJobDistribution() {
  console.log('\n[2/4] Video job status distribution...');

  const statusCounts = { queued: 0, processing: 0, completed: 0, failed: 0 };
  let total = 0;

  const jobsSnap = await db.collection('video_jobs').get();
  for (const doc of jobsSnap.docs) {
    const status = doc.data().status;
    if (status in statusCounts) {
      statusCounts[status] += 1;
    }
    total += 1;
  }

  console.log(`    Total jobs: ${total}`);
  console.log(`    Queued: ${statusCounts.queued}, Processing: ${statusCounts.processing}`);
  console.log(`    Completed: ${statusCounts.completed}, Failed: ${statusCounts.failed}`);

  if (total === 0) {
    pass('No video jobs to verify (empty collection)');
    return;
  }

  // Sanity: processing jobs should be a small fraction (no stale claims)
  const processingRatio = statusCounts.processing / total;
  if (processingRatio > 0.5 && total > 10) {
    fail('Processing ratio', `${(processingRatio * 100).toFixed(1)}% of jobs are stuck in processing`);
  } else {
    pass(`Processing ratio ${(processingRatio * 100).toFixed(1)}% is healthy`);
  }
}

// --- Check 3: Orphaned credit transactions ---

async function checkOrphanedTransactions() {
  console.log('\n[3/4] Orphaned credit transactions...');

  const balancesSnap = await db.collection('credit_balances').get();
  const userIds = new Set(balancesSnap.docs.map((d) => d.id));

  // Check via collection group query
  const txGroupSnap = await db.collectionGroup('credit_transactions').limit(500).get();

  let orphaned = 0;
  for (const txDoc of txGroupSnap.docs) {
    // Parent path: credit_balances/<userId>/credit_transactions/<txId>
    const parentPath = txDoc.ref.parent.parent?.id;
    if (parentPath && !userIds.has(parentPath)) {
      orphaned += 1;
    }
  }

  if (orphaned > 0) {
    fail('Orphaned transactions', `${orphaned} transactions have no parent credit_balance doc`);
  } else {
    pass(`No orphaned transactions in ${txGroupSnap.size} sampled`);
  }
}

// --- Check 4: DLQ entry validity ---

async function checkDlqEntries() {
  console.log('\n[4/4] DLQ entry validity...');

  const dlqSnap = await db.collection('video_job_dlq').get();
  if (dlqSnap.empty) {
    pass('No DLQ entries to verify (empty collection)');
    return;
  }

  let invalid = 0;
  let checked = 0;

  for (const dlqDoc of dlqSnap.docs) {
    const jobId = dlqDoc.data().jobId;
    if (!jobId) {
      fail(`DLQ ${dlqDoc.id}`, 'Missing jobId field');
      invalid += 1;
      continue;
    }

    const jobSnap = await db.collection('video_jobs').doc(jobId).get();
    if (!jobSnap.exists) {
      fail(`DLQ ${dlqDoc.id}`, `References non-existent job ${jobId}`);
      invalid += 1;
    }
    checked += 1;
  }

  if (invalid === 0) {
    pass(`${checked} DLQ entries reference valid jobs`);
  }
}

// --- Run all checks ---

console.log(`DR Smoke Test — ${isEmulator ? 'Emulator' : projectId}`);
console.log('='.repeat(50));

try {
  await checkCreditBalances();
  await checkVideoJobDistribution();
  await checkOrphanedTransactions();
  await checkDlqEntries();
} catch (error) {
  console.error('\nFATAL: Smoke test crashed:', error.message);
  process.exit(2);
}

console.log('\n' + '='.repeat(50));
if (failures > 0) {
  console.log(`RESULT: ${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log('RESULT: All checks PASSED');
  process.exit(0);
}
