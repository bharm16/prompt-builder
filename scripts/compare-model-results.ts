#!/usr/bin/env tsx

/**
 * Compare Model Test Results
 * 
 * Reads test results from both models and creates a comparison report
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESULTS_DIR = join(__dirname, '../test-results');

interface TestMetrics {
  spanDuration: number;
  spanCount: number;
  enhanceDuration: number;
  enhanceCount: number;
}

function extractMetrics(output: string): TestMetrics {
  const spanSection = output.match(/SPANLABELING TEST RESULTS[\s\S]*?Average Duration: (\d+)ms[\s\S]*?Average Spans Found: ([\d.]+)/);
  const enhanceSection = output.match(/ENHANCEMENTSUGGESTIONS TEST RESULTS[\s\S]*?Average Duration: (\d+)ms[\s\S]*?Average Suggestions: ([\d.]+)/);
  
  return {
    spanDuration: spanSection ? parseInt(spanSection[1]) : 0,
    spanCount: spanSection ? parseFloat(spanSection[2]) : 0,
    enhanceDuration: enhanceSection ? parseInt(enhanceSection[1]) : 0,
    enhanceCount: enhanceSection ? parseFloat(enhanceSection[2]) : 0,
  };
}

function compareResults(): void {
  console.log('\n' + '='.repeat(80));
  console.log('  MODEL COMPARISON REPORT');
  console.log('='.repeat(80));
  
  try {
    const baselineOutput = readFileSync(join(RESULTS_DIR, 'results-baseline.txt'), 'utf-8');
    const scoutOutput = readFileSync(join(RESULTS_DIR, 'results-scout.txt'), 'utf-8');
    
    const baseline = extractMetrics(baselineOutput);
    const scout = extractMetrics(scoutOutput);
    
    // Extract model names
    const baselineModelMatch = baselineOutput.match(/Current Model: (.+)/);
    const scoutModelMatch = scoutOutput.match(/Current Model: (.+)/);
    const baselineModel = baselineModelMatch ? baselineModelMatch[1] : 'unknown';
    const scoutModel = scoutModelMatch ? scoutModelMatch[1] : 'unknown';
    
    console.log(`\n📊 Baseline Model: ${baselineModel}`);
    console.log(`📊 SCOUT Model: ${scoutModel}\n`);
    
    console.log('='.repeat(80));
    console.log('  SPAN LABELING COMPARISON');
    console.log('='.repeat(80));
    console.log(`\n  Baseline (${baselineModel}):`);
    console.log(`    Average Duration: ${baseline.spanDuration}ms`);
    console.log(`    Average Spans Found: ${baseline.spanCount.toFixed(1)}`);
    console.log(`\n  SCOUT (${scoutModel}):`);
    console.log(`    Average Duration: ${scout.spanDuration}ms`);
    console.log(`    Average Spans Found: ${scout.spanCount.toFixed(1)}`);
    
    if (baseline.spanDuration > 0 && scout.spanDuration > 0) {
      const durationDiff = ((scout.spanDuration - baseline.spanDuration) / baseline.spanDuration * 100);
      const spanDiff = ((scout.spanCount - baseline.spanCount) / baseline.spanCount * 100);
      console.log(`\n  Difference:`);
      console.log(`    Duration: ${durationDiff >= 0 ? '+' : ''}${durationDiff.toFixed(1)}%`);
      console.log(`    Spans: ${spanDiff >= 0 ? '+' : ''}${spanDiff.toFixed(1)}%`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('  ENHANCEMENT SUGGESTIONS COMPARISON');
    console.log('='.repeat(80));
    console.log(`\n  Baseline (${baselineModel}):`);
    console.log(`    Average Duration: ${baseline.enhanceDuration}ms`);
    console.log(`    Average Suggestions: ${baseline.enhanceCount.toFixed(1)}`);
    console.log(`\n  SCOUT (${scoutModel}):`);
    console.log(`    Average Duration: ${scout.enhanceDuration}ms`);
    console.log(`    Average Suggestions: ${scout.enhanceCount.toFixed(1)}`);
    
    if (baseline.enhanceDuration > 0 && scout.enhanceDuration > 0) {
      const durationDiff = ((scout.enhanceDuration - baseline.enhanceDuration) / baseline.enhanceDuration * 100);
      const suggestionDiff = ((scout.enhanceCount - baseline.enhanceCount) / baseline.enhanceCount * 100);
      console.log(`\n  Difference:`);
      console.log(`    Duration: ${durationDiff >= 0 ? '+' : ''}${durationDiff.toFixed(1)}%`);
      console.log(`    Suggestions: ${suggestionDiff >= 0 ? '+' : ''}${suggestionDiff.toFixed(1)}%`);
    }
    
    // Check if results are identical (suggesting same model was used)
    if (baseline.spanDuration === scout.spanDuration && 
        baseline.spanCount === scout.spanCount &&
        baseline.enhanceDuration === scout.enhanceDuration &&
        baseline.enhanceCount === scout.enhanceCount) {
      console.log('\n⚠️  WARNING: Results are identical!');
      console.log('   This suggests the server may not have switched models.');
      console.log('   Make sure to restart the server with new environment variables.');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Error reading results:', error);
    process.exit(1);
  }
}

compareResults();


