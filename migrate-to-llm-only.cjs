#!/usr/bin/env node

/**
 * Migration Script: Client-side NLP to LLM-only System
 *
 * This script automates the cleanup process when transitioning from
 * dual-system (client NLP + server LLM) to single-system (server LLM only)
 *
 * Usage: node migrate-to-llm-only.js [--dry-run] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  dryRun: process.argv.includes('--dry-run'),
  verbose: process.argv.includes('--verbose'),
  projectRoot: process.cwd(),
  clientSrc: path.join(process.cwd(), 'client/src'),
};

// Files and directories to remove
const TO_REMOVE = [
  'client/src/features/prompt-optimizer/phraseExtractor.js',
  'client/src/features/prompt-optimizer/pipeline/',
  'client/src/features/prompt-optimizer/__tests__/phraseExtractor.test.js',
  'client/src/features/prompt-optimizer/__tests__/pipeline.test.js',
  'client/src/utils/promptDebugger.js', // If it contains NLP-specific debugging
];

// Imports to remove from files
const IMPORTS_TO_REMOVE = [
  'extractVideoPromptPhrases',
  'runExtractionPipeline',
  'phraseExtractor',
  'compromise',
  'pipeline/index',
];

// Console.log patterns to remove
const CONSOLE_PATTERNS = [
  /console\.log\([^)]*\);?/g,
  /console\.debug\([^)]*\);?/g,
  /console\.info\([^)]*\);?/g,
];

// Stats tracking
const stats = {
  filesRemoved: 0,
  filesModified: 0,
  importsRemoved: 0,
  consoleLogsRemoved: 0,
  errors: [],
};

/**
 * Logger utility
 */
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  verbose: (msg) => config.verbose && console.log(`   ${msg}`),
};

/**
 * Remove files and directories
 */
function removeFiles() {
  log.info('Removing obsolete files and directories...\n');

  TO_REMOVE.forEach(filePath => {
    const fullPath = path.join(config.projectRoot, filePath);

    if (fs.existsSync(fullPath)) {
      if (config.dryRun) {
        log.warning(`[DRY RUN] Would remove: ${filePath}`);
      } else {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
          log.success(`Removed: ${filePath}`);
          stats.filesRemoved++;
        } catch (error) {
          log.error(`Failed to remove ${filePath}: ${error.message}`);
          stats.errors.push(error);
        }
      }
    } else {
      log.verbose(`Already removed: ${filePath}`);
    }
  });
}

/**
 * Clean imports from JavaScript/JSX files
 */
function cleanImports() {
  log.info('\nCleaning imports from files...\n');

  const files = findJSFiles(config.clientSrc);

  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    IMPORTS_TO_REMOVE.forEach(importName => {
      const patterns = [
        new RegExp(`import.*${importName}.*from.*['"'].*['"].*\n?`, 'g'),
        new RegExp(`const.*${importName}.*=.*require\\(.*\\).*\n?`, 'g'),
        new RegExp(`import.*{[^}]*${importName}[^}]*}.*from.*['"'].*['"].*\n?`, 'g'),
      ];

      patterns.forEach(pattern => {
        if (pattern.test(content)) {
          content = content.replace(pattern, '');
          modified = true;
          stats.importsRemoved++;
          log.verbose(`Removed import '${importName}' from ${path.relative(config.projectRoot, file)}`);
        }
      });
    });

    if (modified) {
      if (config.dryRun) {
        log.warning(`[DRY RUN] Would modify: ${path.relative(config.projectRoot, file)}`);
      } else {
        fs.writeFileSync(file, content, 'utf8');
        log.success(`Modified: ${path.relative(config.projectRoot, file)}`);
        stats.filesModified++;
      }
    }
  });
}

/**
 * Remove console.log statements
 */
function removeConsoleLogs() {
  log.info('\nRemoving console.log statements...\n');

  const files = findJSFiles(config.clientSrc);
  let totalRemoved = 0;

  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    CONSOLE_PATTERNS.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, '');
        modified = true;
        totalRemoved += matches.length;
        log.verbose(`Removed ${matches.length} console statements from ${path.relative(config.projectRoot, file)}`);
      }
    });

    if (modified) {
      if (config.dryRun) {
        log.warning(`[DRY RUN] Would remove console.logs from: ${path.relative(config.projectRoot, file)}`);
      } else {
        fs.writeFileSync(file, content, 'utf8');
        stats.consoleLogsRemoved += totalRemoved;
      }
    }
  });

  if (totalRemoved > 0) {
    log.success(`Removed ${totalRemoved} console statements`);
  }
}

