#!/usr/bin/env node

/**
 * Verify Route Logging Implementation
 * 
 * This script verifies that all API routes have proper logging according to
 * Requirements 2.1-2.7 from the comprehensive-logging spec.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROUTES_DIR = path.join(__dirname, '../server/src/routes');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check if a route handler has proper logging
 */
function analyzeRouteHandler(content, routePath, method) {
  const checks = {
    hasRequestId: false,
    hasOperation: false,
    hasStartTime: false,
    hasRequestLog: false,
    hasResponseLog: false,
    hasErrorLog: false,
    hasDuration: false,
  };

  // Extract the route handler function
  const handlerMatch = content.match(new RegExp(`router\\.${method}\\([^)]*\\).*?(?=router\\.|return router|$)`, 's'));
  
  if (!handlerMatch) {
    return { found: false, checks };
  }

  const handler = handlerMatch[0];

  // Check for requestId
  checks.hasRequestId = /req\.id|requestId\s*=/.test(handler);

  // Check for operation name
  checks.hasOperation = /operation\s*=\s*['"`]/.test(handler);

  // Check for start time
  checks.hasStartTime = /(startTime|performance\.now\(\))/.test(handler);

  // Check for request received log (info or debug)
  checks.hasRequestLog = /logger\.(info|debug)\([^)]*request|logger\.(info|debug)\([^)]*received|log\.(info|debug)\([^)]*request/.test(handler);

  // Check for response/completion log (info)
  checks.hasResponseLog = /logger\.info\([^)]*complet|logger\.info\([^)]*success|log\.info\([^)]*complet/.test(handler);

  // Check for error log with Error object
  checks.hasErrorLog = /logger\.error\([^)]*,\s*error|log\.error\([^)]*,\s*error/.test(handler);

  // Check for duration calculation
  checks.hasDuration = /duration.*performance\.now\(\)|Date\.now\(\)\s*-\s*startTime/.test(handler);

  return { found: true, checks, handler };
}

/**
 * Analyze a route file
 */
function analyzeRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`Analyzing: ${fileName}`, 'cyan');
  log('='.repeat(80), 'cyan');

  // Find all route definitions
  const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  const routes = [];

  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      method: match[1],
      path: match[2],
      position: match.index,
    });
  }

  if (routes.length === 0) {
    log('  No routes found', 'yellow');
    return { file: fileName, routes: [], allPassed: true };
  }

  const results = [];

  for (const route of routes) {
    const analysis = analyzeRouteHandler(content, route.path, route.method);
    
    if (!analysis.found) {
      log(`\n  ${route.method.toUpperCase()} ${route.path}`, 'blue');
      log('    ⚠️  Could not analyze handler', 'yellow');
      continue;
    }

    const { checks } = analysis;
    const allChecks = Object.values(checks).every(v => v === true);

    log(`\n  ${route.method.toUpperCase()} ${route.path}`, 'blue');
    
    // Display check results
    log(`    ${checks.hasRequestId ? '✅' : '❌'} Request ID`, checks.hasRequestId ? 'green' : 'red');
    log(`    ${checks.hasOperation ? '✅' : '❌'} Operation name`, checks.hasOperation ? 'green' : 'red');
    log(`    ${checks.hasStartTime ? '✅' : '❌'} Start time tracking`, checks.hasStartTime ? 'green' : 'red');
    log(`    ${checks.hasRequestLog ? '✅' : '❌'} Request received log`, checks.hasRequestLog ? 'green' : 'red');
    log(`    ${checks.hasResponseLog ? '✅' : '❌'} Response/completion log`, checks.hasResponseLog ? 'green' : 'red');
    log(`    ${checks.hasErrorLog ? '✅' : '❌'} Error log with Error object`, checks.hasErrorLog ? 'green' : 'red');
    log(`    ${checks.hasDuration ? '✅' : '❌'} Duration calculation`, checks.hasDuration ? 'green' : 'red');

    if (allChecks) {
      log('    ✅ All checks passed', 'green');
    } else {
      log('    ❌ Some checks failed', 'red');
    }

    results.push({
      route: `${route.method.toUpperCase()} ${route.path}`,
      checks,
      passed: allChecks,
    });
  }

  const allPassed = results.every(r => r.passed);
  
  log(`\n  Summary: ${results.filter(r => r.passed).length}/${results.length} routes passed`, allPassed ? 'green' : 'yellow');

  return { file: fileName, routes: results, allPassed };
}

/**
 * Main execution
 */
function main() {
  log('\n' + '='.repeat(80), 'cyan');
  log('Route Logging Verification', 'cyan');
  log('='.repeat(80), 'cyan');

  const routeFiles = fs.readdirSync(ROUTES_DIR)
    .filter(f => (f.endsWith('.js') || f.endsWith('.ts')) && !f.endsWith('.test.js') && !f.endsWith('.test.ts'))
    .map(f => path.join(ROUTES_DIR, f));

  const results = routeFiles.map(analyzeRouteFile);

  // Overall summary
  log('\n' + '='.repeat(80), 'cyan');
  log('Overall Summary', 'cyan');
  log('='.repeat(80), 'cyan');

  const totalRoutes = results.reduce((sum, r) => sum + r.routes.length, 0);
  const passedRoutes = results.reduce((sum, r) => sum + r.routes.filter(route => route.passed).length, 0);
  const allFilesPassed = results.every(r => r.allPassed);

  for (const result of results) {
    const status = result.allPassed ? '✅' : '❌';
    const passedCount = result.routes.filter(r => r.passed).length;
    log(`  ${status} ${result.file}: ${passedCount}/${result.routes.length} routes`, result.allPassed ? 'green' : 'yellow');
  }

  log(`\n  Total: ${passedRoutes}/${totalRoutes} routes passed`, passedRoutes === totalRoutes ? 'green' : 'yellow');

  if (allFilesPassed) {
    log('\n✅ All route files have proper logging!', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some routes need logging improvements', 'red');
    process.exit(1);
  }
}

main();
