#!/usr/bin/env tsx
/**
 * Debug script to test GLiNER directly
 */

import { config as loadEnv } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadEnv({ path: join(__dirname, '..', '.env') });

import { warmupGliner, extractSemanticSpans, isGlinerAvailable } from '../server/src/llm/span-labeling/nlp/NlpSpanService.js';

const testText = `Medium Long Shot of a delivery man with large pizza box, focused expression, and casual uniform weaving through pedestrians with a pizza box in a bustling urban street with lively storefronts at afternoon. The camera uses tracking shot from a low angle with selective focus (f/4-f/5.6) to guide attention to the main action.`;

async function test() {
  console.log('='.repeat(60));
  console.log('GLiNER Debug Test');
  console.log('='.repeat(60));
  
  console.log('\n1. Checking GLiNER availability before warmup...');
  console.log('   isGlinerAvailable():', isGlinerAvailable());
  
  console.log('\n2. Warming up GLiNER...');
  const warmup = await warmupGliner();
  console.log('   Warmup result:', warmup);
  
  console.log('\n3. Checking GLiNER availability after warmup...');
  console.log('   isGlinerAvailable():', isGlinerAvailable());
  
  console.log('\n4. Extracting spans with useGliner=true...');
  const result = await extractSemanticSpans(testText, { useGliner: true });
  
  console.log('\n5. Stats:');
  console.log(JSON.stringify(result.stats, null, 2));
  
  console.log('\n6. Span count by source:');
  const bySource: Record<string, number> = {};
  result.spans.forEach(s => {
    const src = (s as any).source || 'unknown';
    bySource[src] = (bySource[src] || 0) + 1;
  });
  console.log(JSON.stringify(bySource, null, 2));
  
  console.log('\n7. All spans:');
  result.spans.forEach((s, i) => {
    console.log(`   [${i}] "${s.text}" -> ${s.role} (conf: ${s.confidence}, src: ${(s as any).source || 'n/a'})`);
  });
  
  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
