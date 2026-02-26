import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'node',
    setupFiles: ['./config/test/vitest.integration.setup.ts'],
    include: ['tests/integration/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 30000,
    hookTimeout: 15000,
  },
});
