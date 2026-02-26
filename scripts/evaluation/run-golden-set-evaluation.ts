#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

const result = spawnSync('tsx', ['scripts/evaluation/span-labeling-evaluation.ts', ...args], {
  stdio: 'inherit',
  env: process.env,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
