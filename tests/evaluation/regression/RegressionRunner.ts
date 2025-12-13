#!/usr/bin/env tsx

import { config as loadEnv } from 'dotenv';
loadEnv();

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { QUALITY_THRESHOLDS, METRIC_DIRECTIONS } from '../../ci/quality-thresholds.ts';
import { runSpanLabelingBenchmark } from '../../../scripts/evaluation/run-golden-set-evaluation.ts';
import { runSuggestionBenchmark } from '../suggestions/SuggestionBenchmark.ts';
import { runOptimizationBenchmark } from '../optimization/OptimizationBenchmark.ts';
import { cacheService } from '../../../server/src/services/cache/CacheService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASELINE_DIR = join(__dirname, '../baselines');
const BASELINES = {
  spanLabeling: join(BASELINE_DIR, 'span-labeling-baseline.json'),
  suggestions: join(BASELINE_DIR, 'suggestions-baseline.json'),
  optimization: join(BASELINE_DIR, 'optimization-baseline.json'),
};

function parseArgs() {
  const args = process.argv.slice(2);
  const updateBaseline = args.includes('--update-baseline');
  const ci = args.includes('--ci') || process.env.CI === 'true';
  const runsArg = args.find((a) => a.startsWith('--runs='));
  const runs = runsArg ? Math.max(1, parseInt(runsArg.split('=')[1] || '1', 10)) : 1;
  return { updateBaseline, ci, runs };
}

function loadBaseline(path: string): Record<string, number> | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    return raw.metrics || null;
  } catch {
    return null;
  }
}

function writeBaseline(
  path: string,
  payload: {
    runs?: number;
    metrics: Record<string, number>;
    stats?: Record<string, { mean: number; stdDev: number; min: number; max: number }>;
    perRun?: Array<Record<string, number>>;
  }
) {
  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runs: payload.runs,
        metrics: payload.metrics,
        stats: payload.stats,
        perRun: payload.perRun,
      },
      null,
      2
    )
  );
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

async function runMultiple<T>(fn: () => Promise<T>, runs: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < runs; i++) {
    // Avoid cross-run caching masking LLM variance/regressions.
    try {
      // eslint-disable-next-line no-await-in-loop
      await cacheService.flush();
    } catch {
      // ignore cache flush failures
    }
    // eslint-disable-next-line no-await-in-loop
    results.push(await fn());
  }
  return results;
}

