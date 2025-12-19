#!/usr/bin/env tsx

/**
 * Golden Set Evaluation Script
 * 
 * PDF Section 4.2: Offline Evaluation
 * 
 * This script runs the span labeling system against the golden dataset
 * and calculates all target metrics:
 * - JSON Validity Rate (target: >99.5%)
 * - Relaxed F1 (target: >0.85)
 * - Taxonomy Accuracy (target: >90%)
 * - Safety Pass Rate (target: 100%)
 * 
 * Usage:
 *   npx tsx scripts/evaluation/run-golden-set-evaluation.ts
 * 
 * Prerequisites:
 *   - Golden dataset files in server/src/llm/span-labeling/evaluation/golden-set/
 *   - AI service configured with valid API keys
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RelaxedF1Evaluator } from '../../server/src/llm/span-labeling/evaluation/RelaxedF1Evaluator.js';
import { labelSpans } from '../../server/src/llm/span-labeling/SpanLabelingService.ts';
import { AIModelService } from '../../server/src/services/ai-model/AIModelService.ts';
import { OpenAICompatibleAdapter } from '../../server/src/clients/adapters/OpenAICompatibleAdapter.ts';
import { GeminiAdapter } from '../../server/src/clients/adapters/GeminiAdapter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Golden dataset paths
const GOLDEN_SET_DIR = join(__dirname, '../../server/src/llm/span-labeling/evaluation/golden-set');

function findAllOccurrences(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const starts: number[] = [];
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    starts.push(idx);
    idx = haystack.indexOf(needle, idx + Math.max(1, needle.length));
  }
  return starts;
}

function computeSpanIndices(
  promptId: string,
  promptText: string,
  spanText: string,
  occurrence?: number
): { start: number; end: number } {
  const matches = findAllOccurrences(promptText, spanText);
  if (matches.length === 0) {
    throw new Error(`Golden set span text not found: ${promptId} "${spanText}"`);
  }

  const pick = occurrence ?? 0;
  if (matches.length > 1 && occurrence === undefined) {
    throw new Error(
      `Golden set span text is ambiguous (set "occurrence"): ${promptId} "${spanText}" (matches=${matches.length})`
    );
  }
  if (pick < 0 || pick >= matches.length) {
    throw new Error(
      `Golden set span occurrence out of range: ${promptId} "${spanText}" occurrence=${pick} (matches=${matches.length})`
    );
  }

  const start = matches[pick];
  return { start, end: start + spanText.length };
}

function normalizeGroundTruthSpans(prompt: any): any[] {
  const text = typeof prompt?.text === 'string' ? prompt.text : '';
  const spans = Array.isArray(prompt?.groundTruth?.spans) ? prompt.groundTruth.spans : [];

  const normalized = spans.map((span: any) => {
    const spanText = typeof span?.text === 'string' ? span.text : '';
    if (!spanText) {
      throw new Error(`Golden set span missing text: ${prompt?.id ?? '<unknown>'}`);
    }

    if (typeof span?.start === 'number' && typeof span?.end === 'number') {
      const slice = text.slice(span.start, span.end);
      if (slice === spanText) return span;

      // Fail fast: this indicates the golden set has drifted.
      throw new Error(
        `Golden set span indices mismatch: ${prompt?.id ?? '<unknown>'} "${spanText}" start=${span.start} end=${span.end} slice="${slice}"`
      );
    }

    const { start, end } = computeSpanIndices(prompt?.id ?? '<unknown>', text, spanText, span?.occurrence);
    return { ...span, start, end };
  });

  // Persist normalized spans back onto the prompt object (in-memory only).
  if (!prompt.groundTruth) prompt.groundTruth = {};
  prompt.groundTruth.spans = normalized;
  return normalized;
}

function applySpanFaultInjection(text: string, spans: any[]): any[] {
  let mutated = Array.isArray(spans) ? [...spans] : [];

  if (process.env.EVAL_FAULT_SPAN_FRAGMENT === '1') {
    const fragmented: any[] = [];
    for (const s of mutated) {
      const start = typeof s?.start === 'number' ? s.start : null;
      const end = typeof s?.end === 'number' ? s.end : null;
      if (start === null || end === null || end - start < 8) {
        fragmented.push(s);
        continue;
      }
      const mid = start + Math.floor((end - start) / 2);
      fragmented.push({
        ...s,
        start,
        end: mid,
        text: text.slice(start, mid),
        _fault: 'fragment',
      });
      fragmented.push({
        ...s,
        start: mid,
        end,
        text: text.slice(mid, end),
        _fault: 'fragment',
      });
    }
    mutated = fragmented;
  }

  if (process.env.EVAL_FAULT_SPAN_OVEREXTRACT === '1') {
    const extras: any[] = [];
    const step = Math.max(1, Math.floor(text.length / 10));
    for (let start = 0; start < text.length && extras.length < 10; start += step) {
      const end = Math.min(text.length, start + 1);
      extras.push({
        text: text.slice(start, end),
        start,
        end,
        role: 'subject.identity',
        confidence: 0.5,
        _fault: 'overextract',
      });
    }
    mutated = [...mutated, ...extras];
  }

  return mutated;
}

/**
 * Load golden dataset from JSON files
 */
