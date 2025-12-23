#!/usr/bin/env node
/**
 * collect-input-prompts-only - CLI helper to dump un-optimized (user-input) prompts, ignoring outputs.
 *
 * Useful when you need to inspect every raw prompt stored in Firestore (optimized
 * history collection) or in a localStorage export, but only care about the input.
 * The script can target a single user, limit the number of documents processed,
 * and emit either JSON or CSV.
 *
 * Example usage:
 *   tsx --tsconfig server/tsconfig.json scripts/collect-input-prompts-only.ts \
 *     --output=reports/input-prompts.json \
 *     --limit=500 \
 *     --local-file=~/Downloads/promptHistory.json
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { initializeFirebaseAdmin, admin } from './migrations/firebase-admin-init.js';

type TimestampLike = admin.firestore.Timestamp | string | undefined;

interface ScriptOptions {
  userId?: string;
  batchSize: number;
  limit: number | null;
  output: string;
  format: 'json' | 'csv';
  localFile?: string;
  envFile?: string;
}

interface RawPromptEntry {
  source: 'firestore' | 'localStorage';
  id?: string;
  uuid?: string;
  userId?: string;
  timestamp?: string;
  mode?: string;
  input: string;
}

const argv = process.argv.slice(2);

function parseOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

const options: ScriptOptions = {
  userId: parseOption('userId'),
  batchSize: parseInt(parseOption('batch-size') ?? '500', 10),
  limit: parseOption('limit') ? parseInt(parseOption('limit') as string, 10) : null,
  output: parseOption('output') ?? 'input-prompts.json',
  format: (parseOption('format') as 'json' | 'csv') ?? 'json',
  localFile: parseOption('local-file'),
  envFile: parseOption('env-file'),
};

if (!options.batchSize || Number.isNaN(options.batchSize) || options.batchSize <= 0) {
  options.batchSize = 500;
}

if (options.limit !== null && (Number.isNaN(options.limit) || options.limit <= 0)) {
  options.limit = null;
}

if (options.format !== 'json' && options.format !== 'csv') {
  options.format = 'json';
}

dotenv.config({ path: options.envFile ?? '.env' });

function toIso(value: TimestampLike): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return undefined;
}

function buildEntryFromFirestore(doc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>): RawPromptEntry {
  const data = doc.data();
  const input = typeof data.input === 'string' ? data.input : typeof data.prompt === 'string' ? data.prompt : '';
  return {
    source: 'firestore',
    id: doc.id,
    uuid: typeof data.uuid === 'string' ? data.uuid : undefined,
    userId: typeof data.userId === 'string' ? data.userId : undefined,
    timestamp: toIso(data.timestamp),
    mode: typeof data.mode === 'string' ? data.mode : undefined,
    input: input.trim(),
  };
}

async function collectFromFirestore(opts: ScriptOptions): Promise<RawPromptEntry[]> {
  const db = initializeFirebaseAdmin();
  const entries: RawPromptEntry[] = [];
  let lastDoc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData> | null = null;
  let remaining = opts.limit;

  const baseCollection = db.collection('prompts');
  const filteredCollection = opts.userId
    ? baseCollection.where('userId', '==', opts.userId)
    : baseCollection;

  while (true) {
    const batchSize =
      remaining !== null ? Math.min(opts.batchSize, remaining) : opts.batchSize;
    let query = filteredCollection.orderBy('timestamp', 'desc').limit(batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    for (const doc of snapshot.docs) {
      entries.push(buildEntryFromFirestore(doc));
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (remaining !== null) {
      remaining -= snapshot.size;
      if (remaining <= 0) {
        break;
      }
    }
  }

  return remaining === null ? entries : entries.slice(0, opts.limit ?? entries.length);
}

function loadLocalStorageEntries(filePath: string): RawPromptEntry[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Local storage export not found at ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('Local storage export must be a JSON array');
  }

  return parsed.map((entry: Record<string, unknown>, index: number) => {
    const input =
      typeof entry.input === 'string'
        ? entry.input
        : typeof entry.prompt === 'string'
        ? entry.prompt
        : '';
    const timestamp =
      typeof entry.timestamp === 'string' ? entry.timestamp : undefined;

    return {
      source: 'localStorage' as const,
      id: entry.id ? String(entry.id) : `local-${index}`,
      uuid: typeof entry.uuid === 'string' ? entry.uuid : undefined,
      userId: typeof entry.userId === 'string' ? entry.userId : undefined,
      timestamp,
      mode: typeof entry.mode === 'string' ? entry.mode : undefined,
      input: input.trim(),
    };
  });
}

function writeJsonOutput(filePath: string, entries: RawPromptEntry[]): void {
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf8');
}

function toCsvLine(entry: RawPromptEntry): string {
  const escape = (value?: string): string => {
    if (value === undefined) return '';
    return `"${value.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
  };

  return [
    escape(entry.source),
    escape(entry.id),
    escape(entry.uuid),
    escape(entry.userId),
    escape(entry.timestamp),
    escape(entry.mode),
    escape(entry.input),
  ].join(',');
}

function writeCsvOutput(filePath: string, entries: RawPromptEntry[]): void {
  const header = 'source,id,uuid,userId,timestamp,mode,input';
  const lines = [header, ...entries.map(toCsvLine)];
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

async function main(): Promise<void> {
  console.log('Collecting input prompts...');
  console.log('Options:', JSON.stringify(options, null, 2));

  let entries: RawPromptEntry[];

  if (options.localFile) {
    console.log(`Reading from local file: ${options.localFile}`);
    entries = loadLocalStorageEntries(options.localFile);
  } else {
    console.log('Fetching from Firestore...');
    entries = await collectFromFirestore(options);
  }

  if (options.limit !== null && entries.length > options.limit) {
    entries = entries.slice(0, options.limit);
  }

  const outputPath = path.resolve(options.output);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (options.format === 'csv') {
    writeCsvOutput(outputPath, entries);
  } else {
    writeJsonOutput(outputPath, entries);
  }

  console.log(`Wrote ${entries.length} entries to ${outputPath}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});