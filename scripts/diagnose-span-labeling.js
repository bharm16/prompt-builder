#!/usr/bin/env node

/**
 * Span Labeling Diagnostic Script
 * 
 * Tests all symptoms:
 * 1. Text mismatch/paraphrasing (fuzzy matching rate)
 * 2. Wrong categories
 * 3. Missing spans
 * 4. Hallucinated text
 * 5. JSON parse failures
 * 6. Fragmentation
 * 7. Repair loop frequency
 * 8. Performance
 * 
 * Usage:
 *   node scripts/diagnose-span-labeling.js
 */

import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';

// Load environment variables
config();
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { labelSpans } from '../server/src/llm/span-labeling/SpanLabelingService.ts';
import { SubstringPositionCache } from '../server/src/llm/span-labeling/cache/SubstringPositionCache.js';
import { mergeAdjacentSpans } from '../server/src/llm/span-labeling/processing/AdjacentSpanMerger.js';
import { AIModelService } from '../server/src/services/ai-model/AIModelService.ts';
import { OpenAICompatibleAdapter } from '../server/src/clients/adapters/OpenAICompatibleAdapter.ts';
import { GeminiAdapter } from '../server/src/clients/adapters/GeminiAdapter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test prompts with expected results
const TEST_PROMPTS = [
  {
    name: "Camera vs Action Disambiguation",
    text: "The camera slowly pans right as the actor walks across the stage",
    expectedSpans: [
      { text: "camera slowly pans right", role: "camera.movement" },
      { text: "actor walks across the stage", role: "action.movement" }
    ],
    antiPatterns: [
      { text: "pans", role: "action.movement" }, // Should NOT be action
      { text: "walks", role: "camera.movement" }   // Should NOT be camera
    ]
  },
  {
    name: "Shot Type Detection",
    text: "Close-up shot of a detective's weathered hands holding a vintage camera",
    expectedSpans: [
      { text: "Close-up shot", role: "shot.type" },
      { text: "detective", role: "subject.identity" },
      { text: "weathered hands", role: "subject.appearance" }
    ]
  },
  {
    name: "Technical Specs Extraction",
    text: `**TECHNICAL SPECS**
- **Duration:** 4-8s
- **Aspect Ratio:** 16:9
- **Frame Rate:** 24fps
- **Audio:** Natural ambience`,
    expectedSpans: [
      { text: "4-8s", role: "technical.duration" },
      { text: "16:9", role: "technical.aspectRatio" },
      { text: "24fps", role: "technical.frameRate" },
      { text: "Natural ambience", role: "audio.score" }
    ]
  },
  {
    name: "Fragmentation Test",
    text: "Action shot of a dog running through a park",
    // Should be ONE span "Action shot", not "Action" + "shot"
    expectedNoFragmentation: ["Action shot"]
  },
  {
    name: "Complex Multi-Section",
    text: `Wide shot of George Washington draped in a blue Revolutionary War uniform, standing amidst a leaf-strewn battlefield under overcast skies. He gestures emphatically to soldiers, rallying their spirits as fallen leaves swirl around him in the brisk wind. The camera slowly pans in from a distance, capturing the tension and urgency of the moment.

**TECHNICAL SPECS**
- **Duration:** 4-8s
- **Aspect Ratio:** 16:9
- **Frame Rate:** 24fps`,
    expectedSpans: [
      { text: "Wide shot", role: "shot.type" },
      { text: "camera slowly pans", role: "camera.movement" },
      { text: "4-8s", role: "technical.duration" },
      { text: "16:9", role: "technical.aspectRatio" },
      { text: "24fps", role: "technical.frameRate" }
    ]
  }
];

/**
 * Diagnostic Results Structure
 */
