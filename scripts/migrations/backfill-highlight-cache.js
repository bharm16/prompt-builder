#!/usr/bin/env node

/**
 * Firestore Highlight Cache Backfill Migration
 * 
 * This script generates and saves highlight cache data for existing prompt documents
 * that don't have highlightCache populated.
 * 
 * Usage:
 *   node scripts/migrations/backfill-highlight-cache.js [options]
 * 
 * Options:
 *   --dry-run              Preview changes without writing to Firestore
 *   --userId=USER_ID       Process only prompts for a specific user
 *   --batch-size=N         Number of documents to process in parallel (default: 5)
 *   --limit=N              Maximum number of documents to process (for testing)
 * 
 * Examples:
 *   # Dry run to see what would be updated
 *   node scripts/migrations/backfill-highlight-cache.js --dry-run
 * 
 *   # Process all prompts
 *   node scripts/migrations/backfill-highlight-cache.js
 * 
 *   # Process prompts for specific user
 *   node scripts/migrations/backfill-highlight-cache.js --userId=abc123
 * 
 *   # Process only 10 documents (testing)
 *   node scripts/migrations/backfill-highlight-cache.js --limit=10 --dry-run
 */

import { initializeFirebaseAdmin, admin } from './firebase-admin-init.js';
import { labelSpans } from '../../server/src/llm/span-labeling/SpanLabelingService.js';
import crypto from 'crypto';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  userId: args.find(arg => arg.startsWith('--userId='))?.split('=')[1],
  batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 5,
  limit: parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null,
};

// Statistics tracking
const stats = {
  total: 0,
  processed: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  alreadyHasCache: 0,
  failedDocs: [], // Track failed documents with details
  startTime: null,
  totalProcessingTime: 0,
};

/**
 * Generate hash signature for text (matches client-side implementation)
 */
