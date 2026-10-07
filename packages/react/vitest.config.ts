import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'react',
    // <Stamp> must server-render, so its tests render to markup in Node.
    environment: 'node',
    include: ['src/**/*.test.tsx'],
  },
});
