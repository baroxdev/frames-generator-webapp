import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts (used for the app build) so the test runner's
// config can evolve independently of the Vite dev/build pipeline.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
