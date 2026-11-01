/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development (npm run dev) the page is served by Vite on http://localhost:5173 and every call
// to the Duewise API is forwarded to DUEWISE_API_URL (default: Duewise on http://localhost:8080).
// The browser only ever talks to one address, so the API needs no CORS settings.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.DUEWISE_API_URL || 'http://localhost:8080';
  const toApi = { target: apiUrl, changeOrigin: true };

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          // Libraries change less often than the app: separate files stay cached between releases.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router'],
            mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            data: ['@tanstack/react-query', 'openapi-fetch'],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': toApi,
        '/actuator': toApi,
        '/v3/api-docs': toApi,
        '/swagger-ui': toApi,
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      coverage: { include: ['src/**/*.{ts,tsx}'], exclude: ['src/api/schema.d.ts', 'src/main.tsx'] },
    },
  };
});
