import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, '../../client'),
  envDir: path.resolve(__dirname, '../../'), // Load .env from project root
  build: {
    outDir: path.resolve(__dirname, '../../dist'), // Output to project root dist
  },
  css: {
    postcss: path.resolve(__dirname, './postcss.config.js'),
  },
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API calls to the backend during development to avoid CORS
      '/api': {
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
