import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'core',
    // The core must stay renderable without a browser, so its tests run in Node.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
