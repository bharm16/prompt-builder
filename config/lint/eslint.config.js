import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';
import tsParser from '@typescript-eslint/parser';
import tsEslint from '@typescript-eslint/eslint-plugin';
import noHardcodedCss from './eslint-plugin-no-hardcoded-css.js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.vite/**',
      '**/.cache/**',
      '**/tmp/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      security,
      'no-secrets': noSecrets,
      'no-hardcoded-css': noHardcodedCss,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/display-name': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      // Keep baseline signal useful while this branch is being stabilized.
      'no-console': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'warn',
      'no-dupe-keys': 'warn',
      'no-redeclare': 'warn',
      'no-case-declarations': 'warn',
      'no-useless-catch': 'warn',
      'no-unsafe-finally': 'warn',
      'no-constant-binary-expression': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react/prop-types': 'off', // Turn off if not using prop-types
      // Security rules
      'no-secrets/no-secrets': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'warn',
      // Hardcoded spacing/formatting values detection in inline styles
      'no-hardcoded-css/no-hardcoded-css': ['warn', {
        allowPixelValues: false,
        allowSmallValues: true, // Allow 0px, 1px, 2px for borders, etc.
        allowedProperties: ['zIndex', 'opacity', 'borderWidth'], // Properties that commonly need hardcoded values
      }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsEslint,
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  // Server-side configuration
  {
    files: ['server.{js,ts}', 'utils/**/*.{js,ts}', 'src/**/*.{js,ts}', 'migrate-*.*', 'verify-*.*'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Test files configuration
  {
    files: [
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/*.{test,spec}.{js,jsx,ts,tsx}',
      'tests/**/*.{js,jsx,ts,tsx}',
      'config/test/vitest.setup.js',
      'config/test/vitest.config.js',
      'config/test/playwright.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-secrets/no-secrets': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },
  // Load test files (k6)
  {
    files: ['load-tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
        open: 'readonly',
        http: 'readonly',
        check: 'readonly',
        sleep: 'readonly',
        group: 'readonly',
      },
    },
    rules: {
      'no-console': 'off', // Allow console in load tests
      'no-undef': 'off', // K6 has many globals
    },
  },
  // Prompt template files - disable secrets detection for false positives
  {
    files: [
      'server/src/services/prompt-optimization/PromptOptimizationService.{js,ts}',
      'server/src/services/EnhancementService.{js,ts}',
    ],
    rules: {
      'no-secrets/no-secrets': 'off', // Templates contain high-entropy strings
    },
  },
  // Migration and utility scripts - allow console
  {
    files: [
      'migrate-*.*',
      'verify-*.*',
      'scripts/**/*.{js,ts,mjs,cjs}',
    ],
    rules: {
      'no-console': 'off',
      'no-secrets/no-secrets': 'off',
    },
  },
];