function loadGoldenDataset() {
  const datasetFiles: Array<[string, string]> = [
    ['core', 'core-prompts.json'],
    ['technical', 'technical-prompts.json'],
    ['adversarial', 'adversarial-prompts.json'],
    ['edgeCases', 'edge-cases.json'],
    // Expanded golden sets (optional)
    ['appearance', 'appearance-prompts.json'],
    ['lighting', 'lighting-prompts.json'],
    ['cameraMovement', 'camera-movement-prompts.json'],
  ];

  const datasets: Record<string, any> = {};
  for (const [key, filename] of datasetFiles) {
    const path = join(GOLDEN_SET_DIR, filename);
    if (!existsSync(path)) continue;
    datasets[key] = JSON.parse(readFileSync(path, 'utf-8'));
  }

  const allPrompts = Object.values(datasets).flatMap((d: any) => d?.prompts || []);

  for (const prompt of allPrompts) {
    normalizeGroundTruthSpans(prompt);
  }

  return { datasets, allPrompts };
}

/**
 * Run evaluation on a single prompt
 */
async function evaluatePrompt(prompt, aiService) {
  const startTime = Date.now();
  let result = {
    id: prompt.id,
    success: false,
    jsonValid: false,
    isAdversarial: false,
    predicted: [],
    groundTruth: prompt.groundTruth?.spans || [],
    latency: 0,
    error: null
  };

  try {
    const response = await labelSpans({
      text: prompt.text,
      maxSpans: 50,
      minConfidence: 0.5,
      templateVersion: 'v3.0'
    }, aiService);

    result.success = true;
    result.jsonValid = true;
    result.predicted = applySpanFaultInjection(prompt.text, response.spans || []);
    result.isAdversarial = response.isAdversarial || false;
    result.latency = Date.now() - startTime;

  } catch (error) {
    result.error = error.message;
    result.latency = Date.now() - startTime;
  }

  return result;
}

/**
 * Calculate all metrics
 */
