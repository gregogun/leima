# apps

Both apps arrive later in the build order; this directory is a placeholder so the
workspace glob (`apps/*`) is already in place.

| App   | Step | Stack   | Job                                                         |
| ----- | ---- | ------- | ----------------------------------------------------------- |
| `lab` | 3    | Vite    | Internal visual bench. Not user-facing.                     |
| `web` | 5    | Next.js | Editor, docs and landing page; serves share-preview images. |

`lab` has four jobs and only those four:

1. A grid of stamps across seeds, gauge and wear extremes, and all three corner modes.
2. Debug overlays for hole centres, tooth spans, normals and the bleed rect.
3. Authoring and previewing new tear profiles at 4x before they enter the library.
4. Browser SVG vs server PNG parity.

It is not a second editor, and it does not compare approaches A, B and C.
