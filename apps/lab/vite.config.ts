import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The lab exists to look at the core as it changes, so it reads the source
    // rather than a built dist. Typechecking resolves the same way via `paths`.
    alias: {
      '@leima/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'lab',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
