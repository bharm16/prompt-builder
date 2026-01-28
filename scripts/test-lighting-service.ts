/**
 * Test script for LightingService
 * Run with: npx tsx --tsconfig server/tsconfig.json scripts/test-lighting-service.ts
 */

import { extractLightingSpans } from '../server/src/llm/span-labeling/nlp/LightingService.js';

async function main() {
  const testCases = [
    'The scene features soft shadows and warm ambient glow.',
    'Harsh dramatic shadows fall across the weathered face.',
    'Golden hour light illuminates the landscape with gentle shadows.',
    'Dappled light filters through the trees creating soft highlights.',
    'Cool moonlight casts long shadows on the cobblestone street.',
  ];

  console.log('🔦 Testing LightingService extraction\n');
  console.log('='.repeat(60));

  for (const text of testCases) {
    console.log(`\nInput: "${text}"`);

    try {
      const result = await extractLightingSpans(text);

      if (result.spans.length === 0) {
        console.log('  ⚠️  No spans extracted');
      } else {
        console.log(`  ✅ Extracted ${result.spans.length} span(s):`);
        for (const span of result.spans) {
          console.log(`     - "${span.text}" → ${span.role} (${span.confidence})`);
        }
      }

      console.log(`  Stats: shadows=${result.stats.shadowPhrases}, lights=${result.stats.lightPhrases}`);
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done!');
}

main().catch(console.error);
