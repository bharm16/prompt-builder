#!/usr/bin/env node

/**
 * Force Highlight Rerender Migration
 * 
 * This script forces all existing prompts to regenerate their highlights
 * by clearing the highlightCache field. This is useful when:
 * - You've updated the span labeling algorithm
 * - You've changed the highlighting model
 * - You want to apply new labeling templates to existing prompts
 * 
 * Similar to how updating the cache model (templateVersion) forces rerenders,
 * this script invalidates all cached highlights so they will be regenerated
 * on next load or via the backfill script.
 * 
 * Usage:
 *   node scripts/migrations/force-highlight-rerender.js [options]
 * 
 * Options:
 *   --dry-run              Preview changes without writing to Firestore
 *   --userId=USER_ID       Process only prompts for a specific user
 *   --batch-size=N         Number of documents to process in parallel (default: 10)
 *   --limit=N              Maximum number of documents to process (for testing)
 *   --mode=clear|regenerate Clear cache only or regenerate immediately (default: clear)
 * 
 * Modes:
 *   clear        - Clears highlightCache, forces rerender on next load
 *   regenerate   - Clears and immediately regenerates highlights (takes longer)
 * 
 * Examples:
 *   # Dry run to see what would be updated
 *   node scripts/migrations/force-highlight-rerender.js --dry-run
 * 
 *   # Clear highlight cache for all prompts (fast)
 *   node scripts/migrations/force-highlight-rerender.js --mode=clear
 * 
 *   # Clear and regenerate highlights for all prompts (slower but complete)
 *   node scripts/migrations/force-highlight-rerender.js --mode=regenerate
 * 
 *   # Process prompts for specific user
 *   node scripts/migrations/force-highlight-rerender.js --userId=abc123 --mode=clear
 * 
 *   # Test on 10 documents first
 *   node scripts/migrations/force-highlight-rerender.js --limit=10 --dry-run
 */

import { initializeFirebaseAdmin, admin } from './firebase-admin-init.js';
import { labelSpans } from '../../server/src/llm/span-labeling/SpanLabelingService.js';
import crypto from 'crypto';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  userId: args.find(arg => arg.startsWith('--userId='))?.split('=')[1],
  batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 10,
  limit: parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null,
  mode: args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'clear',
};

// Validate mode
if (!['clear', 'regenerate'].includes(options.mode)) {
  console.error('❌ Invalid mode. Must be "clear" or "regenerate"');
  process.exit(1);
}

