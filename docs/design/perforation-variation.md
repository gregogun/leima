# Perforation variation

Status: proposed, parked until the end-to-end path (React, web editor) works.
Extends approach C; does not replace it.

## What we want

On real sheets the perforation holes are clean punches, but not perfect circles.
Some read slightly oval, some are turned a few degrees, some are a touch flatter than
their neighbours, and that variation drifts along the edge rather than jumping hole to
hole. It is never extreme. The tooth tips stay comparatively clean.

Today every hole is a circular arc with tiny jitter (radius within about ±6%), so the
bites all read as equally round.

## Design

Each hole becomes a rotated ellipse instead of a circle:

- `rx` is the hole radius as today. `ry = rx × aspect`, with `aspect` in about
  `[0.85, 1]`. Holes only ever get narrower than today's circle, never wider, so
  neighbouring holes cannot overlap at any `holeSize`.
- The ellipse is rotated by `θ`, about 5–15° in magnitude at full variation, either
  way. Rotation only shows because the hole is no longer circular.

It stays one SVG arc per hole: `A rx ry φ large sweep x y` takes the radii and the
rotation directly. A punched hole is still one clean arc with no sampling and no
roughness, so the rule "punched holes are clean; torn teeth are rough" still holds, and
the output is still plain geometry that resvg renders.

### Where a hole meets the edge

Teeth end where the hole crosses the edge line. That is symmetric today,
`along ± sqrt(r² − perp²)`. A tilted ellipse cuts the line asymmetrically, so solve for
it in the edge's local frame. `u` runs along the edge from the hole's `along`, the
centre sits at `(0, perp)` (inward positive), and the edge line is `v = 0`:

```
((u)·cosθ − (0 − perp)·sinθ)² / rx²  +  ((u)·sinθ + (0 − perp)·cosθ)² / ry²  =  1
```

That is a quadratic in `u`. Its two roots are the tooth `to` (smaller) and the next
tooth's `from` (larger). Keep the existing `1e-4` floor for a hole that barely touches
the line. The large-arc flag rule is unchanged: the arc is the large one when the
centre sits inside the edge line (`perp > 0`).

The arc's rotation `φ` is in stamp coordinates, so it is the edge's direction angle
plus `θ` (0°, 90°, 180°, 270° for top, right, bottom, left). Check the sign once in the
lab with the hole overlay on, since stamp space is y-down.

### Smooth, with a soft ceiling

One control, `perforation.variation` (0..1).

1. **Smooth along the edge.** Drive `aspect` and `θ` from `valueNoise1d` over a hole's
   position along the whole perimeter, measured in holes and continuous across
   corners, with a wavelength of about 4–6 holes. Use separate seeds for the two
   channels, derived from `config.seed`. Neighbours then look alike, and the look
   drifts from crisper runs to softer ones.
2. **Soft ceiling.** Map the noise through a saturating curve before scaling, e.g.
   `s = tanh(1.6 × |n|) / tanh(1.6)`. Then `aspect = 1 − 0.15 × variation × s` and
   `θ = sign(n′) × (5° + 10° × s′) × variation`. Values ease towards the cap instead
   of clipping at it, so raising `variation` gets gentler near the top and never
   reaches an extreme.

### Determinism

- No new layout PRNG draws: noise is a pure function of position and seed. Nothing
  existing reorders, and toggling variation moves only hole shapes and the tooth
  endpoints they imply.
- At `variation: 0`, emit exactly today's string (`A r r 0 …`, the symmetric chord), so
  the core snapshots, the lab digests and prototype parity are byte-identical.
- Decide the default after looking at it in the lab. A non-zero default means
  regenerating the seed 7 snapshot and the lab digests in the same commit, and noting
  that parity with the prototype holds at `variation: 0`.

## Tests

- `variation: 0` gives byte-identical output, which the existing snapshot proves.
- Arc endpoints lie on their ellipse, and tooth offsets are still 0 at the joins.
- Arcs are still unchanged by tear profiles and roughness at every wear level.
- No hole extends past today's circle (`ry ≤ rx`, both within the original radius).
- Neighbouring holes differ less than holes far apart, on average. This checks the
  smoothing actually takes effect.

## Lab

- Add `variation` to the Gauge × wear grid, or give it its own row.
- In the hole overlay, draw the ellipse rather than a circle and add a short tick for
  `θ`.

## Out of scope for this pass

Possible follow-ups, once the end-to-end path is proven:

- Squarer bites (superellipse holes). These need sampled points instead of an arc
  command.
- Rounded versus flat-topped tooth tips driven by the same slow drift.
- Patchy tears: correlating the tear profile picks along the edge.
