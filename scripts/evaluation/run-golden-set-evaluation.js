#!/usr/bin/env node

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
 *   node scripts/evaluation/run-golden-set-evaluation.js
 * 
 * Prerequisites:
 *   - Golden dataset files in server/src/llm/span-labeling/evaluation/golden-set/
 *   - AI service configured with valid API keys
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { RelaxedF1Evaluator } from '../../server/src/llm/span-labeling/evaluation/RelaxedF1Evaluator.js';
import { labelSpans } from '../../server/src/llm/span-labeling/SpanLabelingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Golden dataset paths
const GOLDEN_SET_DIR = join(__dirname, '../../server/src/llm/span-labeling/evaluation/golden-set');

/**
 * Load golden dataset from JSON files
 */
function loadGoldenDataset() {
  const datasets = {
    core: JSON.parse(readFileSync(join(GOLDEN_SET_DIR, 'core-prompts.json'), 'utf-8')),
    technical: JSON.parse(readFileSync(join(GOLDEN_SET_DIR, 'technical-prompts.json'), 'utf-8')),
    adversarial: JSON.parse(readFileSync(join(GOLDEN_SET_DIR, 'adversarial-prompts.json'), 'utf-8')),
    edgeCases: JSON.parse(readFileSync(join(GOLDEN_SET_DIR, 'edge-cases.json'), 'utf-8'))
  };

  const allPrompts = [
    ...datasets.core.prompts,
    ...datasets.technical.prompts,
    ...datasets.adversarial.prompts,
    ...datasets.edgeCases.prompts
  ];

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
    result.predicted = response.spans || [];
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

  // Relaxed F1 (only on non-adversarial tests)
  const allPredicted = nonAdversarialTests.flatMap(r => r.predicted);
  const allGroundTruth = nonAdversarialTests.flatMap(r => r.groundTruth);
  const f1Metrics = evaluator.evaluateSpans(allPredicted, allGroundTruth);

  // Taxonomy Accuracy (only on non-adversarial tests)
  const taxonomyMetrics = evaluator.evaluateTaxonomyAccuracy(allPredicted, allGroundTruth);

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
    relaxedF1: f1Metrics.f1,
    precision: f1Metrics.precision,
    recall: f1Metrics.recall,
    taxonomyAccuracy: taxonomyMetrics.accuracy,
    safetyPassRate: safetyPassRate.rate,
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
  console.log();

  console.log('⚡ PERFORMANCE:');
  console.log(`  Avg Latency:          ${metrics.avgLatency.toFixed(0)}ms`);
  console.log(`  P95 Latency:          ${metrics.p95Latency.toFixed(0)}ms  (Target: <1500ms)`);
  console.log(`  Successful Tests:     ${metrics.successfulTests}/${metrics.totalTests}`);
  console.log();

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
 * Main evaluation function
 */
async function main() {
  console.log('Loading golden dataset...');
  const { allPrompts } = loadGoldenDataset();
  console.log(`Loaded ${allPrompts.length} test prompts`);

  // Note: This is a template script - actual AI service initialization
  // would need to be implemented based on your service setup
  console.log('\n⚠️  AI Service Integration Required:');
  console.log('This script needs to be integrated with your AIModelService.');
  console.log('Please initialize aiService before running evaluation.');
  console.log();

  // Placeholder for demonstration
  console.log('TEMPLATE SCRIPT - Integration steps:');
  console.log('1. Import and initialize AIModelService with clients');
  console.log('2. Run evaluatePrompt() for each prompt in allPrompts');
  console.log('3. Calculate metrics using calculateMetrics()');
  console.log('4. Print report using printReport()');
  console.log();
  console.log('Example implementation saved to this file.');
}

// Uncomment when ready to run with actual AI service
// main().catch(console.error);

export { loadGoldenDataset, evaluatePrompt, calculateMetrics, printReport };

