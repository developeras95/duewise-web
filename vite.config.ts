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
      // Pages are loaded on demand (see App.tsx), and Vite splits shared libraries into their own
      // files automatically. MUI's data grid is the largest (~750 kB, 230 kB compressed) and is
      // loaded only by pages with tables.
      chunkSizeWarningLimit: 800,
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
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      environmentOptions: { jsdom: { url: 'http://localhost:3000/' } },
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // Tests that type into forms take a few seconds; CI runners are about half as fast as a laptop.
      testTimeout: 15_000,
      coverage: {
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/api/schema.d.ts', 'src/main.tsx'],
        // The build fails if coverage drops below these (a few points under today's numbers).
        // The end-to-end tests in e2e/ cover the rest, against the real API.
        thresholds: { lines: 75, branches: 60 },
      },
    },
  };
});
