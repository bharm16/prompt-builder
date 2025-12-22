#!/usr/bin/env tsx

/**
 * Snapshot Comparison Script
 * 
 * Compares current span labeling results against baseline.
 * Detects regressions and improvements.
 * 
 * Usage:
 *   npx tsx scripts/evaluation/compare-snapshots.ts
 *   npx tsx scripts/evaluation/compare-snapshots.ts --current path --baseline path
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SNAPSHOTS_DIR = join(__dirname, 'snapshots');

interface Snapshot {
  timestamp: string;
  promptCount: number;
  sourceFile: string;
  results: Array<{
    promptId: string;
    input: string;
    spanCount: number;
    judgeResult: {
      scores: {
        coverage: number;
        precision: number;
        granularity: number;
        taxonomy: number;
        technicalSpecs: number;
      };
      totalScore: number;
    } | null;
    error: string | null;
  }>;
  summary: {
    avgScore: number;
    avgSpanCount: number;
    scoreDistribution: Record<string, number>;
    commonMissedElements: string[];
    commonIncorrectExtractions: string[];
    errorCount: number;
  };
}

interface Comparison {
  baseline: Snapshot;
  current: Snapshot;
  scoreDelta: number;
  spanCountDelta: number;
  regressions: Array<{
    promptId: string;
    input: string;
    baselineScore: number;
    currentScore: number;
    delta: number;
  }>;
  improvements: Array<{
    promptId: string;
    input: string;
    baselineScore: number;
    currentScore: number;
    delta: number;
  }>;
  newErrors: string[];
  fixedErrors: string[];
  categoryDeltas: Record<string, number>;
}

function loadSnapshot(path: string): Snapshot {
  if (!existsSync(path)) {
    throw new Error(`Snapshot not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function compareSnapshots(baseline: Snapshot, current: Snapshot): Comparison {
  // Build lookup maps
  const baselineMap = new Map(baseline.results.map(r => [r.promptId, r]));
  const currentMap = new Map(current.results.map(r => [r.promptId, r]));

  const regressions: Comparison['regressions'] = [];
  const improvements: Comparison['improvements'] = [];
  const newErrors: string[] = [];
  const fixedErrors: string[] = [];

  // Compare matching prompts
  for (const [promptId, baseResult] of baselineMap) {
    const currResult = currentMap.get(promptId);
    if (!currResult) continue;

    const baseScore = baseResult.judgeResult?.totalScore || 0;
    const currScore = currResult.judgeResult?.totalScore || 0;
    const delta = currScore - baseScore;

    if (delta <= -3) {
      regressions.push({
        promptId,
        input: baseResult.input,
        baselineScore: baseScore,
        currentScore: currScore,
        delta
      });
    } else if (delta >= 3) {
      improvements.push({
        promptId,
        input: baseResult.input,
        baselineScore: baseScore,
        currentScore: currScore,
        delta
      });
    }

    // Track error changes
    if (!baseResult.error && currResult.error) {
      newErrors.push(`${promptId}: ${currResult.error}`);
    } else if (baseResult.error && !currResult.error) {
      fixedErrors.push(promptId);
    }
  }

  // Sort by magnitude
  regressions.sort((a, b) => a.delta - b.delta);
  improvements.sort((a, b) => b.delta - a.delta);

  // Category-level deltas
  const categoryDeltas: Record<string, number> = {};
  const categories = ['coverage', 'precision', 'granularity', 'taxonomy', 'technicalSpecs'];
  
  for (const cat of categories) {
    let baseSum = 0, currSum = 0, count = 0;
    
    for (const [promptId, baseResult] of baselineMap) {
      const currResult = currentMap.get(promptId);
      if (!currResult) continue;
      
      const baseScore = (baseResult.judgeResult?.scores as any)?.[cat] || 0;
      const currScore = (currResult.judgeResult?.scores as any)?.[cat] || 0;
      
      if (baseScore > 0 || currScore > 0) {
        baseSum += baseScore;
        currSum += currScore;
        count++;
      }
    }

    if (count > 0) {
      categoryDeltas[cat] = (currSum - baseSum) / count;
    }
  }

  return {
    baseline,
    current,
    scoreDelta: current.summary.avgScore - baseline.summary.avgScore,
    spanCountDelta: current.summary.avgSpanCount - baseline.summary.avgSpanCount,
    regressions,
    improvements,
    newErrors,
    fixedErrors,
    categoryDeltas
  };
}

function printComparison(comp: Comparison): void {
  console.log('\n' + '='.repeat(80));
  console.log('  SPAN LABELING REGRESSION REPORT');
  console.log('='.repeat(80));
  console.log();

  console.log('📅 COMPARISON:');
  console.log(`  Baseline: ${comp.baseline.timestamp} (${comp.baseline.promptCount} prompts)`);
  console.log(`  Current:  ${comp.current.timestamp} (${comp.current.promptCount} prompts)`);
  console.log();

  // Overall delta
  const scoreDeltaStr = comp.scoreDelta >= 0 ? `+${comp.scoreDelta.toFixed(2)}` : comp.scoreDelta.toFixed(2);
  const spanDeltaStr = comp.spanCountDelta >= 0 ? `+${comp.spanCountDelta.toFixed(2)}` : comp.spanCountDelta.toFixed(2);
  
  console.log('📊 OVERALL CHANGE:');
  console.log(`  Average Score:      ${comp.baseline.summary.avgScore.toFixed(2)} → ${comp.current.summary.avgScore.toFixed(2)} (${scoreDeltaStr})`);
  console.log(`  Average Span Count: ${comp.baseline.summary.avgSpanCount.toFixed(2)} → ${comp.current.summary.avgSpanCount.toFixed(2)} (${spanDeltaStr})`);
  console.log();

  // Category deltas
  console.log('📈 BY CATEGORY:');
  for (const [cat, delta] of Object.entries(comp.categoryDeltas)) {
    const deltaStr = delta >= 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3);
    const indicator = delta > 0.1 ? '✅' : delta < -0.1 ? '❌' : '➖';
    console.log(`  ${indicator} ${cat.padEnd(15)} ${deltaStr}`);
  }
  console.log();

  // Regressions
  if (comp.regressions.length > 0) {
    console.log(`❌ REGRESSIONS (${comp.regressions.length} prompts got worse by 3+ points):`);
    for (const r of comp.regressions.slice(0, 5)) {
      console.log(`  [${r.baselineScore}→${r.currentScore}] "${r.input.slice(0, 50)}..."`);
    }
    if (comp.regressions.length > 5) {
      console.log(`  ... and ${comp.regressions.length - 5} more`);
    }
    console.log();
  }

  // Improvements
  if (comp.improvements.length > 0) {
    console.log(`✅ IMPROVEMENTS (${comp.improvements.length} prompts got better by 3+ points):`);
    for (const r of comp.improvements.slice(0, 5)) {
      console.log(`  [${r.baselineScore}→${r.currentScore}] "${r.input.slice(0, 50)}..."`);
    }
    if (comp.improvements.length > 5) {
      console.log(`  ... and ${comp.improvements.length - 5} more`);
    }
    console.log();
  }

  // Error changes
  if (comp.newErrors.length > 0) {
    console.log(`🔴 NEW ERRORS (${comp.newErrors.length}):`);
    for (const e of comp.newErrors.slice(0, 3)) {
      console.log(`  - ${e.slice(0, 80)}`);
    }
    console.log();
  }

  if (comp.fixedErrors.length > 0) {
    console.log(`🟢 FIXED ERRORS (${comp.fixedErrors.length}):`);
    for (const e of comp.fixedErrors.slice(0, 3)) {
      console.log(`  - ${e}`);
    }
    console.log();
  }

  // Verdict
  console.log('='.repeat(80));
  if (comp.scoreDelta >= 0 && comp.regressions.length === 0 && comp.newErrors.length === 0) {
    console.log('✅ NO REGRESSIONS DETECTED - SAFE TO DEPLOY');
  } else if (comp.regressions.length > 0) {
    console.log(`⚠️  ${comp.regressions.length} REGRESSIONS DETECTED - REVIEW BEFORE DEPLOY`);
  } else if (comp.newErrors.length > 0) {
    console.log(`⚠️  ${comp.newErrors.length} NEW ERRORS - REVIEW BEFORE DEPLOY`);
  } else if (comp.scoreDelta < -0.5) {
    console.log('⚠️  AVERAGE SCORE DECREASED - REVIEW BEFORE DEPLOY');
  } else {
    console.log('✅ MINOR CHANGES - LIKELY SAFE TO DEPLOY');
  }
  console.log('='.repeat(80));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let baselinePath = join(SNAPSHOTS_DIR, 'baseline.json');
  let currentPath = join(SNAPSHOTS_DIR, 'latest.json');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--baseline' && args[i + 1]) {
      baselinePath = args[++i];
    } else if (args[i] === '--current' && args[i + 1]) {
      currentPath = args[++i];
    }
  }

  if (!existsSync(baselinePath)) {
    console.error(`Baseline not found: ${baselinePath}`);
    console.error('Run evaluation with --baseline flag first to create a baseline.');
    process.exit(1);
  }

  if (!existsSync(currentPath)) {
    console.error(`Current snapshot not found: ${currentPath}`);
    console.error('Run evaluation first to create a snapshot.');
    process.exit(1);
  }

  const baseline = loadSnapshot(baselinePath);
  const current = loadSnapshot(currentPath);
  
  const comparison = compareSnapshots(baseline, current);
  printComparison(comparison);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
