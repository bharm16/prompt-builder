import { defineConfig, mergeConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import baseConfig from './vitest.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./config/test/vitest.setup.client.js'],
    },
  })
);
