import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Test against core's source, as typechecking does. CI runs the tests before
    // the build, so core's dist does not exist yet.
    alias: {
      '@leima/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'react',
    // <Stamp> must server-render, so its tests render to markup in Node.
    environment: 'node',
    include: ['src/**/*.test.tsx'],
  },
});
