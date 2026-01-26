import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, '../../'),
  plugins: [react()],
  resolve: {
    // Path aliases matching tsconfig.json for both client and server
    // Note: Order matters - more specific patterns should come before general ones
    alias: [
      // Mock lucide-react icons for test environment stability
      { find: /^lucide-react$/, replacement: path.resolve(__dirname, '../../tests/mocks/lucide-react.ts') },

      // Client utils shim for shared @utils/cn usage in client components
      { find: /^@utils\/cn$/, replacement: path.resolve(__dirname, '../../client/src/utils/cn') },

      // Shared aliases (used by both client and server) - from both tsconfig.json files
      { find: /^@shared\/(.*)/, replacement: path.resolve(__dirname, '../../shared/$1') },
      { find: /^#shared\/(.*)/, replacement: path.resolve(__dirname, '../../shared/$1') },
      { find: '@shared', replacement: path.resolve(__dirname, '../../shared') },
      { find: '#shared', replacement: path.resolve(__dirname, '../../shared') },

      // Server-specific aliases (from server/tsconfig.json)
      { find: /^@infrastructure\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/infrastructure/$1') },
      { find: '@infrastructure', replacement: path.resolve(__dirname, '../../server/src/infrastructure') },
      { find: /^@interfaces\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/interfaces/$1') },
      { find: '@interfaces', replacement: path.resolve(__dirname, '../../server/src/interfaces') },
      { find: /^@llm\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/llm/$1') },
      { find: '@llm', replacement: path.resolve(__dirname, '../../server/src/llm') },
      { find: /^@api\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/api/$1') },
      { find: '@api', replacement: path.resolve(__dirname, '../../server/src/api') },
      { find: /^@middleware\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/middleware/$1') },
      { find: '@middleware', replacement: path.resolve(__dirname, '../../server/src/middleware') },
      { find: /^@routes\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/routes/$1') },
      { find: '@routes', replacement: path.resolve(__dirname, '../../server/src/routes') },
      { find: /^@clients\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/clients/$1') },
      { find: '@clients', replacement: path.resolve(__dirname, '../../server/src/clients') },
      { find: /^@server\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/$1') },
      { find: '@server', replacement: path.resolve(__dirname, '../../server/src') },

      // Client-specific aliases (from client/tsconfig.json)
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, '../../client/src/$1') },
      { find: /^@components\/(.*)/, replacement: path.resolve(__dirname, '../../client/src/components/$1') },
      { find: '@components', replacement: path.resolve(__dirname, '../../client/src/components') },
      { find: /^@features\/(.*)/, replacement: path.resolve(__dirname, '../../client/src/features/$1') },
      { find: '@features', replacement: path.resolve(__dirname, '../../client/src/features') },
      { find: /^@hooks\/(.*)/, replacement: path.resolve(__dirname, '../../client/src/hooks/$1') },
      { find: '@hooks', replacement: path.resolve(__dirname, '../../client/src/hooks') },
      { find: /^@styles\/(.*)/, replacement: path.resolve(__dirname, '../../client/src/styles/$1') },
      { find: '@styles', replacement: path.resolve(__dirname, '../../client/src/styles') },
      { find: /^@lib\/(.*)/, replacement: path.resolve(__dirname, '../../client/src/lib/$1') },
      { find: '@lib', replacement: path.resolve(__dirname, '../../client/src/lib') },
      { find: /^@schemas\/(.*)/, replacement: path.resolve(__dirname, '../../client/src/schemas/$1') },
      { find: '@schemas', replacement: path.resolve(__dirname, '../../client/src/schemas') },
      { find: /^@repositories\/(.*)/, replacement: path.resolve(__dirname, '../../client/src/repositories/$1') },
      { find: '@repositories', replacement: path.resolve(__dirname, '../../client/src/repositories') },

      // Shared aliases that exist in both client and server
      // For tests, server paths take precedence for @config, @services, @types
      // @config - server config (server/src/config)
      { find: /^@config\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/config/$1') },
      { find: '@config', replacement: path.resolve(__dirname, '../../server/src/config') },
      // @services - server services (server/src/services)
      { find: /^@services\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/services/$1') },
      { find: '@services', replacement: path.resolve(__dirname, '../../server/src/services') },
      // @types - server types (server/src/types)
      { find: /^@types\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/types/$1') },
      { find: '@types', replacement: path.resolve(__dirname, '../../server/src/types') },
      // @utils - server utils take precedence (server/src/utils)
      { find: /^@utils\/(.*)/, replacement: path.resolve(__dirname, '../../server/src/utils/$1') },
      { find: '@utils', replacement: path.resolve(__dirname, '../../server/src/utils') },

      // React resolution
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
