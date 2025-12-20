/**
 * Property Test: Zero TypeScript Compilation Errors
 *
 * Feature: typescript-config-fixes, Property 1: Zero TypeScript Compilation Errors
 * Validates: Requirements 1.3, 1.4, 2.3-2.6, 3.1, 3.4, 4.1-4.5, 5.1-5.3, 6.1-6.4, 7.1-7.4
 *
 * This property test verifies that the TypeScript configuration is correct
 * and all TypeScript files compile without errors.
 */

import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';

describe('TypeScript Configuration - Property Tests', () => {
  /**
   * Property 1: Zero TypeScript Compilation Errors
   *
   * For any TypeScript file in the project (client, server, or tests),
   * running `tsc --noEmit` SHALL produce zero errors.
   *
   * This is a universal property that must hold for all TypeScript files
   * in the codebase.
   */
  describe('Property 1: Zero TypeScript Compilation Errors', () => {
    it('should compile server code without TypeScript errors', () => {
      // Run TypeScript compiler on server code with noEmit flag
      // This validates all type checking without producing output files
      let result: string;
      let hasErrors = false;

      try {
        result = execSync('npx tsc --project server/tsconfig.json --noEmit 2>&1', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          timeout: 120000, // 2 minute timeout for compilation
        });
      } catch (error) {
        // execSync throws if the command exits with non-zero status
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        result = execError.stdout || execError.stderr || String(error);
        hasErrors = true;
      }

      // Check for TypeScript error patterns
      const errorPattern = /error TS\d+:/g;
      const errors = result.match(errorPattern) || [];

      if (hasErrors || errors.length > 0) {
        // Extract first few errors for diagnostic purposes
        const errorLines = result
          .split('\n')
          .filter((line) => line.includes('error TS'))
          .slice(0, 10);

        console.error('TypeScript compilation errors found in server code:');
        console.error(`Total errors: ${errors.length}`);
        console.error('First 10 errors:');
        errorLines.forEach((line) => console.error(`  ${line}`));
      }

      expect(errors.length, `Expected zero TypeScript errors, but found ${errors.length}`).toBe(0);
    });

    it('should compile client code without TypeScript errors', () => {
      // Run TypeScript compiler on client code with noEmit flag
      let result: string;
      let hasErrors = false;

      try {
        result = execSync('npx tsc --project client/tsconfig.json --noEmit 2>&1', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          timeout: 120000, // 2 minute timeout for compilation
        });
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        result = execError.stdout || execError.stderr || String(error);
        hasErrors = true;
      }

      // Check for TypeScript error patterns
      const errorPattern = /error TS\d+:/g;
      const errors = result.match(errorPattern) || [];

      if (hasErrors || errors.length > 0) {
        const errorLines = result
          .split('\n')
          .filter((line) => line.includes('error TS'))
          .slice(0, 10);

        console.error('TypeScript compilation errors found in client code:');
        console.error(`Total errors: ${errors.length}`);
        console.error('First 10 errors:');
        errorLines.forEach((line) => console.error(`  ${line}`));
      }

      expect(errors.length, `Expected zero TypeScript errors, but found ${errors.length}`).toBe(0);
    });

    it('should compile root project without TypeScript errors', () => {
      // Run TypeScript compiler on root tsconfig (includes all code)
      let result: string;
      let hasErrors = false;

      try {
        result = execSync('npx tsc --noEmit 2>&1', {
          encoding: 'utf-8',
          cwd: process.cwd(),
          timeout: 180000, // 3 minute timeout for full project compilation
        });
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        result = execError.stdout || execError.stderr || String(error);
        hasErrors = true;
      }

      // Check for TypeScript error patterns
      const errorPattern = /error TS\d+:/g;
      const errors = result.match(errorPattern) || [];

      if (hasErrors || errors.length > 0) {
        const errorLines = result
          .split('\n')
          .filter((line) => line.includes('error TS'))
          .slice(0, 10);

        console.error('TypeScript compilation errors found in project:');
        console.error(`Total errors: ${errors.length}`);
        console.error('First 10 errors:');
        errorLines.forEach((line) => console.error(`  ${line}`));
      }

      expect(errors.length, `Expected zero TypeScript errors, but found ${errors.length}`).toBe(0);
    });
  });
});
