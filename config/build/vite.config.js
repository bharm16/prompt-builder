import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, '../../client'),
  envDir: path.resolve(__dirname, '../../'), // Load .env from project root
  build: {
    outDir: path.resolve(__dirname, '../../dist'), // Output to project root dist
    sourcemap: true, // Enable source maps for Sentry
  },
  css: {
    postcss: path.resolve(__dirname, './postcss.config.js'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../client/src'),
      '@shared': path.resolve(__dirname, '../../shared')
    }
  },
  plugins: [
    react(),
    
    // Sentry plugin for source map upload (only in production builds)
    process.env.NODE_ENV === 'production' && process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          
          // Configure source map upload
          sourcemaps: {
            assets: path.resolve(__dirname, '../../dist/**'),
            ignore: ['node_modules'],
            filesToDeleteAfterUpload: [path.resolve(__dirname, '../../dist/**/*.map')],
          },
          
          // Configure release
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
  ].filter(Boolean),
  server: {
    proxy: {
      // Proxy API calls to the backend during development to avoid CORS
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/llm': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Optional: expose health/metrics locally if you hit them from the UI
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
