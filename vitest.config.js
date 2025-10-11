import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
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
        'src/**/*.jsx', // Exclude React components for now
        'src/main.jsx',
      ],
      thresholds: {
        lines: 75,
        functions: 50,
        branches: 60,
        statements: 75,
      },
    },
    testTimeout: 10000,
  },
});
