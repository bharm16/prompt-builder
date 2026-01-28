#!/usr/bin/env tsx

/**
 * Automated Model Comparison Test Runner
 * 
 * Tests both models sequentially and compares results:
 * - llama-3.1-8b-instant (baseline)
 * - llama-4-scout-17b-16e-instruct (SCOUT)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODELS = {
  baseline: 'llama-3.1-8b-instant',
  scout: 'llama-4-scout-17b-16e-instruct',
};

const ENV_FILE = join(__dirname, '../.env');
const RESULTS_DIR = join(__dirname, '../test-results');
const PROMPT_OUTPUT_ONLY = 'true';
const BASE_ENV = { ...process.env, PROMPT_OUTPUT_ONLY };

// Ensure results directory exists
try {
  execSync(`mkdir -p "${RESULTS_DIR}"`, { stdio: 'inherit' });
} catch {
  // Directory might already exist
}

/**
 * Update .env file with model configuration
 */
function updateEnvFile(model: string): void {
  const envContent = readFileSync(ENV_FILE, 'utf-8');
  
  // Replace SPAN_MODEL and ENHANCE_MODEL
  const updated = envContent
    .replace(/SPAN_MODEL=.*/g, `SPAN_MODEL=${model}`)
    .replace(/ENHANCE_MODEL=.*/g, `ENHANCE_MODEL=${model}`);
  
  writeFileSync(ENV_FILE, updated, 'utf-8');
  console.log(`✅ Updated .env: SPAN_MODEL=${model}, ENHANCE_MODEL=${model}`);
}

/**
 * Wait for server to be ready
 */
function waitForServer(maxAttempts = 30): boolean {
  console.log('⏳ Waiting for server to be ready...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = execSync('curl -s http://localhost:3001/health', { encoding: 'utf-8' });
      if (response.includes('ok') || response.includes('healthy')) {
        console.log('✅ Server is ready!\n');
        return true;
      }
    } catch {
      // Server not ready yet
    }
    process.stdout.write('.');
    execSync('sleep 1', { stdio: 'inherit' });
  }
  
  console.log('\n❌ Server did not become ready in time');
  return false;
}

/**
 * Run tests for a specific model
 */
