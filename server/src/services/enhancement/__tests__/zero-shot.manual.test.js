/**
 * Manual Test: Zero-Shot Verification
 * 
 * This test verifies that the zero-shot prompting system is active
 * and NOT generating poisonous example patterns.
 * 
 * Run: node --experimental-modules server/src/services/enhancement/__tests__/zero-shot.manual.test.js
 * Or: npm test -- zero-shot.manual
 */

import { PromptBuilderService } from '../services/SystemPromptBuilder.js';

// Mock dependencies
const mockBrainstormBuilder = {
  buildBrainstormContextSection: (context) => {
    if (!context?.elements) return '';
    return `**Creative Brainstorm:**\nMood: ${context.elements.mood || 'none'}\n`;
  }
};

const mockVideoService = {
  isVideoPrompt: () => true,
  detectVideoPhraseRole: () => 'lighting',
  getVideoReplacementConstraints: () => ({ mode: 'micro' }),
  countWords: (text) => text.split(' ').length,
  getCategoryFocusGuidance: () => [],
  detectTargetModel: () => null,
  detectPromptSection: () => 'main_prompt',
};

// Create service
const service = new PromptBuilderService(mockBrainstormBuilder, mockVideoService);

// Test cases
const testCases = [
  {
    name: 'Simple placeholder',
    params: {
      highlightedText: '[lighting]',
      contextBefore: 'A scene with ',
      contextAfter: ' during sunset',
      fullPrompt: 'A scene with [lighting] during sunset',
      originalUserPrompt: 'scene with lighting',
      isVideoPrompt: true,
      brainstormContext: null,
      highlightedCategory: 'lighting',
      highlightedCategoryConfidence: 0.9,
      detectPlaceholderTypeFunc: null,
      dependencyContext: null,
      elementDependencies: null,
      allLabeledSpans: [],
      nearbySpans: [],
      editHistory: [],
      modelTarget: null,
      promptSection: null,
    }
  },
  {
    name: 'With brainstorm context',
    params: {
      highlightedText: '[setting]',
      contextBefore: 'A ',
      contextAfter: ' with futuristic vibes',
      fullPrompt: 'A [setting] with futuristic vibes',
      originalUserPrompt: 'futuristic setting',
      isVideoPrompt: true,
      brainstormContext: {
        elements: {
          mood: 'cyberpunk',
          style: 'neon noir'
        },
        metadata: {}
      },
      highlightedCategory: 'location',
      highlightedCategoryConfidence: 0.85,
      detectPlaceholderTypeFunc: null,
      dependencyContext: null,
      elementDependencies: null,
      allLabeledSpans: [
        { category: 'mood', text: 'futuristic vibes', start: 15, end: 32 }
      ],
      nearbySpans: [],
      editHistory: [],
      modelTarget: 'veo3',
      promptSection: 'main_prompt',
    }
  },
  {
    name: 'With edit history',
    params: {
      highlightedText: '[camera movement]',
      contextBefore: 'Shot with ',
      contextAfter: ' following the subject',
      fullPrompt: 'Shot with [camera movement] following the subject',
      originalUserPrompt: 'camera movement',
      isVideoPrompt: true,
      brainstormContext: null,
      highlightedCategory: 'camera',
      highlightedCategoryConfidence: 0.95,
      detectPlaceholderTypeFunc: null,
      dependencyContext: null,
      elementDependencies: null,
      allLabeledSpans: [],
      nearbySpans: [],
      editHistory: [
        { original: 'static shot', replacement: 'dynamic movement', category: 'camera', minutesAgo: 2 },
        { original: 'wide angle', replacement: 'tight focus', category: 'camera', minutesAgo: 5 }
      ],
      modelTarget: 'sora',
      promptSection: 'technical_specs',
    }
  }
];

// Poisonous patterns to check for
const poisonousPatterns = [
  'specific element detail',
  'alternative aspect feature',
  'varied choice showcasing',
  'different variant featuring',
  'alternative option with specific',
  'distinctive',
  'remarkable',
  'notable',
  'element',
  'aspect',
  'feature',
  'variant',
  'alternative',
  'option',
];

console.log('🧪 Zero-Shot Verification Test\n');
console.log('=' .repeat(60));

let allTestsPassed = true;

testCases.forEach((testCase, index) => {
  console.log(`\n📋 Test ${index + 1}: ${testCase.name}`);
  console.log('-'.repeat(60));
  
  try {
    const prompt = service.buildPlaceholderPrompt(testCase.params);
    
    // Check 1: Prompt should NOT contain old example JSON
    const hasOldExamples = prompt.includes('"specific element detail"') || 
                          prompt.includes('"alternative aspect"');
    
    // Check 2: Prompt should contain zero-shot format instruction
    const hasFormatInstruction = prompt.includes('replacement phrase') &&
                                prompt.includes('Category Name');
    
    // Check 3: Prompt should contain context sections
    const hasContextSections = prompt.includes('PHRASE TO ENHANCE') ||
                              prompt.includes('Context Analysis') ||
                              prompt.includes('CRITICAL REQUIREMENTS');
    
    // Check 4: If brainstorm provided, should be in prompt
    const brainstormCheck = !testCase.params.brainstormContext || 
                           prompt.includes('cyberpunk');
    
    // Check 5: If edit history provided, should be in prompt
    const editHistoryCheck = !testCase.params.editHistory?.length ||
                            prompt.includes('dynamic movement');
    
    // Results
    console.log(`✓ No old examples: ${!hasOldExamples ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`✓ Has format instruction: ${hasFormatInstruction ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`✓ Has context sections: ${hasContextSections ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`✓ Brainstorm context: ${brainstormCheck ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`✓ Edit history context: ${editHistoryCheck ? '✅ PASS' : '❌ FAIL'}`);
    
    const testPassed = !hasOldExamples && hasFormatInstruction && hasContextSections && 
                      brainstormCheck && editHistoryCheck;
    
    if (!testPassed) {
      allTestsPassed = false;
      console.log('\n❌ TEST FAILED');
      console.log('\nPrompt preview:');
      console.log(prompt.substring(0, 500) + '...\n');
    } else {
      console.log('\n✅ TEST PASSED');
    }
    
  } catch (error) {
    allTestsPassed = false;
    console.log(`\n❌ ERROR: ${error.message}`);
    console.log(error.stack);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('\n📊 Verification Summary:');
console.log('  - Zero-shot prompting is', allTestsPassed ? 'ACTIVE ✅' : 'NOT WORKING ❌');
console.log('  - Old example patterns are', allTestsPassed ? 'REMOVED ✅' : 'STILL PRESENT ❌');
console.log('  - Context enrichment is', allTestsPassed ? 'WORKING ✅' : 'BROKEN ❌');

console.log('\n💡 To verify in production:');
console.log('  1. Check logs for "Building zero-shot placeholder prompt"');
console.log('  2. Check logs for "zeroShotActive: true"');
console.log('  3. Check for WARNING if "hasPoisonousText: true"');
console.log('  4. Inspect actual suggestions - should be contextual, not generic');

process.exit(allTestsPassed ? 0 : 1);

