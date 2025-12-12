#!/usr/bin/env tsx

/**
 * Model Comparison Test Script
 * 
 * Tests span highlighting and enhancement suggestions with both:
 * - llama-3.1-8b-instant (baseline)
 * - llama-4-scout-17b-16e-instruct (SCOUT)
 * 
 * IMPORTANT: Since the server reads SPAN_MODEL and ENHANCE_MODEL at startup,
 * you need to restart the server with different env vars for each model test.
 * 
 * Usage:
 *   1. Set SPAN_MODEL and ENHANCE_MODEL in .env or export them
 *   2. Start server: npm start
 *   3. Run: tsx --tsconfig server/tsconfig.json scripts/test-models-comparison.ts
 *   4. Change env vars and restart server, then run again
 * 
 * Or run with env vars inline:
 *   SPAN_MODEL=llama-3.1-8b-instant ENHANCE_MODEL=llama-3.1-8b-instant npm start
 *   (in another terminal) tsx --tsconfig server/tsconfig.json scripts/test-models-comparison.ts
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3001';
const API_KEY = process.env.VITE_API_KEY || 'dev-key-12345';

// Detect current model from environment
const CURRENT_MODEL = process.env.SPAN_MODEL || process.env.ENHANCE_MODEL || 'unknown';

// Test prompts
const TEST_PROMPTS = {
  spanLabeling: [
    {
      name: 'Simple Technical Prompt',
      text: `Wide shot in 16:9, shot on Kodak Portra 400. Camera pans left as it dollies forward, ending with a tilt up. Rembrandt lighting with soft light during golden hour. ${Date.now()}`,
    },
    {
      name: 'Complex Cinematic',
      text: `Extreme wide shot of dystopian cityscape. Camera cranes up slowly while panning right. Shot on Kodak Vision3 500T with anamorphic 35mm lens. 2.39:1 aspect ratio, rendered in 8K. High-key lighting with volumetric fog during blue hour. ${Date.now()}`,
    },
    {
      name: 'Multi-Section Prompt',
      text: `A cinematic shot of a man walking through a bustling city street. ${Date.now()}

TECHNICAL SPECS
- **Duration:** 4-8s
- **Aspect Ratio:** 16:9
- **Frame Rate:** 24fps
- **Audio:** Mute

ALTERNATIVE APPROACHES
- **Variation 1:** Close-up of the man's determined expression as he gestures emphatically, framed by the urban landscape under overcast skies.`,
    },
  ],
  enhancementSuggestions: [
    {
      name: 'Placeholder Replacement',
      fullPrompt: `A cinematic shot of a [man] walking through a bustling city street. ${Date.now()}`,
      highlightedText: 'man',
      category: 'subject.identity',
      contextBefore: 'A cinematic shot of a ',
      contextAfter: ` walking through a bustling city street. ${Date.now()}`,
    },
    {
      name: 'Shot Type Enhancement',
      fullPrompt: `Eye-level shot of a dog chasing its tail in a sunlit backyard. ${Date.now()}`,
      highlightedText: 'Eye-level shot',
      category: 'shot.type',
      contextBefore: '',
      contextAfter: ` of a dog chasing its tail in a sunlit backyard. ${Date.now()}`,
    },
    {
      name: 'Lighting Enhancement',
      fullPrompt: `Close-up of a face with soft light during golden hour. ${Date.now()}`,
      highlightedText: 'soft light',
      category: 'lighting',
      contextBefore: 'Close-up of a face with ',
      contextAfter: ` during golden hour. ${Date.now()}`,
    },
  ],
} as const;

interface SpanLabelingResult {
  success: boolean;
  duration: number;
  spanCount: number;
  spans: Array<{ text: string; role: string; confidence: number }>;
  error: string | null;
}

interface EnhancementResult {
  success: boolean;
  duration: number;
  suggestionCount: number;
  suggestions: Array<{ text: string } | string>;
  isPlaceholder: boolean;
  error: string | null;
}

/**
 * Test span labeling via HTTP API
 */
async function testSpanLabeling(
  prompt: { name: string; text: string }
): Promise<SpanLabelingResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_URL}/llm/label-spans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        text: prompt.text,
        maxSpans: 60,
        minConfidence: 0.5,
        policy: {
          nonTechnicalWordLimit: 6,
          allowOverlap: false,
        },
        templateVersion: 'v2',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      duration,
      spanCount: data.spans?.length || 0,
      spans: data.spans || [],
      error: null,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      spanCount: 0,
      spans: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test enhancement suggestions via HTTP API
 */
async function testEnhancementSuggestions(
  testCase: {
    name: string;
    fullPrompt: string;
    highlightedText: string;
    category: string;
    contextBefore: string;
    contextAfter: string;
  }
): Promise<EnhancementResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_URL}/api/get-enhancement-suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        highlightedText: testCase.highlightedText,
        contextBefore: testCase.contextBefore,
        contextAfter: testCase.contextAfter,
        fullPrompt: testCase.fullPrompt,
        originalUserPrompt: testCase.fullPrompt,
        highlightedCategory: testCase.category,
        highlightedCategoryConfidence: 0.95,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      duration,
      suggestionCount: data.suggestions?.length || 0,
      suggestions: data.suggestions || [],
      isPlaceholder: data.isPlaceholder || false,
      error: null,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      duration,
      suggestionCount: 0,
      suggestions: [],
      isPlaceholder: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Format results for display
 */
