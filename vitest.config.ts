import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each package owns its own vitest config so it can pick its environment.
    // Add packages here as they grow tests.
    projects: ['packages/core'],
  },
});
