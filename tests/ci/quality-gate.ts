#!/usr/bin/env tsx

import { runRegression } from '../evaluation/regression/RegressionRunner.ts';

async function main() {
  const { failures } = await runRegression({ runs: 3, ci: true });
  if (failures.length === 0) {
    console.log('✅ Quality gate passed.');
    process.exit(0);
  }
  console.error('❌ Quality gate failed:');
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

