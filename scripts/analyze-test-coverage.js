#!/usr/bin/env node

/**
 * Test Coverage Analysis Script
 * Identifies all source files and their corresponding test status
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Get all source files
const clientFiles = execSync('find client/src -type f \\( -name "*.js" -o -name "*.jsx" \\) ! -path "*/node_modules/*" ! -path "*/__tests__/*" ! -name "*.test.js" ! -name "*.test.jsx"',
  { cwd: rootDir, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);

const serverFiles = execSync('find server/src -type f -name "*.js" ! -path "*/node_modules/*" ! -path "*/__tests__/*" ! -name "*.test.js"',
  { cwd: rootDir, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);

// Get all test files
const allTestFiles = execSync('find . -type f \\( -name "*.test.js" -o -name "*.test.jsx" -o -name "*.spec.js" \\) ! -path "*/node_modules/*"',
  { cwd: rootDir, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);

function hasTest(sourceFile) {
  const baseName = basename(sourceFile, sourceFile.endsWith('.jsx') ? '.jsx' : '.js');
  const dir = dirname(sourceFile);

  // Check various test file patterns
  const patterns = [
    join(dir, '__tests__', `${baseName}.test.js`),
    join(dir, '__tests__', `${baseName}.test.jsx`),
    join(dir, `${baseName}.test.js`),
    join(dir, `${baseName}.test.jsx`),
    `tests/unit/${sourceFile.replace('.js', '.test.js').replace('.jsx', '.test.jsx')}`,
  ];

  for (const pattern of patterns) {
    if (existsSync(join(rootDir, pattern))) {
      return pattern;
    }
  }

  // Check if any test file mentions this file
  const fileNameOnly = basename(sourceFile);
  for (const testFile of allTestFiles) {
    if (testFile.includes(baseName)) {
      return testFile;
    }
  }

  return null;
}

function categorizeFile(filePath) {
  if (filePath.includes('/components/') && filePath.endsWith('.jsx')) return 'React Components';
  if (filePath.includes('/hooks/')) return 'Custom Hooks';
  if (filePath.includes('/utils/')) return 'Utility Functions';
  if (filePath.includes('/services/')) return 'API/Service Layers';
  if (filePath.includes('/context/')) return 'Context Providers';
  if (filePath.includes('/config/')) return 'Configuration';
  if (filePath.includes('/middleware/')) return 'Middleware';
  if (filePath.includes('/routes/')) return 'Routes';
  if (filePath.includes('/clients/')) return 'API Clients';
  if (filePath.includes('/infrastructure/')) return 'Infrastructure';
  if (filePath.includes('/repositories/')) return 'Repositories';
  if (filePath.endsWith('.jsx')) return 'React Components';
  return 'Other';
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('TEST COVERAGE ANALYSIS');
console.log('═══════════════════════════════════════════════════════\n');

// Analyze CLIENT files
const clientUntested = [];
const clientTested = [];

for (const file of clientFiles) {
  // Skip entry files and config files for now
  if (file.includes('main.jsx') || file.includes('App.jsx')) continue;

  const testFile = hasTest(file);
  if (testFile) {
    clientTested.push({ source: file, test: testFile });
  } else {
    clientUntested.push(file);
  }
}

// Analyze SERVER files
const serverUntested = [];
const serverTested = [];

for (const file of serverFiles) {
  // Skip entry files
  if (file.includes('server.js') || file.includes('app.js') || file.includes('index.js')) continue;
  if (file.includes('/interfaces/') || file.includes('/contracts/')) continue; // Skip interface definitions

  const testFile = hasTest(file);
  if (testFile) {
    serverTested.push({ source: file, test: testFile });
  } else {
    serverUntested.push(file);
  }
}

// Categorize untested files
const clientByCategory = {};
const serverByCategory = {};

for (const file of clientUntested) {
  const category = categorizeFile(file);
  if (!clientByCategory[category]) clientByCategory[category] = [];
  clientByCategory[category].push(file);
}

for (const file of serverUntested) {
  const category = categorizeFile(file);
  if (!serverByCategory[category]) serverByCategory[category] = [];
  serverByCategory[category].push(file);
}

console.log('📊 CLIENT-SIDE SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`Total Source Files: ${clientFiles.length}`);
console.log(`Tested Files: ${clientTested.length} (${Math.round(clientTested.length/clientFiles.length*100)}%)`);
console.log(`Untested Files: ${clientUntested.length} (${Math.round(clientUntested.length/clientFiles.length*100)}%)\n`);

console.log('UNTESTED FILES BY CATEGORY:\n');
for (const [category, files] of Object.entries(clientByCategory).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${category}: ${files.length} files`);
  files.forEach(f => console.log(`  - ${f}`));
  console.log('');
}

console.log('\n📊 SERVER-SIDE SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`Total Source Files: ${serverFiles.length}`);
console.log(`Tested Files: ${serverTested.length} (${Math.round(serverTested.length/serverFiles.length*100)}%)`);
console.log(`Untested Files: ${serverUntested.length} (${Math.round(serverUntested.length/serverFiles.length*100)}%)\n`);

console.log('UNTESTED FILES BY CATEGORY:\n');
for (const [category, files] of Object.entries(serverByCategory).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${category}: ${files.length} files`);
  files.forEach(f => console.log(`  - ${f}`));
  console.log('');
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('OVERALL STATISTICS');
console.log('═══════════════════════════════════════════════════════\n');

const totalFiles = clientFiles.length + serverFiles.length;
const totalTested = clientTested.length + serverTested.length;
const totalUntested = clientUntested.length + serverUntested.length;

console.log(`Total Source Files: ${totalFiles}`);
console.log(`Total Tested: ${totalTested} (${Math.round(totalTested/totalFiles*100)}%)`);
console.log(`Total Untested: ${totalUntested} (${Math.round(totalUntested/totalFiles*100)}%)`);
console.log(`\nEstimated Test Files to Create: ${totalUntested}`);
console.log('');
