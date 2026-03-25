#!/usr/bin/env node
/**
 * cleanup-prompts - Remove prompts with structured "subject: X, action: Y" format
 * and non-video prompts from both local files and Firestore.
 *
 * Usage:
 *   npx tsx scripts/cleanup-prompts.ts --dry-run
 *   npx tsx scripts/cleanup-prompts.ts --execute
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  initializeFirebaseAdmin,
  admin,
} from "./migrations/firebase-admin-init.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

interface PromptEntry {
  source: string;
  id: string;
  uuid?: string;
  userId?: string;
  timestamp?: string;
  mode?: string;
  input: string;
}

const STRUCTURED_FORMAT_PATTERN =
  /^(subject|action|location|event|time|mood|style|camera|lighting):\s*\w/i;

function hasStructuredFormat(input: string): boolean {
  // Check if input starts with or contains "subject: X, action: Y" style format
  // These are key-value pairs with labels like subject:, action:, event:, location:, etc.
  const normalizedInput = input.toLowerCase().trim();

  // Check for explicit key-value pattern at start
  if (STRUCTURED_FORMAT_PATTERN.test(normalizedInput)) {
    return true;
  }

  // Check for comma-separated key-value pairs
  const keyValuePairs = normalizedInput.split(",").map((s) => s.trim());
  const hasKeyValueFormat = keyValuePairs.some((pair) => {
    const match = pair.match(
      /^(subject|action|location|event|time|mood|style|camera|lighting):\s*.+/i,
    );
    return match !== null;
  });

  return hasKeyValueFormat;
}

function shouldRemovePrompt(entry: PromptEntry): {
  remove: boolean;
  reason: string;
} {
  // Remove non-video prompts
  if (entry.mode && entry.mode !== "video") {
    return { remove: true, reason: `non-video mode: ${entry.mode}` };
  }

  // Remove prompts with structured "subject: X, action: Y" format
  if (hasStructuredFormat(entry.input)) {
    return { remove: true, reason: "structured key-value format" };
  }

  return { remove: false, reason: "" };
}

async function cleanupLocalFile(
  filePath: string,
  dryRun: boolean,
): Promise<{ removed: number; kept: number; removedEntries: PromptEntry[] }> {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    console.log(`  ⚠ Local file not found: ${resolved}`);
    return { removed: 0, kept: 0, removedEntries: [] };
  }

  const raw = fs.readFileSync(resolved, "utf8");
  const entries: PromptEntry[] = JSON.parse(raw);

  const kept: PromptEntry[] = [];
  const removedEntries: PromptEntry[] = [];

  for (const entry of entries) {
    const { remove, reason } = shouldRemovePrompt(entry);
    if (remove) {
      removedEntries.push(entry);
      console.log(`  🗑  [${reason}] "${entry.input.substring(0, 60)}..."`);
    } else {
      kept.push(entry);
    }
  }

  if (!dryRun) {
    fs.writeFileSync(resolved, JSON.stringify(kept, null, 2), "utf8");
    console.log(`  ✓ Updated local file: ${resolved}`);
  }

  return { removed: removedEntries.length, kept: kept.length, removedEntries };
}

async function cleanupFirestore(
  removedEntries: PromptEntry[],
  dryRun: boolean,
): Promise<number> {
  const firestoreIds = removedEntries
    .filter((e) => e.source === "firestore" && e.id)
    .map((e) => e.id);

  if (firestoreIds.length === 0) {
    console.log("  ℹ No Firestore documents to remove");
    return 0;
  }

  if (dryRun) {
    console.log(
      `  ℹ Would delete ${firestoreIds.length} documents from Firestore`,
    );
    return firestoreIds.length;
  }

  const db = initializeFirebaseAdmin();
  const batch = db.batch();
  let deleteCount = 0;

  // Firestore batches are limited to 500 operations
  const batchSize = 500;
  for (let i = 0; i < firestoreIds.length; i += batchSize) {
    const chunk = firestoreIds.slice(i, i + batchSize);
    const chunkBatch = db.batch();

    for (const docId of chunk) {
      const docRef = db.collection("prompts").doc(docId);
      chunkBatch.delete(docRef);
      deleteCount++;
    }

    await chunkBatch.commit();
    console.log(`  ✓ Deleted batch of ${chunk.length} documents`);
  }

  return deleteCount;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || !args.includes("--execute");

  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log("║           PROMPT CLEANUP UTILITY                           ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
    console.log("   To execute changes, run with: --execute\n");
  } else {
    console.log("⚡ EXECUTE MODE - Changes will be permanent!\n");
  }

  console.log("Criteria for removal:");
  console.log('  • Non-video prompts (mode !== "video")');
  console.log('  • Structured format: "subject: X, action: Y, ..." style\n');

  // Clean local file
  const localFile = path.resolve(__dirname, "../input-prompts.json");
  console.log("━━━ Processing Local File ━━━");
  const localResult = await cleanupLocalFile(localFile, dryRun);

  // Clean Firestore
  console.log("\n━━━ Processing Firestore ━━━");
  const firestoreDeleted = await cleanupFirestore(
    localResult.removedEntries,
    dryRun,
  );

  // Summary
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log("║                      SUMMARY                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`  Local file:`);
  console.log(`    • Removed: ${localResult.removed}`);
  console.log(`    • Kept: ${localResult.kept}`);
  console.log(`  Firestore:`);
  console.log(
    `    • ${dryRun ? "Would delete" : "Deleted"}: ${firestoreDeleted}`,
  );

  if (dryRun) {
    console.log("\n💡 Run with --execute to apply these changes\n");
  } else {
    console.log("\n✅ Cleanup complete!\n");
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
