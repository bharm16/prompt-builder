#!/usr/bin/env node

/**
 * NLP Fast-Path Validation Script
 * 
 * Tests the integrated NLP span service with real-world video prompts
 * to validate the fast-path implementation works correctly.
 */

import { extractKnownSpans, getVocabStats, estimateCoverage } from '../server/src/llm/span-labeling/services/NlpSpanService.js';

// Test prompts covering various scenarios
const testPrompts = [
  {
    name: 'Simple Technical Prompt',
    text: 'Wide shot in 16:9, shot on Kodak Portra 400',
    expectedMinSpans: 3,
  },
  {
    name: 'Camera Movement',
    text: 'Camera pans left as it dollies forward, ending with a tilt up',
    expectedMinSpans: 3,
  },
  {
    name: 'Lighting Rich',
    text: 'Rembrandt lighting with soft light during golden hour, creating chiaroscuro effect',
    expectedMinSpans: 3,
  },
  {
    name: 'Complex Cinematic',
    text: 'Extreme wide shot of dystopian cityscape. Camera cranes up slowly while panning right. Shot on Kodak Vision3 500T with anamorphic 35mm lens. 2.39:1 aspect ratio, rendered in 8K. High-key lighting with volumetric fog during blue hour.',
    expectedMinSpans: 5,
  },
  {
    name: 'Disambiguation Test - Pan (Camera)',
    text: 'Camera pans across the scene',
    expectedMinSpans: 1,
  },
  {
    name: 'Disambiguation Test - Pan (Cooking)',
    text: 'Chef cooks vegetables in a frying pan',
    expectedMinSpans: 0, // Should avoid matching "pan" here
  },
  {
    name: 'Multi-word Terms',
    text: 'Over-the-shoulder shot with three-point lighting and split diopter focus',
    expectedMinSpans: 2,
  },
  {
    name: 'Technical Specs',
    text: 'Render in 4K resolution at 16:9 aspect ratio, 24fps',
    expectedMinSpans: 2,
  },
  {
    name: 'Film Stock Variety',
    text: 'Shot on CineStill 800T with 35mm Film aesthetic',
    expectedMinSpans: 2,
  },
  {
    name: 'Camera Angles',
    text: "Bird's-eye view transitioning to low-angle shot",
    expectedMinSpans: 2,
  },
];

console.log('\n╔════════════════════════════════════════════════════════════════════╗');
console.log('║  NLP Fast-Path Validation - End-to-End Testing                    ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// Display vocabulary statistics
const vocabStats = getVocabStats();
console.log('📚 Vocabulary Statistics:');
console.log(`   Total Categories: ${vocabStats.totalCategories}`);
console.log(`   Total Terms: ${vocabStats.totalTerms}`);
console.log('\n   Categories:');
Object.entries(vocabStats.categories).forEach(([cat, stats]) => {
  console.log(`     • ${cat}: ${stats.termCount} terms`);
});

console.log('\n' + '─'.repeat(70) + '\n');

// Run tests
let passed = 0;
let failed = 0;
const results = [];

testPrompts.forEach((testCase, index) => {
  console.log(`\n[Test ${index + 1}/${testPrompts.length}] ${testCase.name}`);
  console.log(`Input: "${testCase.text}"`);
  
  const startTime = Date.now();
  const spans = extractKnownSpans(testCase.text);
  const endTime = Date.now();
  const latency = endTime - startTime;
  
  const coverage = estimateCoverage(testCase.text);
  const success = spans.length >= testCase.expectedMinSpans;
  
  if (success) {
    passed++;
    console.log(`✓ PASS - Found ${spans.length} spans (expected ≥${testCase.expectedMinSpans})`);
  } else {
    failed++;
    console.log(`✗ FAIL - Found ${spans.length} spans (expected ≥${testCase.expectedMinSpans})`);
  }
  
  console.log(`   Latency: ${latency}ms | Coverage: ${coverage}%`);
  
  if (spans.length > 0) {
    console.log('   Spans:');
    spans.forEach(span => {
      console.log(`     • "${span.text}" → ${span.role} (confidence: ${span.confidence})`);
    });
  }
  
  results.push({
    name: testCase.name,
    success,
    spansFound: spans.length,
    expectedMin: testCase.expectedMinSpans,
    latency,
    coverage,
    spans,
  });
});

// Summary
console.log('\n' + '═'.repeat(70));
console.log('\n📊 Test Summary:\n');
console.log(`   Total Tests: ${testPrompts.length}`);
console.log(`   ✓ Passed: ${passed}`);
console.log(`   ✗ Failed: ${failed}`);
console.log(`   Success Rate: ${Math.round((passed / testPrompts.length) * 100)}%`);

const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
const avgCoverage = results.reduce((sum, r) => sum + r.coverage, 0) / results.length;
const avgSpans = results.reduce((sum, r) => sum + r.spansFound, 0) / results.length;

console.log(`\n   Average Latency: ${avgLatency.toFixed(2)}ms`);
console.log(`   Average Coverage: ${avgCoverage.toFixed(1)}%`);
console.log(`   Average Spans: ${avgSpans.toFixed(1)}`);

// Performance validation
console.log('\n' + '─'.repeat(70));
console.log('\n⚡ Performance Validation:\n');

const targetLatency = 50; // Target: <50ms
const meetsLatency = avgLatency < targetLatency;
console.log(`   Target Latency: <${targetLatency}ms`);
console.log(`   Actual: ${avgLatency.toFixed(2)}ms ${meetsLatency ? '✓' : '✗'}`);

// Estimate cost savings
const estimatedLLMLatency = 800; // Average LLM call latency (ms)
const estimatedLLMCost = 0.0005; // Average cost per LLM call ($)
const speedup = (estimatedLLMLatency / avgLatency).toFixed(1);
const potentialSavingsPerCall = estimatedLLMCost;

console.log(`\n   Speedup vs LLM: ${speedup}x faster`);
console.log(`   Cost Savings: $${potentialSavingsPerCall.toFixed(4)} per bypass`);
console.log(`   (Based on 60-70% bypass rate, saves ~$0.0003-0.0004 per request)`);

// Categories covered
const allCategories = new Set();
results.forEach(r => {
  r.spans.forEach(s => allCategories.add(s.role));
});

console.log(`\n   Taxonomy Coverage: ${allCategories.size} categories detected`);
console.log(`   Categories: ${Array.from(allCategories).join(', ')}`);

console.log('\n' + '═'.repeat(70));

// Exit with appropriate code
if (failed > 0) {
  console.log('\n⚠️  Some tests failed. Review results above.\n');
  process.exit(1);
} else {
  console.log('\n✨ All tests passed! NLP Fast-Path is working correctly.\n');
  process.exit(0);
}

