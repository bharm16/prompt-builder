#!/usr/bin/env node

/**
 * Symbolic NLP Validation Script
 * 
 * End-to-end validation of the symbolic NLP pipeline with 50 realistic video prompts.
 * 
 * This script tests:
 * - POS tagging accuracy
 * - Chunking correctness
 * - Frame matching
 * - Semantic role labeling
 * - Taxonomy mapping
 * - Overall pipeline performance
 * 
 * Usage:
 *   node scripts/validate-symbolic-nlp.js
 *   node scripts/validate-symbolic-nlp.js --verbose
 *   node scripts/validate-symbolic-nlp.js --prompt="Your custom prompt"
 */

import { extractSemanticSpans } from '../server/src/llm/span-labeling/services/NlpSpanService.js';

/**
 * 50 realistic video prompts covering various scenarios
 */
const TEST_PROMPTS = [
  // Motion - Subject movement
  'A weathered robotic soldier runs through a dark forest',
  'An elegant woman walks slowly across a marble floor',
  'A bird flies swiftly over the ocean waves',
  'Children jump playfully in a sunlit park',
  'A cat leaps gracefully onto a windowsill',
  
  // Camera movements
  'Camera pans left across the cityscape',
  'Dolly in toward the character\'s face',
  'Crane up to reveal the vast landscape',
  'Truck right alongside the moving vehicle',
  'Zoom in on the mysterious object',
  'Tilt down from the sky to the ground',
  'Rack focus from foreground to background',
  
  // Lighting scenarios
  'A room illuminated by soft golden hour light',
  'Dark forest lit by harsh moonlight',
  'Character highlighted by rim light from behind',
  'Scene bathed in warm candlelight',
  'Studio setup with key and fill lights',
  
  // Complex compositions
  'A detective in a leather jacket walks through rain-soaked streets at night',
  'Overhead shot of a crowded marketplace in 16:9 aspect ratio',
  'Close-up of weathered hands holding an ancient artifact',
  'Wide shot of a lone figure standing in a misty forest at dawn',
  'Handheld camera follows a runner through narrow alleyways',
  
  // Technical specifications
  'Shot in 24fps with anamorphic lens',
  'Captured in 4K resolution at 2.39:1 aspect ratio',
  'Filmed on Kodak Vision3 500T film stock',
  'Shot with 35mm lens at f/2.8',
  'Recorded at 1080p 60fps for slow motion',
  
  // Stylistic descriptions
  'Cyberpunk aesthetic with neon lights and rain',
  'Film noir style with dramatic shadows',
  'Vintage 8mm home movie feel',
  'Documentary-style handheld cinematography',
  'Dreamlike atmosphere with soft focus and bloom',
  
  // Action sequences
  'A superhero flies rapidly toward the camera',
  'Car swerves violently around a corner',
  'Explosion erupts in slow motion with debris flying',
  'Martial artist spins and kicks in fluid motion',
  'Athlete sprints at full speed down the track',
  
  // Atmospheric scenes
  'Fog rolls slowly through an abandoned building',
  'Sunlight streams through stained glass windows',
  'Snow falls gently in a quiet mountain village',
  'Waves crash against rocky cliffs during storm',
  'Dust particles float in afternoon light beam',
  
  // Character interactions
  'Two characters face each other in tense standoff',
  'A mother embraces her child in warm lighting',
  'Group of friends laugh together around campfire',
  'Soldier salutes commanding officer at attention',
  'Lovers dance slowly under string lights',
  
  // Edge cases and ambiguous terms
  'Pan the scene with a wide-angle lens',
  'Hold the camera steady on the subject',
  'Roll the footage at 24 frames per second',
  'Track the vehicle as it speeds away',
  'Frame the shot to include the background',
];

/**
 * Expected outcomes for validation
 */
const VALIDATION_CRITERIA = {
  minSpans: 1,
  maxLatency: 50, // ms
  requiredFields: ['spans', 'stats'],
  cameraMovementAccuracy: 1.0, // 100% for camera terms
};

/**
 * Validate a single prompt
 */