class DiagnosticResults {
  constructor() {
    this.results = [];
    this.summary = {
      totalTests: 0,
      textMismatch: { count: 0, rate: 0 },
      wrongCategories: { count: 0, rate: 0 },
      missingSpans: { count: 0, rate: 0 },
      hallucinatedText: { count: 0, rate: 0 },
      jsonParseFailures: { count: 0, rate: 0 },
      fragmentation: { count: 0, rate: 0 },
      repairLoopTriggered: { count: 0, rate: 0 },
      performance: { avgMs: 0, p95Ms: 0, p99Ms: 0 }
    };
  }

  addResult(testName, result) {
    this.results.push({ testName, ...result });
    this.summary.totalTests++;
  }

  calculateSummary() {
    // Calculate rates
    if (this.summary.totalTests > 0) {
      this.summary.textMismatch.rate = this.summary.textMismatch.count / this.summary.totalTests;
      this.summary.wrongCategories.rate = this.summary.wrongCategories.count / this.summary.totalTests;
      this.summary.missingSpans.rate = this.summary.missingSpans.count / this.summary.totalTests;
      this.summary.hallucinatedText.rate = this.summary.hallucinatedText.count / this.summary.totalTests;
      this.summary.jsonParseFailures.rate = this.summary.jsonParseFailures.count / this.summary.totalTests;
      this.summary.fragmentation.rate = this.summary.fragmentation.count / this.summary.totalTests;
      this.summary.repairLoopTriggered.rate = this.summary.repairLoopTriggered.count / this.summary.totalTests;
    }
  }
}

/**
 * Test 1: Text Mismatch/Paraphrasing
 */
function testTextMismatch(text, spans, cache) {
  const telemetry = cache.getTelemetry();
  const totalSpans = spans.length;
  const exactMatches = telemetry.exactMatches || 0;
  const fuzzyMatches = telemetry.fuzzyMatches || 0;
  const failures = telemetry.failures || 0;
  
  const exactMatchRate = totalSpans > 0 ? exactMatches / totalSpans : 0;
  const fuzzyMatchRate = totalSpans > 0 ? fuzzyMatches / totalSpans : 0;
  const failureRate = totalSpans > 0 ? failures / totalSpans : 0;

  // Check for spans that don't match exactly
  const mismatchedSpans = spans.filter(span => {
    const exactText = text.substring(span.start, span.end);
    return exactText !== span.text;
  });

  return {
    exactMatchRate,
    fuzzyMatchRate,
    failureRate,
    mismatchedSpans: mismatchedSpans.length,
    telemetry
  };
}

/**
 * Test 2: Wrong Categories
 */
function testWrongCategories(spans, expectedSpans, antiPatterns) {
  const wrongCategories = [];
  
  // Check expected spans
  if (expectedSpans) {
    expectedSpans.forEach(expected => {
      const found = spans.find(s => 
        s.text.toLowerCase().includes(expected.text.toLowerCase()) ||
        expected.text.toLowerCase().includes(s.text.toLowerCase())
      );
      
      if (found && found.role !== expected.role) {
        wrongCategories.push({
          text: found.text,
          expectedRole: expected.role,
          actualRole: found.role,
          type: 'wrong_category'
        });
      } else if (!found) {
        wrongCategories.push({
          text: expected.text,
          expectedRole: expected.role,
          actualRole: 'MISSING',
          type: 'missing_span'
        });
      }
    });
  }

  // Check anti-patterns (things that should NOT happen)
  if (antiPatterns) {
    antiPatterns.forEach(anti => {
      const found = spans.find(s => 
        s.text.toLowerCase().includes(anti.text.toLowerCase()) &&
        s.role === anti.role
      );
      
      if (found) {
        wrongCategories.push({
          text: found.text,
          expectedRole: `NOT ${anti.role}`,
          actualRole: anti.role,
          type: 'anti_pattern'
        });
      }
    });
  }

  return {
    wrongCategories,
    wrongCategoryCount: wrongCategories.filter(w => w.type === 'wrong_category').length,
    missingSpanCount: wrongCategories.filter(w => w.type === 'missing_span').length,
    antiPatternCount: wrongCategories.filter(w => w.type === 'anti_pattern').length
  };
}

