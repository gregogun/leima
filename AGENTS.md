leima generates realistic perforated postage stamps from a seeded config, as a TypeScript library with React bindings and server rendering.

This is a TypeScript repo and uses pnpm as package manager. It is a pnpm workspace: `@leima/core` (pure, zero runtime dependencies), `@leima/react` and `@leima/server` under `packages/`, with `apps/` reserved for the web editor and the visual lab.

## Checks

Run these before calling work done; CI runs the same set, and `pnpm check` runs them in order:

- `pnpm format:check`
- `pnpm lint`
- `pnpm types:check` (root config plus every package)
- `pnpm knip` (unused files, exports and dependencies; delete rather than ignore)
- `pnpm test`

The pre-commit hook (lefthook) formats, lints, typechecks and scans staged files for secrets. Don't bypass it with `--no-verify`; fix the finding.

## Linting

oxlint only — there is no ESLint here. `typescript-eslint` refuses to load against TypeScript 7, which this repo is built on, so the type-aware rules come from `oxlint --type-aware` via `oxlint-tsgolint` instead. `oxlint-tsgolint` is pinned exactly because it bridges to a specific compiler version; bump it together with `oxlint`.

## Conventions

- `@leima/core` takes no runtime dependencies. The PRNG and value noise are a few lines each — keep them that way rather than reaching for a package.
- The core is a pure function from config to layout, then layout to an SVG string. No DOM, no randomness outside the seeded PRNG. Browser and server both start from that SVG string, so they cannot drift.
- Tear profiles and roughness apply only to the tooth segments between holes, never to hole arcs: punched holes are clean, torn teeth are rough.
- Every package is `private: true` and the public npm names are not settled. Don't add a publish step.
- Workspace dependencies use the `workspace:` protocol explicitly; `.npmrc` disables hoisting so a package must declare what it imports.
- Typechecking resolves workspace packages to source via `paths` in `tsconfig.base.json`, so there is no build ordering to respect. At runtime they resolve through `node_modules` to `dist`.

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, etc.). Keep commits meaningfully scoped — one logical change per commit — so history reads as a sequence of intentional moves rather than a dump of unrelated edits.
