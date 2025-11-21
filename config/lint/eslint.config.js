import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';

export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
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
      // Customize these rules as needed
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react/prop-types': 'off', // Turn off if not using prop-types
      // Security rules
      'no-secrets/no-secrets': 'error',
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
      'security/detect-unsafe-regex': 'error',
    },
  },
  // Server-side configuration
  {
    files: ['server.js', 'utils/**/*.js', 'src/**/*.js', 'migrate-*.js', 'verify-*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Test files configuration
  {
    files: ['__tests__/**/*.js', '**/*.test.js', 'vitest.setup.js'],
    languageOptions: {
      globals: {
        ...globals.node,
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
      'no-console': 'off', // Allow console in tests
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
    files: ['src/services/prompt-optimization/PromptOptimizationService.js', 'src/services/EnhancementService.js'],
    rules: {
      'no-secrets/no-secrets': 'off', // Templates contain high-entropy strings
    },
  },
  // Migration and utility scripts - allow console
  {
    files: ['migrate-*.js', 'verify-*.js'],
    rules: {
      'no-console': 'off', // Scripts need console output
    },
  },
];