/**
 * Test 3: Missing Spans
 */
function testMissingSpans(text, spans, expectedSpans) {
  if (!expectedSpans) return { missingCount: 0, missingSpans: [] };

  const missing = expectedSpans.filter(expected => {
    const found = spans.some(s => {
      const spanText = text.substring(s.start, s.end);
      return spanText.toLowerCase().includes(expected.text.toLowerCase()) ||
             expected.text.toLowerCase().includes(spanText.toLowerCase());
    });
    return !found;
  });

  return {
    missingCount: missing.length,
    missingSpans: missing.map(m => m.text)
  };
}

/**
 * Test 4: Hallucinated Text
 */
function testHallucinatedText(text, spans) {
  const hallucinated = spans.filter(span => {
    const spanText = text.substring(span.start, span.end);
    // Check if the span text matches what was returned
    // If fuzzy matching was required, it might be hallucinated
    return spanText !== span.text;
  });

  return {
    hallucinatedCount: hallucinated.length,
    hallucinatedSpans: hallucinated.map(s => ({
      returned: s.text,
      actual: text.substring(s.start, s.end)
    }))
  };
}

/**
 * Test 5: JSON Parse Failures
 */
function testJSONParseFailures(result, meta) {
  const hasSchemaErrors = meta?.notes?.includes('schema') || 
                         meta?.notes?.includes('validation') ||
                         meta?.notes?.includes('repair');
  
  return {
    hasSchemaErrors,
    repairTriggered: meta?.notes?.includes('repair') || false
  };
}

/**
 * Test 6: Fragmentation
 */
function testFragmentation(text, spans, expectedNoFragmentation) {
  // Check for adjacent spans that should be merged
  const sortedSpans = [...spans].sort((a, b) => a.start - b.start);
  const fragmentationIssues = [];
  
  for (let i = 0; i < sortedSpans.length - 1; i++) {
    const current = sortedSpans[i];
    const next = sortedSpans[i + 1];
    const gap = text.substring(current.end, next.start);
    
    // If gap is small (whitespace/punctuation only) and roles are compatible
    if (gap.trim().length <= 3 && gap.match(/^[\s,\-_]+$/)) {
      const currentParent = current.role.split('.')[0];
      const nextParent = next.role.split('.')[0];
      
      if (currentParent === nextParent) {
        fragmentationIssues.push({
          fragments: [current.text, next.text],
          merged: text.substring(current.start, next.end),
          gap: gap,
          role: current.role
        });
      }
    }
  }

  // Check against expected no-fragmentation patterns
  let expectedFragmentationViolations = 0;
  if (expectedNoFragmentation) {
    expectedNoFragmentation.forEach(expected => {
      const foundFragments = spans.filter(s => 
        expected.toLowerCase().includes(s.text.toLowerCase())
      );
      
      if (foundFragments.length > 1) {
        expectedFragmentationViolations++;
      }
    });
  }

  return {
    fragmentationIssues,
    fragmentationCount: fragmentationIssues.length,
    expectedFragmentationViolations
  };
}

/**
 * Test 7: Performance
 */
function testPerformance(timings) {
  if (timings.length === 0) return { avg: 0, p95: 0, p99: 0, timings: [] };
  
  const sorted = [...timings].sort((a, b) => a - b);
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];

  return { avg, p95, p99, timings };
}

/**
 * Run diagnostic on a single prompt
 */
