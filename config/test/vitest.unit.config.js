import { availableParallelism } from 'node:os';
import { defineConfig, mergeConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import baseConfig from './vitest.config.js';

const clamp = (min, max, value) => Math.min(max, Math.max(min, value));

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const cpuCount = typeof availableParallelism === 'function' ? availableParallelism() : 4;

const defaultServerThreads = clamp(1, 8, cpuCount - 1);
const serverMaxThreads = parsePositiveInt(process.env.VITEST_SERVER_MAX_THREADS) ?? defaultServerThreads;

const defaultClientForks = clamp(1, 4, Math.floor(cpuCount / 2));
const clientMaxForks = parsePositiveInt(process.env.VITEST_CLIENT_MAX_FORKS) ?? defaultClientForks;

const serverPool = process.env.VITEST_SERVER_POOL === 'vmThreads' ? 'vmThreads' : 'threads';
const serverPoolOptions =
  serverPool === 'vmThreads'
    ? {
      vmThreads: {
        isolate: true,
        minThreads: 1,
        maxThreads: serverMaxThreads,
      },
    }
    : {
      threads: {
        isolate: true,
        minThreads: 1,
        maxThreads: serverMaxThreads,
      },
    };

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'server',
            environment: 'node',
            pool: serverPool,
            poolOptions: serverPoolOptions,
            setupFiles: ['./config/test/vitest.setup.server.js'],
            include: [
              'server/src/**/*.{test,spec}.{ts,js}',
              'shared/**/*.{test,spec}.{ts,js}',
              'tests/ci/**/*.{test,spec}.ts',
              'tests/unit/**/*.{test,spec}.ts',
            ],
            exclude: ['tests/unit/span-labeling-gliner-worker.test.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'server-forks',
            environment: 'node',
            pool: 'forks',
            poolOptions: {
              forks: {
                isolate: true,
                minForks: 1,
                maxForks: 1,
              },
            },
            setupFiles: ['./config/test/vitest.setup.server.js'],
            include: ['tests/unit/span-labeling-gliner-worker.test.ts'],
          },
        },
        {
          extends: true,
          plugins: [react()],
          test: {
            name: 'client',
            environment: 'jsdom',
            pool: 'forks',
            poolOptions: {
              forks: {
                isolate: true,
                minForks: 1,
                maxForks: clientMaxForks,
              },
            },
            setupFiles: ['./config/test/vitest.setup.client.js'],
            include: [
              'client/src/**/*.{test,spec}.{ts,tsx,js,jsx}',
              'tests/unit/**/*.{test,spec}.{tsx,jsx}',
            ],
          },
        },
      ],
    },
  })
);