// Statistics tracking
const stats = {
  total: 0,
  processed: 0,
  cleared: 0,
  regenerated: 0,
  skipped: 0,
  errors: 0,
  noCache: 0,
  failedDocs: [],
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
 * Generate new highlight cache for a prompt text
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
  
  // Skip if no existing highlightCache
  if (!data.highlightCache) {
    stats.noCache++;
    stats.skipped++;
    return { 
      status: 'skipped', 
      reason: 'no-cache',
      mode: data.mode,
      charCount: 0,
      processingTime: 0,
    };
  }

  // Get prompt text for mode=regenerate
  const promptText = data.output || data.optimizedPrompt || data.prompt;
  
  if (options.mode === 'regenerate') {
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
  }

  try {
    const updatePayload = {};
    let newSpansCount = 0;
    let newSignature = null;

    if (options.mode === 'regenerate') {
      // Generate new highlights
      const highlightCache = await generateHighlightCache(promptText);
      updatePayload.highlightCache = highlightCache;
      newSpansCount = highlightCache.spans.length;
      newSignature = highlightCache.signature;
      stats.regenerated++;
    } else {
      // Just clear the cache
      updatePayload.highlightCache = admin.firestore.FieldValue.delete();
      stats.cleared++;
    }

    // Add version entry
    const versionEntry = {
      versionId: `rerender-${options.mode}-${Date.now()}`,
      signature: newSignature,
      spansCount: newSpansCount,
      action: options.mode === 'regenerate' ? 'regenerated' : 'cleared',
      timestamp: new Date().toISOString(),
    };
    updatePayload.versions = admin.firestore.FieldValue.arrayUnion(versionEntry);

    // Update document
    if (!options.dryRun) {
      await db.collection('prompts').doc(docId).update(updatePayload);
    }

    const processingTime = (Date.now() - startTime) / 1000;
    stats.totalProcessingTime += processingTime;
    
    return {
      status: options.mode === 'regenerate' ? 'regenerated' : 'cleared',
      spansCount: newSpansCount,
      signature: newSignature,
      mode: data.mode,
      charCount: promptText?.length || 0,
      processingTime,
    };
  } catch (error) {
    const processingTime = (Date.now() - startTime) / 1000;
    stats.errors++;
    stats.failedDocs.push({
      id: docId,
      mode: data.mode,
      error: error.message,
      charCount: promptText?.length || 0,
    });
    
    return {
      status: 'error',
      error: error.message,
      mode: data.mode,
      charCount: promptText?.length || 0,
      processingTime,
    };
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('\n🔧 Force Highlight Rerender Migration\n');
  console.log('Configuration:');
  console.log(`  Mode: ${options.mode.toUpperCase()}`);
  console.log(`  Dry Run: ${options.dryRun ? '✓ YES (no changes will be made)' : '✗ NO (will update Firestore)'}`);
  console.log(`  User Filter: ${options.userId || 'ALL USERS'}`);
  console.log(`  Batch Size: ${options.batchSize}`);
  console.log(`  Limit: ${options.limit || 'NONE'}`);
  console.log('');

  if (options.mode === 'clear') {
    console.log('ℹ️  Clear mode: Will remove highlightCache to force rerender on next load');
  } else {
    console.log('ℹ️  Regenerate mode: Will immediately generate new highlights (may take longer)');
  }
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
      
      const progress = Math.round(((i + 1) / stats.total) * 100);
      const result = await processDocument(doc, db);
      stats.processed++;
      
      // Calculate statistics
      const elapsedMinutes = (Date.now() - stats.startTime) / 1000 / 60;
      const docsPerMinute = stats.processed / elapsedMinutes;
      const remainingDocs = stats.total - stats.processed;
      const estimatedMinutesRemaining = remainingDocs / docsPerMinute;
      
      if (result.status === 'regenerated' || result.status === 'cleared') {
        console.log(
          `[${i + 1}/${stats.total}] (${progress}%) ${doc.id.slice(0, 8)} (${result.mode || 'unknown'}, ${result.charCount} chars)`
        );
        if (result.status === 'regenerated') {
          console.log(`  ✓ Regenerated ${result.spansCount} spans in ${result.processingTime.toFixed(1)}s`);
        } else {
          console.log(`  ✓ Cleared cache in ${result.processingTime.toFixed(3)}s`);
        }
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
    const avgTimePerDoc = (stats.cleared + stats.regenerated) > 0 
      ? stats.totalProcessingTime / (stats.cleared + stats.regenerated) 
      : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total documents found:        ${stats.total}`);
    console.log(`Documents processed:          ${stats.processed}`);
    if (options.mode === 'clear') {
      console.log(`Caches cleared:               ${stats.cleared} ✓`);
    } else {
      console.log(`Highlights regenerated:       ${stats.regenerated} ✓`);
    }
    console.log(`Documents skipped:            ${stats.skipped}`);
    console.log(`  - No existing cache:        ${stats.noCache}`);
    console.log(`  - No prompt text:           ${stats.skipped - stats.noCache}`);
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
      const actionWord = options.mode === 'clear' ? 'cleared' : 'regenerated';
      const count = options.mode === 'clear' ? stats.cleared : stats.regenerated;
      console.log(`\n✓ Migration completed! ${count} documents ${actionWord}, ${stats.errors} failed.\n`);
      
      if (options.mode === 'clear') {
        console.log('💡 Next steps:');
        console.log('   - Highlights will be regenerated automatically when prompts are loaded');
        console.log('   - Or run: node scripts/migrations/backfill-highlight-cache.js\n');
      }
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


