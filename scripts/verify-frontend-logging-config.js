#!/usr/bin/env node

/**
 * Frontend Logging Configuration Verification Script
 * 
 * This script verifies that the frontend logging configuration
 * properly supports environment variables and browser access.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Verifying Frontend Logging Configuration...\n');

let allPassed = true;

// Test 1: Check LoggingService.ts exists and has required code
console.log('✓ Test 1: Checking LoggingService.ts implementation...');
try {
  const loggingServicePath = join(rootDir, 'client/src/services/LoggingService.ts');
  const content = readFileSync(loggingServicePath, 'utf-8');
  
  const checks = [
    { name: 'VITE_DEBUG_LOGGING support', pattern: /import\.meta\.env\?\.VITE_DEBUG_LOGGING/ },
    { name: 'VITE_LOG_LEVEL support', pattern: /import\.meta\.env\?\.VITE_LOG_LEVEL/ },
    { name: 'localStorage persistence', pattern: /localStorage\.setItem\(STORAGE_KEY/ },
    { name: 'getStoredLogs method', pattern: /getStoredLogs\(\): LogEntry\[\]/ },
    { name: 'exportLogs method', pattern: /exportLogs\(\): string/ },
    { name: 'clearStoredLogs method', pattern: /clearStoredLogs\(\): void/ },
    { name: 'window.__logger exposure', pattern: /window.*__logger.*=.*logger/ },
    { name: 'child logger support', pattern: /child\(context: string\): ContextLogger/ },
    { name: 'startTimer method', pattern: /startTimer\(operationId: string\)/ },
    { name: 'endTimer method', pattern: /endTimer\(operationId: string\)/ },
    { name: 'setTraceId method', pattern: /setTraceId\(traceId: string\)/ },
    { name: 'clearTraceId method', pattern: /clearTraceId\(\)/ },
  ];
  
  let testPassed = true;
  for (const check of checks) {
    if (!check.pattern.test(content)) {
      console.log(`  ❌ Missing: ${check.name}`);
      testPassed = false;
      allPassed = false;
    }
  }
  
  if (testPassed) {
    console.log('  ✅ All required features present\n');
  } else {
    console.log('');
  }
} catch (error) {
  console.log(`  ❌ Error reading LoggingService.ts: ${error.message}\n`);
  allPassed = false;
}

// Test 2: Check .env.example has logging variables
console.log('✓ Test 2: Checking .env.example documentation...');
try {
  const envExamplePath = join(rootDir, '.env.example');
  const content = readFileSync(envExamplePath, 'utf-8');
  
  const checks = [
    { name: 'VITE_DEBUG_LOGGING', pattern: /VITE_DEBUG_LOGGING/ },
    { name: 'VITE_LOG_LEVEL', pattern: /VITE_LOG_LEVEL/ },
    { name: 'LOG_LEVEL (backend)', pattern: /^LOG_LEVEL=/m },
  ];
  
  let testPassed = true;
  for (const check of checks) {
    if (!check.pattern.test(content)) {
      console.log(`  ❌ Missing: ${check.name}`);
      testPassed = false;
      allPassed = false;
    }
  }
  
  if (testPassed) {
    console.log('  ✅ All environment variables documented\n');
  } else {
    console.log('');
  }
} catch (error) {
  console.log(`  ❌ Error reading .env.example: ${error.message}\n`);
  allPassed = false;
}

// Test 3: Verify log level hierarchy
console.log('✓ Test 3: Verifying log level hierarchy...');
try {
  const loggingServicePath = join(rootDir, 'client/src/services/LoggingService.ts');
  const content = readFileSync(loggingServicePath, 'utf-8');
  
  const logLevelsMatch = content.match(/const LOG_LEVELS.*\{[\s\S]*?\}/);
  if (logLevelsMatch) {
    const logLevelsStr = logLevelsMatch[0];
    const expectedLevels = ['debug: 0', 'info: 1', 'warn: 2', 'error: 3'];
    
    let testPassed = true;
    for (const level of expectedLevels) {
      if (!logLevelsStr.includes(level)) {
        console.log(`  ❌ Missing or incorrect: ${level}`);
        testPassed = false;
        allPassed = false;
      }
    }
    
    if (testPassed) {
      console.log('  ✅ Log level hierarchy correct (debug < info < warn < error)\n');
    } else {
      console.log('');
    }
  } else {
    console.log('  ❌ Could not find LOG_LEVELS definition\n');
    allPassed = false;
  }
} catch (error) {
  console.log(`  ❌ Error verifying log levels: ${error.message}\n`);
  allPassed = false;
}

// Test 4: Check default configuration
console.log('✓ Test 4: Verifying default configuration...');
try {
  const loggingServicePath = join(rootDir, 'client/src/services/LoggingService.ts');
  const content = readFileSync(loggingServicePath, 'utf-8');
  
  const checks = [
    { 
      name: 'Development defaults to debug level', 
      pattern: /isDev \? 'debug' : 'warn'/ 
    },
    { 
      name: 'Enabled in development by default', 
      pattern: /enabled: isDev \|\| import\.meta\.env\?\.VITE_DEBUG_LOGGING === 'true'/ 
    },
    { 
      name: 'Persist to storage in development', 
      pattern: /persistToStorage: isDev/ 
    },
    { 
      name: 'Max stored logs is 500', 
      pattern: /maxStoredLogs: 500/ 
    },
  ];
  
  let testPassed = true;
  for (const check of checks) {
    if (!check.pattern.test(content)) {
      console.log(`  ❌ Missing: ${check.name}`);
      testPassed = false;
      allPassed = false;
    }
  }
  
  if (testPassed) {
    console.log('  ✅ Default configuration correct\n');
  } else {
    console.log('');
  }
} catch (error) {
  console.log(`  ❌ Error verifying defaults: ${error.message}\n`);
  allPassed = false;
}

// Test 5: Verify storage key
console.log('✓ Test 5: Verifying storage configuration...');
try {
  const loggingServicePath = join(rootDir, 'client/src/services/LoggingService.ts');
  const content = readFileSync(loggingServicePath, 'utf-8');
  
  if (content.includes("STORAGE_KEY = 'prompt_builder_logs'")) {
    console.log('  ✅ Storage key correctly set to "prompt_builder_logs"\n');
  } else {
    console.log('  ❌ Storage key not found or incorrect\n');
    allPassed = false;
  }
} catch (error) {
  console.log(`  ❌ Error verifying storage key: ${error.message}\n`);
  allPassed = false;
}

// Summary
console.log('═'.repeat(60));
if (allPassed) {
  console.log('✅ All frontend logging configuration checks passed!');
  console.log('\nThe frontend logging system properly supports:');
  console.log('  • VITE_DEBUG_LOGGING environment variable');
  console.log('  • VITE_LOG_LEVEL environment variable');
  console.log('  • Log storage in localStorage (development)');
  console.log('  • Browser console access via window.__logger');
  console.log('  • Trace ID support for request correlation');
  console.log('  • Operation timing measurements');
  console.log('  • Child logger creation with context');
  console.log('  • Log export functionality');
  process.exit(0);
} else {
  console.log('❌ Some frontend logging configuration checks failed!');
  console.log('\nPlease review the errors above and fix the issues.');
  process.exit(1);
}
