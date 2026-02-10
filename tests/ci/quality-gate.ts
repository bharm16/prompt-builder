#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';

interface SnapshotSummary {
  avgScore: number;
}

interface SnapshotResult {
  promptId: string;
  judgeResult?: {
    totalScore?: number;
  };
}

interface Snapshot {
  summary: SnapshotSummary;
  results: SnapshotResult[];
}

const snapshotsDir = join(process.cwd(), 'scripts/evaluation/snapshots');
const baselinePath = join(snapshotsDir, 'baseline.json');
const latestPath = join(snapshotsDir, 'latest.json');

loadEnv();

const sampleSize = Number.parseInt(process.env.QUALITY_GATE_SAMPLE_SIZE || '25', 10);
const maxScoreDrop = Number.parseFloat(process.env.QUALITY_GATE_MAX_SCORE_DROP || '0.5');
const minCurrentScore = Number.parseFloat(process.env.QUALITY_GATE_MIN_SCORE || '15');
const maxHardRegressions = Number.parseInt(process.env.QUALITY_GATE_MAX_HARD_REGRESSIONS || '0', 10);

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (typeof result.status === 'number' && result.status === 0) {
    return;
  }

  process.exit(typeof result.status === 'number' ? result.status : 1);
}

function loadSnapshot(path: string): Snapshot {
  if (!existsSync(path)) {
    throw new Error(`Snapshot file not found: ${path}`);
  }

  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as Snapshot;
}

function getScore(result: SnapshotResult | undefined): number {
  return result?.judgeResult?.totalScore ?? 0;
}

function countHardRegressions(baseline: Snapshot, latest: Snapshot): number {
  const baselineByPromptId = new Map(baseline.results.map((result) => [result.promptId, result]));
  let hardRegressions = 0;

  for (const latestResult of latest.results) {
    const baselineResult = baselineByPromptId.get(latestResult.promptId);
    if (!baselineResult) {
      continue;
    }

    const delta = getScore(latestResult) - getScore(baselineResult);
    if (delta <= -3) {
      hardRegressions += 1;
    }
  }

  return hardRegressions;
}

function fail(message: string): never {
  console.error(`\n❌ Quality gate failed: ${message}`);
  process.exit(1);
}

function main(): void {
  if (!process.env.OPENAI_API_KEY) {
    fail('OPENAI_API_KEY is required for judge-based quality gate evaluation.');
  }

  if (!existsSync(baselinePath)) {
    fail(`Baseline snapshot missing at ${baselinePath}. Generate and lock a baseline first.`);
  }

  console.log('Running span-labeling evaluation for quality gate...');
  run('tsx', [
    'scripts/evaluation/span-labeling-evaluation.ts',
    '--fast',
    '--sample',
    String(sampleSize),
  ]);

  const baseline = loadSnapshot(baselinePath);
  const latest = loadSnapshot(latestPath);

  const baselineScore = baseline.summary.avgScore;
  const latestScore = latest.summary.avgScore;
  const scoreDelta = latestScore - baselineScore;
  const hardRegressions = countHardRegressions(baseline, latest);

  console.log('\nQuality Gate Summary');
  console.log(`- Baseline average score: ${baselineScore.toFixed(2)}`);
  console.log(`- Latest average score: ${latestScore.toFixed(2)}`);
  console.log(`- Delta: ${scoreDelta.toFixed(2)}`);
  console.log(`- Hard regressions (>=3 points): ${hardRegressions}`);

  if (latestScore < minCurrentScore) {
    fail(
      `Average score ${latestScore.toFixed(2)} is below minimum threshold ${minCurrentScore.toFixed(2)}.`
    );
  }

  if (scoreDelta < -Math.abs(maxScoreDrop)) {
    fail(
      `Average score regression ${scoreDelta.toFixed(2)} exceeds allowed drop ${Math.abs(maxScoreDrop).toFixed(2)}.`
    );
  }

  if (hardRegressions > Math.max(0, maxHardRegressions)) {
    fail(
      `Found ${hardRegressions} hard regressions, above allowed maximum ${Math.max(0, maxHardRegressions)}.`
    );
  }

  console.log('\n✅ Quality gate passed.');
}

main();