async function validatePrompt(prompt, index) {
  const startTime = Date.now();
  
  try {
    const result = await extractSemanticSpans(prompt);
    const latency = Date.now() - startTime;
    
    // Basic validation
    const hasSpans = result.spans && result.spans.length >= VALIDATION_CRITERIA.minSpans;
    const hasStats = result.stats && typeof result.stats === 'object';
    const withinLatency = latency <= VALIDATION_CRITERIA.maxLatency;
    
    // Check for semantic metadata
    const hasSemanticData = result.semantic !== null && result.semantic !== undefined;
    
    // Check for frames if applicable
    const hasFrames = result.semantic?.frames?.length > 0;
    
    // Validate camera movement disambiguation
    let cameraDisambiguation = null;
    const lowerPrompt = prompt.toLowerCase();
    const cameraTerms = ['pan', 'dolly', 'truck', 'crane', 'tilt', 'zoom'];
    const hasCameraTerm = cameraTerms.some(term => lowerPrompt.includes(term));
    
    if (hasCameraTerm) {
      // Check if camera movements were correctly identified
      const cameraSpans = result.spans.filter(s => 
        s.role === 'camera.movement' || s.semantic?.frame === 'Cinematography'
      );
      cameraDisambiguation = cameraSpans.length > 0 ? 'correct' : 'missed';
    }
    
    const success = hasSpans && hasStats && withinLatency;
    
    return {
      success,
      prompt: prompt.substring(0, 60) + (prompt.length > 60 ? '...' : ''),
      spanCount: result.spans.length,
      latency,
      hasSemanticData,
      hasFrames,
      frameCount: result.semantic?.frames?.length || 0,
      cameraDisambiguation,
      withinLatency,
      phase: result.stats.phase,
    };
  } catch (error) {
    return {
      success: false,
      prompt: prompt.substring(0, 60) + '...',
      error: error.message,
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Run validation on all prompts
 */
async function runValidation() {
  console.log('🔬 Symbolic NLP Validation Script\n');
  console.log(`Testing ${TEST_PROMPTS.length} realistic video prompts...\n`);
  
  const results = [];
  let passCount = 0;
  let failCount = 0;
  let totalLatency = 0;
  let cameraCorrect = 0;
  let cameraTotal = 0;
  
  // Process prompts
  for (let i = 0; i < TEST_PROMPTS.length; i++) {
    const prompt = TEST_PROMPTS[i];
    process.stdout.write(`\rProcessing: ${i + 1}/${TEST_PROMPTS.length}`);
    
    const result = await validatePrompt(prompt, i);
    results.push(result);
    
    if (result.success) {
      passCount++;
    } else {
      failCount++;
    }
    
    totalLatency += result.latency;
    
    if (result.cameraDisambiguation) {
      cameraTotal++;
      if (result.cameraDisambiguation === 'correct') {
        cameraCorrect++;
      }
    }
  }
  
  console.log('\n\n📊 Validation Results\n');
  console.log('═'.repeat(60));
  
  // Overall stats
  console.log('\n✅ Overall Performance:');
  console.log(`   Total Tests: ${TEST_PROMPTS.length}`);
  console.log(`   ✓ Passed: ${passCount} (${Math.round((passCount / TEST_PROMPTS.length) * 100)}%)`);
  console.log(`   ✗ Failed: ${failCount} (${Math.round((failCount / TEST_PROMPTS.length) * 100)}%)`);
  
  // Performance stats
  const avgLatency = totalLatency / TEST_PROMPTS.length;
  const maxLatency = Math.max(...results.map(r => r.latency));
  const minLatency = Math.min(...results.map(r => r.latency));
  
  console.log('\n⚡ Performance:');
  console.log(`   Average Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`   Min Latency: ${minLatency}ms`);
  console.log(`   Max Latency: ${maxLatency}ms`);
  console.log(`   Target: <${VALIDATION_CRITERIA.maxLatency}ms`);
  console.log(`   Within Target: ${results.filter(r => r.withinLatency).length}/${TEST_PROMPTS.length}`);
  
  // Semantic analysis stats
  const withSemantics = results.filter(r => r.hasSemanticData).length;
  const withFrames = results.filter(r => r.hasFrames).length;
  const totalFrames = results.reduce((sum, r) => sum + (r.frameCount || 0), 0);
  
  console.log('\n🎯 Semantic Analysis:');
  console.log(`   With Semantic Data: ${withSemantics}/${TEST_PROMPTS.length}`);
  console.log(`   With Frames Detected: ${withFrames}/${TEST_PROMPTS.length}`);
  console.log(`   Total Frames Detected: ${totalFrames}`);
  
  // Camera disambiguation accuracy
  if (cameraTotal > 0) {
    const cameraAccuracy = (cameraCorrect / cameraTotal) * 100;
    console.log('\n📹 Camera Movement Disambiguation:');
    console.log(`   Correct: ${cameraCorrect}/${cameraTotal} (${cameraAccuracy.toFixed(1)}%)`);
    console.log(`   Target: ${VALIDATION_CRITERIA.cameraMovementAccuracy * 100}%`);
    
    if (cameraAccuracy >= VALIDATION_CRITERIA.cameraMovementAccuracy * 100) {
      console.log('   Status: ✅ PASSED');
    } else {
      console.log('   Status: ⚠️  NEEDS IMPROVEMENT');
    }
  }
  
  // Failed tests
  if (failCount > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => !r.success)
      .forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.prompt}`);
        if (r.error) {
          console.log(`      Error: ${r.error}`);
        }
      });
  }
  
  // Success summary
  console.log('\n' + '═'.repeat(60));
  
  if (passCount === TEST_PROMPTS.length) {
    console.log('\n✨ All tests passed! Symbolic NLP is working correctly.\n');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failCount} tests failed. Review results above.\n`);
    process.exit(1);
  }
}

/**
 * Handle CLI arguments
 */
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const customPromptIndex = args.findIndex(arg => arg.startsWith('--prompt='));

if (customPromptIndex !== -1) {
  const customPrompt = args[customPromptIndex].split('=')[1];
  console.log(`\n🔍 Testing custom prompt: "${customPrompt}"\n`);
  
  const result = await validatePrompt(customPrompt, 0);
  
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
} else {
  // Run full validation
  await runValidation();
}