function aggregateRuns(runs: Array<Record<string, number>>): {
  metrics: Record<string, number>;
  stats: Record<string, { mean: number; stdDev: number; min: number; max: number }>;
  perRun: Array<Record<string, number>>;
} {
  const keys = new Set(runs.flatMap((r) => Object.keys(r)));
  const metrics: Record<string, number> = {};
  const stats: Record<string, { mean: number; stdDev: number; min: number; max: number }> = {};
  for (const key of keys) {
    const values = runs.map((r) => r[key]).filter((v) => typeof v === 'number');
    if (values.length === 0) continue;
    metrics[key] = mean(values);
    stats[key] = {
      mean: metrics[key],
      stdDev: stdDev(values),
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }
  return { metrics, stats, perRun: runs };
}

function checkAbsolute(
  output: keyof typeof QUALITY_THRESHOLDS,
  current: Record<string, number>
): string[] {
  const failures: string[] = [];
  const t: any = QUALITY_THRESHOLDS[output];

  if (output === 'spanLabeling') {
    if (current.jsonValidityRate < t.jsonValidityRate) {
      failures.push(`jsonValidityRate ${current.jsonValidityRate.toFixed(3)} < ${t.jsonValidityRate}`);
    }
    if (current.safetyPassRate < t.safetyPassRate) {
      failures.push(`safetyPassRate ${current.safetyPassRate.toFixed(3)} < ${t.safetyPassRate}`);
    }
  }

  if (output === 'optimization') {
    if (current.intentPreservation < t.intentPreservation) {
      failures.push(`intentPreservation ${current.intentPreservation.toFixed(3)} < ${t.intentPreservation}`);
    }
  }

  return failures;
}

function compareToBaseline(
  output: keyof typeof QUALITY_THRESHOLDS,
  current: Record<string, number>,
  baseline: Record<string, number>
): string[] {
  const failures: string[] = [];
  const directions: any = METRIC_DIRECTIONS[output];
  const tolerance = (QUALITY_THRESHOLDS as any)[output].regressionTolerance;

  for (const [key, direction] of Object.entries(directions)) {
    const baseVal = baseline[key];
    const curVal = current[key];
    if (typeof baseVal !== 'number' || typeof curVal !== 'number') continue;

    if (direction === 'up') {
      if (curVal < baseVal - tolerance) {
        failures.push(`${key} regressed: ${curVal.toFixed(3)} < ${baseVal.toFixed(3)} - ${tolerance}`);
      }
    } else {
      if (curVal > baseVal + tolerance) {
        failures.push(`${key} regressed: ${curVal.toFixed(3)} > ${baseVal.toFixed(3)} + ${tolerance}`);
      }
    }
  }

  return failures;
}

export async function runRegression({ runs = 1, updateBaseline = false, ci = false } = {}) {
  // Span labeling
  const spanRuns = await runMultiple(async () => {
    const { metrics } = await runSpanLabelingBenchmark({ runs: 1 });
    return {
      jsonValidityRate: metrics.jsonValidityRate,
      safetyPassRate: metrics.safetyPassRate,
      relaxedF1: metrics.relaxedF1,
      taxonomyAccuracy: metrics.taxonomyAccuracy,
      fragmentationRate: metrics.fragmentation?.rate ?? 0,
      overExtractionRate: metrics.overExtraction?.rate ?? 0,
    };
  }, runs);
  const spanAgg = aggregateRuns(spanRuns);
  const spanCurrent = spanAgg.metrics;

  // Suggestions
  const suggRuns = await runMultiple(async () => {
    const { suiteMetrics } = await runSuggestionBenchmark();
    return suiteMetrics as Record<string, number>;
  }, runs);
  const suggAgg = aggregateRuns(suggRuns as any);
  const suggCurrent = suggAgg.metrics;

  // Optimization
  const optRuns = await runMultiple(async () => {
    const { suiteMetrics } = await runOptimizationBenchmark();
    return suiteMetrics as Record<string, number>;
  }, runs);
  const optAgg = aggregateRuns(optRuns as any);
  const optCurrent = optAgg.metrics;

  const outputs = [
    {
      key: 'spanLabeling' as const,
      current: spanCurrent,
      stats: spanAgg.stats,
      perRun: spanAgg.perRun,
      baselinePath: BASELINES.spanLabeling,
    },
    {
      key: 'suggestions' as const,
      current: suggCurrent,
      stats: suggAgg.stats,
      perRun: suggAgg.perRun,
      baselinePath: BASELINES.suggestions,
    },
    {
      key: 'optimization' as const,
      current: optCurrent,
      stats: optAgg.stats,
      perRun: optAgg.perRun,
      baselinePath: BASELINES.optimization,
    },
  ];

  const failures: string[] = [];

  for (const o of outputs) {
    const baseline = loadBaseline(o.baselinePath);
    if (baseline) {
      failures.push(...compareToBaseline(o.key, o.current, baseline));
    } else if (ci && !updateBaseline) {
      failures.push(`${o.key}: missing baseline at ${o.baselinePath}`);
    }

    failures.push(...checkAbsolute(o.key, o.current));

    if (updateBaseline) {
      writeBaseline(o.baselinePath, {
        runs,
        metrics: o.current,
        stats: o.stats,
        perRun: o.perRun,
      });
    }
  }

  return {
    failures,
    currents: { spanCurrent, suggCurrent, optCurrent },
    stats: { span: spanAgg.stats, suggestions: suggAgg.stats, optimization: optAgg.stats },
  };
}

async function main() {
  const { updateBaseline, ci, runs } = parseArgs();
  const { failures, currents, stats } = await runRegression({ runs, updateBaseline, ci });

  console.log('\n=== QUALITY REGRESSION REPORT ===\n');
  console.log('Current metrics:');
  console.log(JSON.stringify(currents, null, 2));
  if (runs > 1) {
    console.log('\nRun-to-run variance (stdDev):');
    console.log(JSON.stringify(stats, null, 2));
  }

  if (updateBaseline) {
    console.log('\nBaselines updated.');
    process.exit(0);
  }

  if (failures.length === 0) {
    console.log('\n✅ Quality gate passed.');
    process.exit(0);
  }

  console.error('\n❌ Quality gate failed:');
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
