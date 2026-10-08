# leima

An open source TypeScript library that generates realistic perforated postage stamps
from a seeded config, with React bindings and server rendering through Satori. A free
web editor sits on top as the showcase.

> Status: scaffold. The core maths lands in build step 2 — every function below throws
> until then. See [Build order](#build-order).

## How it works

Approach C, **curated tears**: procedural hole layout with each tooth tip drawn from a
library of hand-authored tear profiles. It stays vector, works in Satori, and is
art-directed by curating profiles rather than tuning noise.

The core is a pure function from config to layout, then layout to an SVG string. No DOM,
no randomness outside the seeded PRNG, no runtime dependencies. The browser and the
server both start from that SVG string, so they cannot drift apart.

Physical rules the geometry encodes:

- Punched holes are clean; torn teeth are rough. Tear profiles and roughness apply only
  to the tooth segments between holes, never to hole arcs.
- Pitch snaps per edge to a whole number of holes, so corners line up.
- The print is centred. Misregistration, an offset within the stamp, is an opt-in
  control and off by default. In bleed mode the print extends past the trim so an
  offset never shows a gap.

## Packages

| Package         | Role                                                                                  | Depends on            |
| --------------- | ------------------------------------------------------------------------------------- | --------------------- |
| `@leima/core`   | Config types, PRNG and noise, layout, path builder, tear library, SVG string renderer | nothing               |
| `@leima/react`  | `<Stamp>` component                                                                   | core, react           |
| `@leima/server` | `renderPng` via resvg; `stampDataUri` for Satori layouts (v1.1)                       | core, @resvg/resvg-js |
| `apps/web`      | Editor, docs and landing page as one Next.js site; serves share-preview images        | react, core, server   |
| `apps/lab`      | Internal visual test bench (Vite), not user-facing                                    | core                  |

> Public npm names are **not** settled yet — these are workspace names only, and every
> package is `private: true` so nothing publishes by accident. Decide before the first
> release.

## API

```ts
type StampConfig = {
  seed: number;
  size: { width: number; height: number }; // mm
  perforation: {
    gauge: number;    // holes per 2 cm
    holeSize: number; // 0..1 share of pitch
    corners: 'offset' | 'hole' | 'solid';
  };
  wear: number;       // 0..1
  misregistration: number; // 0..1, 0 = centred
  print: { area: 'bleed' } | { area: 'bordered'; margin: number }; // mm
  tears: {
    profiles: Record<string, number>; // weight per profile, 0 = off
    fibres: number;                   // 0..1 density
    roughness: number;                // 0..1
  };
  paper?: string;
};

// core (no DOM)
createLayout(config): StampLayout
stampPath(layout): { outline: string; teeth: string; fibres: FibreStroke[] }
renderSvg(config, image): string

// react
<Stamp config={config} image={src} />

// server (v1.1)
renderPng(config, image, { scale }): Promise<Uint8Array>
stampDataUri(config, image): string
```

The config is plain JSON-serialisable data: it round-trips through a URL and renders
identically on client and server. Presets ("mint", "lightly worn", "well travelled") are
just partial configs. Profiles ship as a default library; users can register their own as
point arrays.

## Scope

**v1:** perforated outline geometry with curated tears, bordered and full-bleed print,
image fit, corner modes, shapes, the `<Stamp>` component, SVG and PNG export from the
editor (client side).

**Out of scope for v1:** the server package (v1.1), raster effects (grain, dithering,
halftone), postmarks, AI image generation. The architecture leaves room for them.

Effects tiers: (1) geometry and fills — v1, works everywhere. (2) Raster effects —
client side via WebGL, server side as a post-process on the PNG.

## Build order

1. ~~Scaffold the monorepo, tooling and CI.~~
2. **Core:** PRNG, noise, layout, path builder, tear library, `renderSvg`. Port the maths
   from the prototype. Prove determinism before any UI.
3. **Lab** (Vite): seed grid and debug overlays first, to check parity with the prototype.
4. **React** `<Stamp>`.
5. **Web app** (Next.js): editor with controls, image upload and fit, URL state,
   client-side SVG and PNG export.
6. **v1.1:** server package, share-preview images for editor links, the Satori helper
   once verified.
7. Later: a "How it works" docs page with live stamps.

## Acceptance checks

- Same seed and config give a byte-identical path string across runs, Node and browser.
- Every edge holds a whole number of holes; corners line up in all three corner modes.
- Tooth offsets are 0 where they meet hole arcs (no kinks at arc joins).
- Full bleed shows no light rim at the edge at 1x and 4x zoom.
- Hole arcs stay smooth at every wear level; only teeth roughen.
- Turning a tear profile off changes only the teeth that used it.
- Browser SVG and server PNG match visually for the same config (v1.1).
- Output matches the prototype for seed 7, perf 14, wear 0.38, square, bleed.

## Open questions

- **Profile weights:** how picks stay stable when weights change. The prototype reassigns
  teeth when a profile is toggled. Proposed fix recorded in `packages/core/src/tears/index.ts`:
  stable weighted sampling, `argmax(hash_p ** (1 / weight_p))` per tooth.
- Where the tear library comes from long term: hand-drawn in Paper, or traced from scans
  of real stamps.
- Image focal point or safe area, so cover-crop in full bleed doesn't push key content
  into the perforations.
- Multiple images per stamp: layering model and API.
- Whether the drop shadow belongs in the core at all.
- **Satori:** does a stamp embedded as an `<img>` with an SVG data URI render its pattern
  fill correctly? Verify before building the Satori helper.

## Development

```sh
pnpm install
pnpm check      # format:check + lint + types:check + knip + test
pnpm build
```

Stack: TypeScript, pnpm workspaces, tsup for builds, Vitest for unit and snapshot tests,
Vite for the lab, Next.js for the web app. Editor state in Zustand, serialised to the URL.
Design work happens in Paper.

The core stays free of runtime dependencies: the PRNG and value noise are a few lines each.

## Licence

MIT
