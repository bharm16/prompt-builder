#!/usr/bin/env npx tsx
/**
 * OpenAPI Spec Generator
 *
 * Generates `docs/openapi.json` from the programmatic spec builder.
 *
 * Usage:
 *   npm run openapi:generate
 *   npx tsx scripts/generate-openapi.ts
 *
 * The generated file is committed to the repo so that frontend developers
 * and external consumers can reference it without running the server.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildOpenApiSpec } from '../server/src/openapi/spec.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '..', 'docs', 'openapi.json');

// Ensure docs/ directory exists
mkdirSync(dirname(outputPath), { recursive: true });

const spec = buildOpenApiSpec();
const json = JSON.stringify(spec, null, 2);

writeFileSync(outputPath, json + '\n', 'utf-8');

const pathCount = Object.keys(spec.paths).length;
const schemaCount = Object.keys(spec.components.schemas).length;

console.log(`OpenAPI spec generated at: ${outputPath}`);
console.log(`  Paths:   ${pathCount}`);
console.log(`  Schemas: ${schemaCount}`);
console.log(`  Size:    ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
