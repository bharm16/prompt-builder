#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const CRITICAL_RULES = new Set([
  'react-hooks/rules-of-hooks',
  'no-dupe-keys',
  'no-unsafe-finally',
]);
const CRITICAL_RULE_PREFIXES = ['security/'];

function isCriticalRule(ruleId) {
  if (typeof ruleId !== 'string' || ruleId.length === 0) {
    return false;
  }

  if (CRITICAL_RULES.has(ruleId)) {
    return true;
  }

  return CRITICAL_RULE_PREFIXES.some((prefix) => ruleId.startsWith(prefix));
}

const result = spawnSync(
  'npx',
  [
    'eslint',
    '.',
    '--config',
    'config/lint/eslint.config.js',
    '--format',
    'json',
  ],
  {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  }
);

if (!result.stdout) {
  if (typeof result.status === 'number') {
    process.exit(result.status);
  }
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(result.stdout);
} catch (error) {
  console.error('[lint:critical] Failed to parse ESLint JSON output.');
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}

const findings = [];

for (const fileResult of parsed) {
  for (const message of fileResult.messages ?? []) {
    if (isCriticalRule(message.ruleId)) {
      findings.push({
        filePath: fileResult.filePath,
        line: message.line ?? 1,
        column: message.column ?? 1,
        severity: message.severity === 2 ? 'error' : 'warn',
        ruleId: message.ruleId,
        message: message.message,
      });
    }
  }
}

if (findings.length === 0) {
  console.log('[lint:critical] No critical lint findings.');
  process.exit(0);
}

console.error(`[lint:critical] Found ${findings.length} critical lint finding(s):`);
for (const finding of findings) {
  console.error(
    `- ${finding.filePath}:${finding.line}:${finding.column} [${finding.severity}] ${finding.ruleId}: ${finding.message}`
  );
}

process.exit(1);

