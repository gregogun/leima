# apps

| App   | Step | Stack   | Job                                                          |
| ----- | ---- | ------- | ------------------------------------------------------------ |
| `lab` | 3    | Vite    | Internal visual bench. Not user-facing.                      |
| `web` | 5    | Next.js | The editor today; later docs, landing page and share images. |

## lab

```sh
pnpm --filter @leima/lab dev
```

`lab` has four jobs and only those four:

1. A grid of stamps across seeds, gauge and wear extremes, and all three corner modes.
2. Debug overlays for hole centres, tooth spans, normals and the bleed rect.
3. Authoring and previewing new tear profiles at 4x before they enter the library.
4. Browser SVG vs server PNG parity.

It is not a second editor, and it does not compare approaches A, B and C.

Built so far: jobs 1 and 2 (the Seeds, Gauge × wear and Corners views; click any stamp
to inspect it at 1× and 4× with its layout stats), plus a Determinism view that checks
the browser produces the same path and SVG bytes as Node. Its reference is
`src/expected-digests.json`, written by the lab's Vitest suite. Job 3 is next; job 4
waits for the server package (v1.1).

The view state lives in the URL hash, so any grid or inspected stamp can be linked.

## web

```sh
pnpm --filter @leima/web dev   # http://localhost:3100
```

The editor, in its Leva phase: every setting is a Leva control while we find settings
that look right, with SVG and PNG export and a "Copy config" button to capture them. A
custom UI (Zustand, possibly with nuqs for URL state) replaces the panel once the settings
settle. Like the lab, it aliases the workspace packages to source.

`apps/web/AGENTS.md` is written by `next dev`; keep it committed so it does not show up
as a change.
