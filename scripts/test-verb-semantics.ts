/**
 * Test script for semantic verb classification
 */

import {
  classifyVerbSemantically,
  warmupVerbSemantics,
  isVerbSemanticsReady,
} from '../server/src/llm/span-labeling/nlp/VerbSemantics.js';

async function main() {
  console.log('=== Semantic Verb Classification Test ===\n');

  console.log('Warming up semantic classifier...');
  const warmupResult = await warmupVerbSemantics();
  console.log(`Warmup complete: ${warmupResult.success ? '✓' : '✗'} (${warmupResult.latencyMs}ms)`);
  console.log(`Model ready: ${isVerbSemanticsReady()}\n`);

  const testCases = [
    // Should be state
    'gazing thoughtfully',
    'sitting quietly',
    'watching intently',
    'staring at the horizon',
    'observing carefully',
    // Should be movement
    'running quickly',
    'jumping high',
    'dancing gracefully',
    'swimming through water',
    'jogging steadily',
    // Should be gesture
    'waving hands',
    'pointing finger',
    'nodding head',
    'clapping enthusiastically',
  ];

  console.log('Classification Results:');
  console.log('─'.repeat(60));

  for (const verb of testCases) {
    const result = await classifyVerbSemantically(verb);
    const emoji =
      result.actionClass === 'state'
        ? '👁️'
        : result.actionClass === 'gesture'
          ? '👋'
          : '🏃';
    console.log(
      `${emoji} "${verb}" → ${result.actionClass} (conf: ${result.confidence.toFixed(3)})`
    );
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