/**
 * Update package.json to remove compromise
 */
function updatePackageJson() {
  log.info('\nUpdating package.json...\n');

  const packagePath = path.join(config.projectRoot, 'client/package.json');

  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    let modified = false;

    ['dependencies', 'devDependencies'].forEach(depType => {
      if (packageJson[depType] && packageJson[depType].compromise) {
        if (config.dryRun) {
          log.warning(`[DRY RUN] Would remove 'compromise' from ${depType}`);
        } else {
          delete packageJson[depType].compromise;
          modified = true;
          log.success(`Removed 'compromise' from ${depType}`);
        }
      }
    });

    if (modified && !config.dryRun) {
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
    }
  }
}

/**
 * Verify no references remain
 */
function verifyCleanup() {
  log.info('\nVerifying cleanup...\n');

  const checks = [
    {
      name: 'compromise imports',
      command: 'grep -r "compromise" client/src --include="*.js" --include="*.jsx" 2>/dev/null | wc -l',
    },
    {
      name: 'extractVideoPromptPhrases references',
      command: 'grep -r "extractVideoPromptPhrases" client/src --include="*.js" --include="*.jsx" 2>/dev/null | wc -l',
    },
    {
      name: 'phraseExtractor references',
      command: 'grep -r "phraseExtractor" client/src --include="*.js" --include="*.jsx" 2>/dev/null | wc -l',
    },
    {
      name: 'console.log statements',
      command: 'grep -r "console\\.log" client/src --include="*.js" --include="*.jsx" 2>/dev/null | wc -l',
    },
  ];

  let allClean = true;

  checks.forEach(check => {
    try {
      const result = execSync(check.command, { encoding: 'utf8' }).trim();
      const count = parseInt(result) || 0;

      if (count === 0) {
        log.success(`No ${check.name} found ✓`);
      } else {
        log.warning(`Found ${count} ${check.name} - manual review needed`);
        allClean = false;
      }
    } catch (error) {
      log.verbose(`Check failed: ${check.name}`);
    }
  });

  return allClean;
}

/**
 * Find all JavaScript/JSX files
 */
function findJSFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx'))) {
        files.push(fullPath);
      }
    });
  }

  traverse(dir);
  return files;
}

/**
 * Generate migration report
 */
function generateReport() {
  console.log('\n' + '='.repeat(50));
  console.log('MIGRATION REPORT');
  console.log('='.repeat(50));

  console.log(`
Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}

Statistics:
  Files removed: ${stats.filesRemoved}
  Files modified: ${stats.filesModified}
  Imports removed: ${stats.importsRemoved}
  Console.logs removed: ${stats.consoleLogsRemoved}
  Errors: ${stats.errors.length}
`);

  if (stats.errors.length > 0) {
    console.log('Errors encountered:');
    stats.errors.forEach(error => {
      console.log(`  - ${error.message}`);
    });
  }

  console.log('='.repeat(50));
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('\n🚀 Starting migration to LLM-only highlighting system\n');
  console.log('='.repeat(50));

  if (config.dryRun) {
    log.info('Running in DRY RUN mode - no files will be modified\n');
  }

  // Step 1: Remove obsolete files
  removeFiles();

  // Step 2: Clean imports
  cleanImports();

  // Step 3: Remove console.logs
  removeConsoleLogs();

  // Step 4: Update package.json
  updatePackageJson();

  // Step 5: Verify cleanup
  const isClean = verifyCleanup();

  // Step 6: Generate report
  generateReport();

  // Final message
  if (isClean && stats.errors.length === 0) {
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm install (to update dependencies)');
    console.log('2. Run: npm test (to verify everything works)');
    console.log('3. Test the highlighting feature in the browser');
  } else {
    console.log('\n⚠️ Migration completed with warnings');
    console.log('Please review the warnings above and fix any remaining issues manually.');
  }

  if (config.dryRun) {
    console.log('\n💡 To run the actual migration, remove the --dry-run flag');
  }
}

// Run migration
migrate().catch(error => {
  log.error(`Migration failed: ${error.message}`);
  process.exit(1);
});