function calculateMetrics(results, evaluator) {
  // Separate adversarial and non-adversarial tests
  const adversarialTests = results.filter(r => r.groundTruth.length === 0);
  const nonAdversarialTests = results.filter(r => r.groundTruth.length > 0);

  // JSON Validity Rate
  const jsonValidityRate = evaluator.calculateJsonValidityRate(results);

  // Relaxed F1 + Taxonomy Accuracy must be computed per-test-case
  // because span indices are local to each prompt.
  let totalTruePositives = 0;
  let totalFalsePositives = 0;
  let totalFalseNegatives = 0;
  let totalPredicted = 0;
  let totalGroundTruth = 0;

  let taxonomyCorrect = 0;
  let taxonomyTotal = 0;

  for (const r of nonAdversarialTests) {
    const per = evaluator.evaluateSpans(r.predicted, r.groundTruth);
    totalTruePositives += per.truePositives;
    totalFalsePositives += per.falsePositives;
    totalFalseNegatives += per.falseNegatives;
    totalPredicted += per.totalPredicted;
    totalGroundTruth += per.totalGroundTruth;

    const tax = evaluator.evaluateTaxonomyAccuracy(r.predicted, r.groundTruth);
    taxonomyCorrect += tax.correct;
    taxonomyTotal += tax.total;
  }

  const precision = totalPredicted > 0 ? totalTruePositives / totalPredicted : 0;
  const recall = totalGroundTruth > 0 ? totalTruePositives / totalGroundTruth : 0;
  const relaxedF1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const taxonomyAccuracy = taxonomyTotal > 0 ? taxonomyCorrect / taxonomyTotal : 0;

  // Fragmentation and over-extraction (aggregate across prompts)
  let fragmentedCount = 0;
  let totalGT = 0;
  let spuriousCount = 0;
  let totalPred = 0;
  const fragmentationExamples = [];
  const spuriousExamples = [];

  for (const r of nonAdversarialTests) {
    const frag = evaluator.calculateFragmentationRate(r.predicted, r.groundTruth);
    fragmentedCount += frag.fragmentedCount;
    totalGT += frag.totalGroundTruth;
    if (frag.examples?.length) {
      fragmentationExamples.push(...frag.examples);
    }

    const over = evaluator.calculateOverExtractionRate(r.predicted, r.groundTruth);
    spuriousCount += over.spuriousCount;
    totalPred += over.totalPredicted;
    if (over.examples?.length) {
      spuriousExamples.push(...over.examples);
    }
  }

  const fragmentation = {
    rate: totalGT > 0 ? fragmentedCount / totalGT : 0,
    fragmentedCount,
    totalGroundTruth: totalGT,
    examples: fragmentationExamples.slice(0, 5),
  };

  const overExtraction = {
    rate: totalPred > 0 ? spuriousCount / totalPred : 0,
    spuriousCount,
    totalPredicted: totalPred,
    examples: spuriousExamples.slice(0, 5),
  };

  // Confusion matrix (per prompt to avoid cross-prompt matching)
  const confusionMatrix = evaluator.generateConfusionMatrix(nonAdversarialTests);

  // Per-category breakdown (per-test-case safe)
  const report = evaluator.generateEvaluationReport({
    tests: nonAdversarialTests.map(r => ({
      predicted: r.predicted,
      groundTruth: r.groundTruth,
    })),
  });

  // Safety Pass Rate (only on adversarial tests)
  const adversarialResults = adversarialTests.map(r => ({
    flagged: r.isAdversarial,
    expected: true
  }));
  const safetyPassRate = evaluator.calculateSafetyPassRate(adversarialResults);

  // Latency statistics
  const latencies = results.map(r => r.latency);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

  return {
    jsonValidityRate: jsonValidityRate.rate,
    relaxedF1,
    precision,
    recall,
    taxonomyAccuracy,
    safetyPassRate: safetyPassRate.rate,
    fragmentation,
    fragmentationRate: fragmentation.rate,
    overExtraction,
    overExtractionRate: overExtraction.rate,
    confusionMatrix,
    byCategory: report.byCategory,
    avgLatency,
    p95Latency,
    totalTests: results.length,
    successfulTests: results.filter(r => r.success).length
  };
}

/**
 * Print evaluation report
 */
