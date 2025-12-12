import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, '../../'),
  plugins: [react()],
  resolve: {
    // Note: both client and server use "@utils" with different roots.
    // We alias known server utils first, then fall back to client utils.
    alias: [
      { find: '@shared', replacement: path.resolve(__dirname, '../../shared') },
      { find: '@config', replacement: path.resolve(__dirname, '../../server/src/config') },
      { find: '@infrastructure', replacement: path.resolve(__dirname, '../../server/src/infrastructure') },
      { find: '@interfaces', replacement: path.resolve(__dirname, '../../server/src/interfaces') },
      { find: '@llm', replacement: path.resolve(__dirname, '../../server/src/llm') },
      { find: /^@utils\/provider/, replacement: path.resolve(__dirname, '../../server/src/utils/provider') },
      { find: /^@utils\/logging/, replacement: path.resolve(__dirname, '../../server/src/utils/logging') },
      { find: /^@utils\/ConstitutionalAI/, replacement: path.resolve(__dirname, '../../server/src/utils/ConstitutionalAI') },
      { find: /^@utils\/JsonExtractor/, replacement: path.resolve(__dirname, '../../server/src/utils/JsonExtractor') },
      { find: /^@utils\/RetryPolicy/, replacement: path.resolve(__dirname, '../../server/src/utils/RetryPolicy') },
      { find: /^@utils\/SecurityPrompts/, replacement: path.resolve(__dirname, '../../server/src/utils/SecurityPrompts') },
      { find: /^@utils\/StructuredOutputEnforcer/, replacement: path.resolve(__dirname, '../../server/src/utils/StructuredOutputEnforcer') },
      { find: /^@utils\/TemperatureOptimizer/, replacement: path.resolve(__dirname, '../../server/src/utils/TemperatureOptimizer') },
      { find: /^@utils\/validation/, replacement: path.resolve(__dirname, '../../server/src/utils/validation') },
      { find: /^@utils\/requestHelpers/, replacement: path.resolve(__dirname, '../../server/src/utils/requestHelpers') },
      { find: /^@utils\/validateEnv/, replacement: path.resolve(__dirname, '../../server/src/utils/validateEnv') },
      { find: /^@utils/, replacement: path.resolve(__dirname, '../../client/src/utils') },
      { find: 'react', replacement: path.resolve(__dirname, '../../node_modules/react') },
      { find: 'react-dom', replacement: path.resolve(__dirname, '../../node_modules/react-dom') },
    ],
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./config/test/vitest.setup.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/*.performance.test.{js,jsx,ts,tsx}',
      'tests/integration/**',
      'docs/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{js,jsx}',
        '**/*.spec.{js,jsx}',
        'vite.config.js',
        'vitest.config.js',
        'vitest.setup.js',
        'eslint.config.js',
        'postcss.config.js',
        'tailwind.config.js',
        'src/main.jsx',
        'e2e/**',
        'scripts/**',
        'playwright.config.js',
      ],
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 75,
        statements: 85,
      },
    },
    testTimeout: 10000,
  },
});
