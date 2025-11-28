import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, '../../'),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../shared'),
      '@config': path.resolve(__dirname, '../../config'),
    },
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
