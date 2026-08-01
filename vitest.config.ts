import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts (used for the app build) so the test runner's
// config can evolve independently of the Vite dev/build pipeline.
export default defineConfig({
  test: {
    // jsdom is required for the component tests under src/**/*.test.tsx
    // (React Testing Library); plain service/query/template tests run fine
    // under it too, so there's no need to split environments per file.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
  },
});
