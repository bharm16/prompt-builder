import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, '../../client'),
  envDir: path.resolve(__dirname, '../../'),
  build: {
    outDir: path.resolve(__dirname, '../../dist'),
    sourcemap: true,
  },
  css: {
    postcss: path.resolve(__dirname, './postcss.config.js'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../client/src'),
      '@/components': path.resolve(__dirname, '../../client/src/components'),
      '@/hooks': path.resolve(__dirname, '../../client/src/hooks'),
      '@/types': path.resolve(__dirname, '../../client/src/types'),
      '@/utils': path.resolve(__dirname, '../../client/src/utils'),
      '@/api': path.resolve(__dirname, '../../client/src/api'),
      '@shared': path.resolve(__dirname, '../../shared'),
    },
  },
  plugins: [
    react(),
    process.env.NODE_ENV === 'production' && process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: {
            assets: path.resolve(__dirname, '../../dist/**'),
            ignore: ['node_modules'],
            filesToDeleteAfterUpload: [path.resolve(__dirname, '../../dist/**/*.map')],
          },
          release: {
            name: process.env.VITE_APP_VERSION || 'unknown',
            cleanArtifacts: true,
            setCommits: {
              auto: true,
              ignoreMissing: true,
            },
          },
        })
      : undefined,
  ].filter(Boolean) as ReturnType<typeof defineConfig>['plugins'],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/llm': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/metrics': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

