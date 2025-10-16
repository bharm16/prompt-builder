import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