function runTests(model: string, modelKey: string): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  Testing Model: ${model}`);
  console.log('='.repeat(80));
  
  try {
    const output = execSync(
      `npx tsx --tsconfig server/tsconfig.json scripts/test-models-comparison.ts`,
      { 
        encoding: 'utf-8',
        cwd: join(__dirname, '..'),
        env: { ...BASE_ENV, SPAN_MODEL: model, ENHANCE_MODEL: model }
      }
    );
    
    const resultFile = join(RESULTS_DIR, `results-${modelKey}.txt`);
    writeFileSync(resultFile, output, 'utf-8');
    console.log(`\n✅ Results saved to: ${resultFile}`);
    
    return output;
  } catch (error: any) {
    console.error(`\n❌ Test failed for ${model}:`, error.message);
    throw error;
  }
}

/**
 * Compare results
 */
function compareResults(baselineOutput: string, scoutOutput: string): void {
  console.log('\n' + '='.repeat(80));
  console.log('  COMPARISON SUMMARY');
  console.log('='.repeat(80));
  
  // Extract key metrics using regex
  const extractMetrics = (output: string, modelName: string) => {
    const spanAvgMatch = output.match(/Average Duration: (\d+)ms[\s\S]*?Average Spans Found: ([\d.]+)/);
    const enhanceAvgMatch = output.match(/ENHANCEMENTSUGGESTIONS[\s\S]*?Average Duration: (\d+)ms[\s\S]*?Average Suggestions: ([\d.]+)/);
    
    return {
      spanDuration: spanAvgMatch ? parseInt(spanAvgMatch[1]) : 0,
      spanCount: spanAvgMatch ? parseFloat(spanAvgMatch[2]) : 0,
      enhanceDuration: enhanceAvgMatch ? parseInt(enhanceAvgMatch[1]) : 0,
      enhanceCount: enhanceAvgMatch ? parseFloat(enhanceAvgMatch[2]) : 0,
    };
  };
  
  const baseline = extractMetrics(baselineOutput, MODELS.baseline);
  const scout = extractMetrics(scoutOutput, MODELS.scout);
  
  console.log('\n📊 Span Labeling:');
  console.log(`  Baseline (${MODELS.baseline}):`);
  console.log(`    Avg Duration: ${baseline.spanDuration}ms`);
  console.log(`    Avg Spans: ${baseline.spanCount.toFixed(1)}`);
  console.log(`  SCOUT (${MODELS.scout}):`);
  console.log(`    Avg Duration: ${scout.spanDuration}ms`);
  console.log(`    Avg Spans: ${scout.spanCount.toFixed(1)}`);
  
  if (baseline.spanDuration > 0) {
    const durationDiff = ((scout.spanDuration - baseline.spanDuration) / baseline.spanDuration * 100).toFixed(1);
    const spanDiff = ((scout.spanCount - baseline.spanCount) / baseline.spanCount * 100).toFixed(1);
    console.log(`  Difference: ${durationDiff >= 0 ? '+' : ''}${durationDiff}% duration, ${spanDiff >= 0 ? '+' : ''}${spanDiff}% spans`);
  }
  
  console.log('\n💡 Enhancement Suggestions:');
  console.log(`  Baseline (${MODELS.baseline}):`);
  console.log(`    Avg Duration: ${baseline.enhanceDuration}ms`);
  console.log(`    Avg Suggestions: ${baseline.enhanceCount.toFixed(1)}`);
  console.log(`  SCOUT (${MODELS.scout}):`);
  console.log(`    Avg Duration: ${scout.enhanceDuration}ms`);
  console.log(`    Avg Suggestions: ${scout.enhanceCount.toFixed(1)}`);
  
  if (baseline.enhanceDuration > 0) {
    const durationDiff = ((scout.enhanceDuration - baseline.enhanceDuration) / baseline.enhanceDuration * 100).toFixed(1);
    const suggestionDiff = ((scout.enhanceCount - baseline.enhanceCount) / baseline.enhanceCount * 100).toFixed(1);
    console.log(`  Difference: ${durationDiff >= 0 ? '+' : ''}${durationDiff}% duration, ${suggestionDiff >= 0 ? '+' : ''}${suggestionDiff}% suggestions`);
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('\n🚀 Starting Automated Model Comparison Test Suite\n');
  
  let baselineOutput = '';
  let scoutOutput = '';
  
  // Test baseline model
  console.log(`\n📝 Step 1: Testing ${MODELS.baseline}`);
  updateEnvFile(MODELS.baseline);
  console.log('🔄 Restarting server...');
  execSync('npm restart', { stdio: 'inherit', cwd: join(__dirname, '..'), env: BASE_ENV });
  
  if (!waitForServer()) {
    console.error('❌ Failed to start server');
    process.exit(1);
  }
  
  baselineOutput = runTests(MODELS.baseline, 'baseline');
  
  // Test SCOUT model
  console.log(`\n📝 Step 2: Testing ${MODELS.scout}`);
  updateEnvFile(MODELS.scout);
  console.log('🔄 Restarting server...');
  execSync('npm restart', { stdio: 'inherit', cwd: join(__dirname, '..'), env: BASE_ENV });
  
  if (!waitForServer()) {
    console.error('❌ Failed to start server');
    process.exit(1);
  }
  
  scoutOutput = runTests(MODELS.scout, 'scout');
  
  // Compare results
  compareResults(baselineOutput, scoutOutput);
  
  console.log('\n✅ All tests completed!');
  console.log(`📁 Full results saved in: ${RESULTS_DIR}\n`);
}

main().catch((error) => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});