function printReport(metrics, evaluator) {
  console.log('\n' + '='.repeat(80));
  console.log('  GOLDEN SET EVALUATION REPORT');
  console.log('='.repeat(80));
  console.log();

  console.log('📊 METRICS:');
  console.log(`  JSON Validity Rate:   ${(metrics.jsonValidityRate * 100).toFixed(2)}%  (Target: >99.5%)`);
  console.log(`  Relaxed F1:           ${metrics.relaxedF1.toFixed(3)}          (Target: >0.85)`);
  console.log(`  Precision:            ${metrics.precision.toFixed(3)}`);
  console.log(`  Recall:               ${metrics.recall.toFixed(3)}`);
  console.log(`  Taxonomy Accuracy:    ${(metrics.taxonomyAccuracy * 100).toFixed(2)}%  (Target: >90%)`);
  console.log(`  Safety Pass Rate:     ${(metrics.safetyPassRate * 100).toFixed(2)}%  (Target: 100%)`);
  if (metrics.fragmentation) {
    console.log(`  Fragmentation Rate:   ${(metrics.fragmentation.rate * 100).toFixed(1)}%  (Target: <20%)`);
  }
  if (metrics.overExtraction) {
    console.log(`  Over-Extraction Rate: ${(metrics.overExtraction.rate * 100).toFixed(1)}%  (Target: <15%)`);
  }
  console.log();

  console.log('⚡ PERFORMANCE:');
  console.log(`  Avg Latency:          ${metrics.avgLatency.toFixed(0)}ms`);
  console.log(`  P95 Latency:          ${metrics.p95Latency.toFixed(0)}ms  (Target: <1500ms)`);
  console.log(`  Successful Tests:     ${metrics.successfulTests}/${metrics.totalTests}`);
  console.log();

  if (metrics.byCategory && Object.keys(metrics.byCategory).length > 0) {
    console.log('📌 BY CATEGORY (worst → best):');
    const sorted = Object.entries(metrics.byCategory).sort((a, b) => a[1].f1 - b[1].f1);
    for (const [cat, m] of sorted) {
      console.log(`  - ${cat}: F1=${m.f1.toFixed(3)} (P=${m.precision.toFixed(3)}, R=${m.recall.toFixed(3)}, n=${m.support})`);
    }
    console.log();
  }

  if (metrics.confusionMatrix) {
    console.log('🔀 TOP CONFUSIONS:');
    const confusions = [];
    for (const [gtRole, preds] of Object.entries(metrics.confusionMatrix)) {
      for (const [predRole, count] of Object.entries(preds)) {
        if (gtRole === predRole) continue;
        if (predRole === '<missed>' || gtRole === '<spurious>') continue;
        confusions.push({ gtRole, predRole, count });
      }
    }
    confusions.sort((a, b) => b.count - a.count);
    confusions.slice(0, 10).forEach(c => {
      console.log(`  - ${c.gtRole} → ${c.predRole}: ${c.count}`);
    });
    console.log();
  }

  // Check thresholds
  const thresholdCheck = evaluator.checkTargetThresholds(metrics);
  
  if (thresholdCheck.passed) {
    console.log('✅ ALL TARGETS MET - READY FOR DEPLOYMENT');
  } else {
    console.log('❌ SOME TARGETS FAILED:');
    thresholdCheck.failures.forEach(failure => {
      console.log(`   - ${failure}`);
    });
    console.log();
    console.log('⚠️  DEPLOYMENT BLOCKED');
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * Create AI service using available API keys.
 * Mirrors scripts/diagnose-span-labeling.js for consistency.
 */
function createAIService() {
  const clients = {};

  if (process.env.GROQ_API_KEY) {
    clients.groq = new OpenAICompatibleAdapter({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.1-8b-instant',
      providerName: 'groq',
    });
  }

  if (process.env.OPENAI_API_KEY) {
    clients.openai = new OpenAICompatibleAdapter({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      providerName: 'openai',
    });
  }

  if (process.env.GEMINI_API_KEY) {
    clients.gemini = new GeminiAdapter({
      apiKey: process.env.GEMINI_API_KEY,
      defaultModel: 'gemini-2.0-flash-exp',
      providerName: 'gemini',
    });
  }

  if (!clients.openai && clients.groq) {
    // AIModelService requires openai key; allow groq-only by aliasing.
    clients.openai = clients.groq;
  }

  if (Object.keys(clients).length === 0) {
    throw new Error('No AI API keys found. Set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY');
  }

  return new AIModelService({ clients });
}

export async function runSpanLabelingBenchmark(options = {}) {
  const { runs = 1 } = options;
  const { allPrompts } = loadGoldenDataset();
  const aiService = createAIService();

  const allResults = [];
  for (let run = 0; run < runs; run++) {
    const results = [];
    for (const prompt of allPrompts) {
      // eslint-disable-next-line no-await-in-loop
      const r = await evaluatePrompt(prompt, aiService);
      results.push(r);
    }
    allResults.push(results);
  }

  // Flatten runs for metrics
  const flattened = allResults.flat();
  const evaluator = new RelaxedF1Evaluator();
  const metrics = calculateMetrics(flattened, evaluator);

  return { metrics, results: flattened };
}

/**
 * Main evaluation function
 */
async function main() {
  console.log('Running span-labeling benchmark (real LLM calls)...');
  const { metrics, results } = await runSpanLabelingBenchmark({ runs: 1 });
  printReport(metrics, new RelaxedF1Evaluator());

  // Write detailed report to disk for baseline/regression
  const outPath = join(__dirname, '../../test-results/span-labeling-evaluation.json');
  try {
    const { writeFileSync } = await import('fs');
    writeFileSync(outPath, JSON.stringify({ metrics, results }, null, 2));
    console.log(`📄 Report written to ${outPath}`);
  } catch {
    // ignore write errors in constrained environments
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { loadGoldenDataset, evaluatePrompt, calculateMetrics, printReport };
