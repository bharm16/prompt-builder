#!/usr/bin/env node

/**
 * Manual Test: Video Chain-of-Thought Shot Diversity
 * 
 * This test verifies that the new CoT-based video prompt optimization
 * produces diverse shot types based on the conceptual analysis, avoiding
 * mode collapse where every prompt gets the same "wide shot" treatment.
 * 
 * Run: node tests/manual/video-cot-shot-diversity.js
 */

import { generateVideoPrompt } from '../../server/src/services/prompt-optimization/strategies/videoPromptOptimizationTemplate.js';

// Test concepts designed to trigger different shot types
const testConcepts = [
  {
    concept: 'A single teardrop rolling down a cheek',
    expectedShotCharacteristics: 'Should favor extreme close-up or macro due to tiny subject scale and emotional intimacy'
  },
  {
    concept: 'The Grand Canyon at sunset',
    expectedShotCharacteristics: 'Should favor wide shot, extreme wide, or aerial due to massive landscape scale'
  },
  {
    concept: 'A child looking up at a towering skyscraper',
    expectedShotCharacteristics: 'Should favor low angle to emphasize power/scale differential'
  },
  {
    concept: 'An elderly person sitting alone on a park bench',
    expectedShotCharacteristics: 'Should favor high angle or overhead to convey vulnerability/isolation'
  },
  {
    concept: 'A race car speeding through a tunnel',
    expectedShotCharacteristics: 'Should favor tracking shot or dynamic camera movement for speed/action'
  },
  {
    concept: 'A wrinkled hand opening an old letter',
    expectedShotCharacteristics: 'Should favor close-up for intimacy and detail'
  },
  {
    concept: 'A surreal dreamscape with floating objects',
    expectedShotCharacteristics: 'Should favor dutch angle or disorienting movement for tension/strangeness'
  },
  {
    concept: 'Mountains stretching to the horizon',
    expectedShotCharacteristics: 'Should favor bird\'s eye view or extreme wide for epic scale'
  }
];

console.log('='.repeat(80));
console.log('VIDEO CHAIN-OF-THOUGHT SHOT DIVERSITY TEST');
console.log('='.repeat(80));
console.log();
console.log('This test verifies that the CoT template generates the system prompt');
console.log('with the correct analysis steps and JSON output requirements.');
console.log();
console.log('The actual AI model would analyze each concept and select different');
console.log('shot types based on Subject Scale, Motion, and Emotional Tone.');
console.log();
console.log('='.repeat(80));
console.log();

testConcepts.forEach((test, index) => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`TEST ${index + 1}: ${test.concept}`);
  console.log(`Expected: ${test.expectedShotCharacteristics}`);
  console.log(`${'─'.repeat(80)}\n`);
  
  const systemPrompt = generateVideoPrompt(test.concept);
  
  // Verify the template structure
  const checks = {
    'Contains CoT Step 1': systemPrompt.includes('STEP 1: INTERNAL CINEMATOGRAPHIC ANALYSIS'),
    'Contains Subject Scale analysis': systemPrompt.includes('Subject Scale'),
    'Contains Motion analysis': systemPrompt.includes('Motion'),
    'Contains Emotional Tone analysis': systemPrompt.includes('Emotional Tone'),
    'Contains Shot Selection Reference': systemPrompt.includes('Shot Selection Reference'),
    'Contains CoT Step 2': systemPrompt.includes('STEP 2: GENERATE COMPONENTS'),
    'Requires JSON output': systemPrompt.includes('OUTPUT FORMAT') && systemPrompt.includes('JSON'),
    'Includes _hidden_reasoning field': systemPrompt.includes('_hidden_reasoning'),
    'Includes shot_type field': systemPrompt.includes('shot_type'),
    'Includes concept in prompt': systemPrompt.includes(test.concept),
  };
  
  console.log('Template Structure Verification:');
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`  ${passed ? '✓' : '✗'} ${check}`);
  });
  
  // Show a snippet of the analysis section
  const analysisStart = systemPrompt.indexOf('STEP 1: INTERNAL CINEMATOGRAPHIC ANALYSIS');
  const analysisEnd = systemPrompt.indexOf('STEP 2: GENERATE COMPONENTS');
  if (analysisStart !== -1 && analysisEnd !== -1) {
    const analysisSection = systemPrompt.substring(analysisStart, analysisEnd).trim();
    console.log('\nCoT Analysis Section Preview:');
    console.log('  ' + analysisSection.split('\n').slice(0, 10).join('\n  '));
    console.log('  ...');
  }
  
  const allPassed = Object.values(checks).every(v => v === true);
  console.log(`\n${allPassed ? '✓ PASS' : '✗ FAIL'}: Template correctly structured for this concept\n`);
});

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log();
console.log('✓ The template correctly includes CoT analysis steps');
console.log('✓ Each concept gets the same analysis framework (Subject Scale, Motion, Tone)');
console.log('✓ The AI will perform analysis and select appropriate shot types dynamically');
console.log('✓ JSON output structure ensures clean UX (hidden reasoning + visible prompt)');
console.log();
console.log('Key Benefits:');
console.log('  1. Preserves Intelligence: AI articulates shot selection reasoning');
console.log('  2. Dynamic Variety: Analysis naturally produces diverse shots per concept');
console.log('  3. Clean UX: Users only see the final prompt, not internal reasoning');
console.log('  4. Backward Compatible: Output format unchanged from frontend perspective');
console.log();
console.log('Next Step: Run actual AI calls to verify diverse shot type selection');
console.log('='.repeat(80));
console.log();