function hashString(str) {
  if (typeof str !== 'string') return '';
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Generate highlight cache for a prompt text
 */
async function generateHighlightCache(text) {
  const result = await labelSpans({
    text,
    maxSpans: 60,
    minConfidence: 0.5,
    policy: { nonTechnicalWordLimit: 6, allowOverlap: false },
    templateVersion: 'v1',
  });

  const signature = hashString(text);

  return {
    spans: result.spans || [],
    meta: result.meta || null,
    signature,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Process a single document
 */
async function processDocument(doc, db) {
  const startTime = Date.now();
  const docId = doc.id;
  const data = doc.data();
  
  // Skip if already has highlightCache
  if (data.highlightCache) {
    stats.alreadyHasCache++;
    stats.skipped++;
    return { 
      status: 'skipped', 
      reason: 'already-has-cache',
      mode: data.mode,
      charCount: 0,
      processingTime: 0,
    };
  }

  // Skip if no output text
  const promptText = data.output || data.optimizedPrompt || data.prompt;
  if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
    stats.skipped++;
    return { 
      status: 'skipped', 
      reason: 'no-prompt-text',
      mode: data.mode,
      charCount: 0,
      processingTime: 0,
    };
  }

  try {
    // Generate highlight cache
    const highlightCache = await generateHighlightCache(promptText);
    
    const versionEntry = {
      versionId: `migration-v-${Date.now()}`,
      signature: highlightCache.signature,
      spansCount: highlightCache.spans.length,
      timestamp: new Date().toISOString(),
    };

    // Update document
    if (!options.dryRun) {
      await db.collection('prompts').doc(docId).update({
        highlightCache,
        versions: admin.firestore.FieldValue.arrayUnion(versionEntry),
      });
    }

    const processingTime = (Date.now() - startTime) / 1000;
    stats.updated++;
    stats.totalProcessingTime += processingTime;
    
    return {
      status: 'updated',
      spansCount: highlightCache.spans.length,
      signature: highlightCache.signature,
      mode: data.mode,
      charCount: promptText.length,
      processingTime,
    };
  } catch (error) {
    const processingTime = (Date.now() - startTime) / 1000;
    stats.errors++;
    stats.failedDocs.push({
      id: docId,
      mode: data.mode,
      error: error.message,
      charCount: promptText.length,
    });
    
    return {
      status: 'error',
      error: error.message,
      mode: data.mode,
      charCount: promptText.length,
      processingTime,
    };
  }
}

/**
 * Process documents in batches
 */
async function processBatch(docs, db) {
  const batchPromises = [];
  
  for (let i = 0; i < docs.length; i += options.batchSize) {
    const batch = docs.slice(i, i + options.batchSize);
    const batchResults = await Promise.all(
      batch.map(doc => processDocument(doc, db))
    );
    
    batchPromises.push(...batchResults);
  }
  
  return batchPromises;
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('\n🔧 Firestore Highlight Cache Backfill Migration\n');
  console.log('Configuration:');
  console.log(`  Dry Run: ${options.dryRun ? '✓ YES (no changes will be made)' : '✗ NO (will update Firestore)'}`);
  console.log(`  User Filter: ${options.userId || 'ALL USERS'}`);
  console.log(`  Batch Size: ${options.batchSize}`);
  console.log(`  Limit: ${options.limit || 'NONE'}`);
  console.log('');

  const db = initializeFirebaseAdmin();

  try {
    // Build query
    let query = db.collection('prompts');
    
    if (options.userId) {
      query = query.where('userId', '==', options.userId);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }

    // Fetch documents
    console.log('📥 Fetching documents from Firestore...');
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('⚠️  No documents found matching criteria.\n');
      return;
    }

    stats.total = snapshot.size;
    console.log(`✓ Found ${stats.total} document(s)\n`);

    // Process documents
    console.log('🔄 Processing documents...\n');
    const docs = snapshot.docs;
    stats.startTime = Date.now();
    
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const data = doc.data();
      
      const progress = Math.round(((i + 1) / stats.total) * 100);
      const result = await processDocument(doc, db);
      stats.processed++;
      
      // Calculate statistics
      const elapsedMinutes = (Date.now() - stats.startTime) / 1000 / 60;
      const docsPerMinute = stats.processed / elapsedMinutes;
      const remainingDocs = stats.total - stats.processed;
      const estimatedMinutesRemaining = remainingDocs / docsPerMinute;
      
      if (result.status === 'updated') {
        console.log(
          `[${i + 1}/${stats.total}] (${progress}%) ${doc.id.slice(0, 8)} (${result.mode || 'unknown'}, ${result.charCount} chars)`
        );
        console.log(`  ✓ ${result.spansCount} spans in ${result.processingTime.toFixed(1)}s`);
        if (i < docs.length - 1) {
          console.log(`  Speed: ${docsPerMinute.toFixed(1)} docs/min | ETA: ${estimatedMinutesRemaining.toFixed(1)} min\n`);
        }
      } else if (result.status === 'skipped') {
        // Silent skip
      } else if (result.status === 'error') {
        console.log(
          `[${i + 1}/${stats.total}] (${progress}%) ${doc.id.slice(0, 8)} (${result.mode || 'unknown'}, ${result.charCount} chars)`
        );
        console.log(`  ✗ Failed: ${result.error}\n`);
      }
    }

    // Print summary
    const totalTime = (Date.now() - stats.startTime) / 1000 / 60;
    const avgTimePerDoc = stats.updated > 0 ? stats.totalProcessingTime / stats.updated : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total documents found:        ${stats.total}`);
    console.log(`Documents processed:          ${stats.processed}`);
    console.log(`Documents updated:            ${stats.updated} ✓`);
    console.log(`Documents skipped:            ${stats.skipped}`);
    console.log(`  - Already had cache:        ${stats.alreadyHasCache}`);
    console.log(`  - No prompt text:           ${stats.skipped - stats.alreadyHasCache}`);
    console.log(`Errors:                       ${stats.errors} ${stats.errors > 0 ? '✗' : ''}`);
    console.log('');
    console.log(`Total time:                   ${totalTime.toFixed(1)} minutes`);
    console.log(`Average time per document:    ${avgTimePerDoc.toFixed(1)}s`);
    console.log('='.repeat(60));

    // Show failed documents if any
    if (stats.failedDocs.length > 0) {
      console.log('\n❌ Failed Documents:');
      stats.failedDocs.forEach(doc => {
        console.log(`  - ${doc.id.slice(0, 8)} (${doc.mode || 'unknown'}): ${doc.error}`);
      });
      console.log('');
    }

    if (options.dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were made to Firestore');
      console.log('Run without --dry-run to apply changes.\n');
    } else {
      console.log(`\n✓ Migration completed! ${stats.updated} documents updated, ${stats.errors} failed.\n`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
