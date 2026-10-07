import type { NextConfig } from 'next';

const config: NextConfig = {
  // Like the lab, the editor reads the workspace packages from source, so core
  // changes show up without a build.
  transpilePackages: ['@leima/core', '@leima/react'],
  turbopack: {
    resolveAlias: {
      '@leima/core': '../../packages/core/src/index.ts',
      '@leima/react': '../../packages/react/src/index.ts',
    },
  },
  // `pnpm types:check` typechecks with TypeScript 7, which Next's own check
  // cannot drive.
  typescript: { ignoreBuildErrors: true },
};

export default config;