async function diagnosePrompt(testCase, aiService) {
  const cache = new SubstringPositionCache();
  const startTime = Date.now();
  
  let result;
  let jsonParseError = false;
  let repairTriggered = false;

  try {
    result = await labelSpans({
      text: testCase.text,
      maxSpans: 60,
      minConfidence: 0.5,
      policy: {
        nonTechnicalWordLimit: 6,
        allowOverlap: false
      },
      templateVersion: 'v2',
      enableRepair: true
    }, aiService);
  } catch (error) {
    jsonParseError = true;
    return {
      error: error.message,
      jsonParseError: true
    };
  }

  const endTime = Date.now();
  const duration = endTime - startTime;

  // Check for repair loop indicators
  repairTriggered = result.meta?.notes?.includes('repair') || false;

  const spans = result.spans || [];

  // Run all diagnostic tests
  const textMismatch = testTextMismatch(testCase.text, spans, cache);
  const wrongCategories = testWrongCategories(spans, testCase.expectedSpans, testCase.antiPatterns);
  const missingSpans = testMissingSpans(testCase.text, spans, testCase.expectedSpans);
  const hallucinated = testHallucinatedText(testCase.text, spans);
  const jsonParse = testJSONParseFailures(result, result.meta);
  const fragmentation = testFragmentation(testCase.text, spans, testCase.expectedNoFragmentation);
  
  // Check for adjacent spans that could be merged
  const { spans: mergedSpans, notes: mergeNotes } = mergeAdjacentSpans(spans, testCase.text);
  const mergeableCount = spans.length - mergedSpans.length;

  return {
    testName: testCase.name,
    duration,
    spanCount: spans.length,
    textMismatch,
    wrongCategories,
    missingSpans,
    hallucinated,
    jsonParse: { ...jsonParse, jsonParseError },
    fragmentation: {
      ...fragmentation,
      mergeableCount,
      mergeNotes
    },
    repairTriggered,
    spans: spans.map(s => ({
      text: s.text,
      role: s.role,
      confidence: s.confidence,
      start: s.start,
      end: s.end
    }))
  };
}

/**
 * Create AI service
 */
function createAIService() {
  const clients = {};
  
  // Create OpenAI/Groq client
  if (process.env.GROQ_API_KEY) {
    clients.groq = new OpenAICompatibleAdapter({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.1-8b-instant',
      providerName: 'groq'
    });
  }
  
  // Create OpenAI client
  if (process.env.OPENAI_API_KEY) {
    clients.openai = new OpenAICompatibleAdapter({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      providerName: 'openai'
    });
  }
  
  // Create Gemini client
  if (process.env.GEMINI_API_KEY) {
    clients.gemini = new GeminiAdapter({
      apiKey: process.env.GEMINI_API_KEY,
      defaultModel: 'gemini-2.0-flash-exp',
      providerName: 'gemini'
    });
  }

  if (Object.keys(clients).length === 0) {
    throw new Error('No AI API keys found. Set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY');
  }

  return new AIModelService({ clients });
}

/**
 * Main diagnostic runner
 */
