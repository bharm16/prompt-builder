/**
 * Test Compromise on real evaluation prompts
 * Now with semantic verb classification
 */

import { extractActionSpans, warmupCompromise } from '../server/src/llm/span-labeling/nlp/CompromiseService.js';
import { readFileSync } from 'fs';

async function main() {
  const evalData = JSON.parse(
    readFileSync('./scripts/evaluation/data/evaluation-prompts-latest.json', 'utf-8')
  );

  console.log('=== Compromise Test on Evaluation Prompts ===\n');

  // Warm up the semantic classifier
  console.log('Warming up semantic verb classifier...');
  const warmup = await warmupCompromise();
  console.log(`Warmup: ${warmup.success ? '✓' : '✗'} (${warmup.latencyMs}ms)\n`);

  const prompts = evalData.prompts.slice(0, 10);

  let totalActions = 0;
  const allActions: Array<{ text: string; role: string }> = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    const output = prompt.output as string;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${i + 1}] Input: "${prompt.input}"`);
    console.log(`${'─'.repeat(60)}`);

    // Extract from the main section only (before TECHNICAL SPECS)
    const mainSection = output.split('**TECHNICAL SPECS**')[0] || output;

    const result = await extractActionSpans(mainSection);

    if (result.spans.length > 0) {
      console.log(`\n  Actions found (${result.spans.length}):`);
      for (const span of result.spans) {
        const roleShort = span.role.replace('action.', '');
        console.log(`    ✓ "${span.text}" → ${roleShort} (conf: ${span.confidence.toFixed(2)})`);
        allActions.push({ text: span.text, role: span.role });
      }
      totalActions += result.spans.length;
    } else {
      console.log(`\n  ⚠ No actions found in main section`);
    }

    console.log(`  Stats: ${result.stats.verbPhrases} verb phrases, ${result.stats.gerunds} gerunds, ${result.stats.latencyMs}ms`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'═'.repeat(60)}`);
  console.log(`Total prompts tested: ${prompts.length}`);
  console.log(`Total actions extracted: ${totalActions}`);
  console.log(`Average per prompt: ${(totalActions / prompts.length).toFixed(1)}`);

  // Group by role
  const byRole = allActions.reduce(
    (acc, { role }) => {
      const r = role.replace('action.', '');
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`\nActions by role:`);
  for (const [role, count] of Object.entries(byRole).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${role}: ${count}`);
  }

  console.log(`\nUnique actions found:`);
  const uniqueActions = [...new Set(allActions.map((a) => `${a.text} (${a.role.replace('action.', '')})`))].sort();
  for (const action of uniqueActions) {
    console.log(`  - ${action}`);
  }
}

main().catch(console.error);