function formatResults(
  results: SpanLabelingResult[] | EnhancementResult[],
  testType: 'spanLabeling' | 'enhancementSuggestions',
  modelName: string
): void {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${testType.toUpperCase()} TEST RESULTS - ${modelName}`);
  console.log('='.repeat(80));
  
  results.forEach((result, index) => {
    const testCase = testType === 'spanLabeling' 
      ? TEST_PROMPTS.spanLabeling[index]
      : TEST_PROMPTS.enhancementSuggestions[index];
    
    console.log(`\n  Test ${index + 1}: ${testCase.name}`);
    console.log(`  Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Duration: ${result.duration}ms`);
    
    if (testType === 'spanLabeling') {
      const spanResult = result as SpanLabelingResult;
      console.log(`  Spans Found: ${spanResult.spanCount}`);
      if (spanResult.spans.length > 0) {
        console.log(`  Sample Spans:`);
        spanResult.spans.slice(0, 5).forEach((span, i) => {
          console.log(`    ${i + 1}. "${span.text}" (${span.role}, confidence: ${(span.confidence * 100).toFixed(0)}%)`);
        });
      }
    } else {
      const enhanceResult = result as EnhancementResult;
      console.log(`  Suggestions: ${enhanceResult.suggestionCount}`);
      console.log(`  Is Placeholder: ${enhanceResult.isPlaceholder}`);
      if (enhanceResult.suggestions.length > 0) {
        console.log(`  Sample Suggestions:`);
        enhanceResult.suggestions.slice(0, 5).forEach((suggestion, i) => {
          const text = typeof suggestion === 'string' ? suggestion : suggestion.text;
          console.log(`    ${i + 1}. "${text}"`);
        });
      }
    }
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  });
  
  // Summary
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  console.log(`\n  Average Duration: ${avgDuration.toFixed(0)}ms`);
  
  if (testType === 'spanLabeling') {
    const spanResults = results as SpanLabelingResult[];
    const avgSpans = spanResults.reduce((sum, r) => sum + r.spanCount, 0) / spanResults.length;
    console.log(`  Average Spans Found: ${avgSpans.toFixed(1)}`);
  } else {
    const enhanceResults = results as EnhancementResult[];
    const avgSuggestions = enhanceResults.reduce((sum, r) => sum + r.suggestionCount, 0) / enhanceResults.length;
    console.log(`  Average Suggestions: ${avgSuggestions.toFixed(1)}`);
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('  MODEL COMPARISON TEST SUITE');
  console.log(`  Current Model: ${CURRENT_MODEL}`);
  console.log(`  API URL: ${API_URL}`);
  console.log('='.repeat(80));
  
  // Check if server is running
  try {
    const healthCheck = await fetch(`${API_URL}/health`);
    if (!healthCheck.ok) {
      throw new Error('Server health check failed');
    }
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('\n❌ ERROR: Server is not running or not accessible!');
    console.error(`   Make sure the server is running on ${API_URL}`);
    console.error('   Start it with: npm start\n');
    process.exit(1);
  }
  
  // Test span labeling
  console.log(`\n📝 Testing Span Labeling with ${CURRENT_MODEL}...`);
  const spanLabelingResults: SpanLabelingResult[] = [];
  
  for (const prompt of TEST_PROMPTS.spanLabeling) {
    console.log(`  Running: ${prompt.name}...`);
    const result = await testSpanLabeling(prompt);
    spanLabelingResults.push(result);
    if (!result.success) {
      console.log(`    ⚠️  Failed: ${result.error}`);
    } else {
      console.log(`    ✅ Found ${result.spanCount} spans in ${result.duration}ms`);
    }
  }
  
  // Test enhancement suggestions
  console.log(`\n💡 Testing Enhancement Suggestions with ${CURRENT_MODEL}...`);
  const enhancementResults: EnhancementResult[] = [];
  
  for (const testCase of TEST_PROMPTS.enhancementSuggestions) {
    console.log(`  Running: ${testCase.name}...`);
    const result = await testEnhancementSuggestions(testCase);
    enhancementResults.push(result);
    if (!result.success) {
      console.log(`    ⚠️  Failed: ${result.error}`);
    } else {
      console.log(`    ✅ Generated ${result.suggestionCount} suggestions in ${result.duration}ms`);
    }
  }
  
  // Display results
  formatResults(spanLabelingResults, 'spanLabeling', CURRENT_MODEL);
  formatResults(enhancementResults, 'enhancementSuggestions', CURRENT_MODEL);
  
  console.log('\n' + '='.repeat(80));
  console.log('  ✅ TESTS COMPLETED');
  console.log('='.repeat(80));
  console.log('\n📋 Next Steps:');
  console.log('   1. Save these results');
  console.log('   2. Change SPAN_MODEL and ENHANCE_MODEL in .env');
  console.log('   3. Restart server: npm restart');
  console.log('   4. Run this script again to compare\n');
}

// Run tests
runTests().catch((error) => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});