async function runDiagnostics() {
  console.log('🔍 Span Labeling Diagnostic Tool\n');
  console.log('='.repeat(80));

  // Initialize AI service
  let aiService;
  try {
    aiService = createAIService();
  } catch (error) {
    console.error(`❌ Failed to initialize AI service: ${error.message}`);
    process.exit(1);
  }

  const results = new DiagnosticResults();
  const timings = [];

  // Run diagnostics on each test case
  for (const testCase of TEST_PROMPTS) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`   Input: "${testCase.text.substring(0, 100)}${testCase.text.length > 100 ? '...' : ''}"`);
    
    const result = await diagnosePrompt(testCase, aiService);
    
    if (result.error) {
      console.log(`   ❌ ERROR: ${result.error}`);
      results.addResult(testCase.name, result);
      continue;
    }

    timings.push(result.duration);
    results.addResult(testCase.name, result);

    // Update summary counts
    if (result.textMismatch.fuzzyMatchRate > 0 || result.textMismatch.failureRate > 0) {
      results.summary.textMismatch.count++;
    }
    if (result.wrongCategories.wrongCategoryCount > 0) {
      results.summary.wrongCategories.count++;
    }
    if (result.missingSpans.missingCount > 0) {
      results.summary.missingSpans.count++;
    }
    if (result.hallucinated.hallucinatedCount > 0) {
      results.summary.hallucinatedText.count++;
    }
    if (result.jsonParse.jsonParseError || result.jsonParse.hasSchemaErrors) {
      results.summary.jsonParseFailures.count++;
    }
    if (result.fragmentation.fragmentationCount > 0 || result.fragmentation.expectedFragmentationViolations > 0) {
      results.summary.fragmentation.count++;
    }
    if (result.repairTriggered) {
      results.summary.repairLoopTriggered.count++;
    }

    // Print results
    console.log(`   ⏱️  Duration: ${result.duration}ms`);
    console.log(`   📊 Spans found: ${result.spanCount}`);
    
    if (result.textMismatch.fuzzyMatchRate > 0) {
      console.log(`   ⚠️  Text Mismatch: ${(result.textMismatch.fuzzyMatchRate * 100).toFixed(1)}% fuzzy matches`);
    }
    
    if (result.wrongCategories.wrongCategoryCount > 0) {
      console.log(`   ❌ Wrong Categories: ${result.wrongCategories.wrongCategoryCount} found`);
      result.wrongCategories.wrongCategories.slice(0, 3).forEach(w => {
        if (w.type === 'wrong_category') {
          console.log(`      - "${w.text}": expected ${w.expectedRole}, got ${w.actualRole}`);
        }
      });
    }
    
    if (result.missingSpans.missingCount > 0) {
      console.log(`   ⚠️  Missing Spans: ${result.missingSpans.missingCount}`);
      result.missingSpans.missingSpans.slice(0, 3).forEach(m => console.log(`      - "${m}"`));
    }
    
    if (result.fragmentation.fragmentationCount > 0) {
      console.log(`   ⚠️  Fragmentation: ${result.fragmentation.fragmentationCount} mergeable pairs`);
      if (result.fragmentation.mergeNotes && result.fragmentation.mergeNotes.length > 0) {
        result.fragmentation.mergeNotes.slice(0, 3).forEach(note => {
          console.log(`      - ${note}`);
        });
      }
    }
    
    if (result.repairTriggered) {
      console.log(`   ⚠️  Repair Loop: Triggered`);
    }
  }

  // Calculate summary
  results.summary.performance = testPerformance(timings);
  results.calculateSummary();

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 DIAGNOSTIC SUMMARY\n');
  
  console.log(`Total Tests: ${results.summary.totalTests}`);
  console.log(`\nSymptom Rates:`);
  console.log(`  Text Mismatch: ${(results.summary.textMismatch.rate * 100).toFixed(1)}%`);
  console.log(`  Wrong Categories: ${(results.summary.wrongCategories.rate * 100).toFixed(1)}%`);
  console.log(`  Missing Spans: ${(results.summary.missingSpans.rate * 100).toFixed(1)}%`);
  console.log(`  Hallucinated Text: ${(results.summary.hallucinatedText.rate * 100).toFixed(1)}%`);
  console.log(`  JSON Parse Failures: ${(results.summary.jsonParseFailures.rate * 100).toFixed(1)}%`);
  console.log(`  Fragmentation: ${(results.summary.fragmentation.rate * 100).toFixed(1)}%`);
  console.log(`  Repair Loop Triggered: ${(results.summary.repairLoopTriggered.rate * 100).toFixed(1)}%`);
  
  console.log(`\nPerformance:`);
  console.log(`  Average: ${results.summary.performance.avg.toFixed(0)}ms`);
  console.log(`  P95: ${results.summary.performance.p95.toFixed(0)}ms`);
  console.log(`  P99: ${results.summary.performance.p99.toFixed(0)}ms`);

  // Save detailed results
  const outputPath = join(__dirname, '../diagnostic-results.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to: ${outputPath}`);

  return results;
}

// Run if called directly
runDiagnostics().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

