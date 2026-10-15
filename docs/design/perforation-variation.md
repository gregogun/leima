# Perforation variation

Status: implemented, as design D from the prototype (noisy rotated ellipses). The
prototype lives on the `prototype/hole-variation` branch. Extends approach C; does not
replace it.

## What we want

On real sheets the perforation holes are clean punches, but not perfect circles.
Some read slightly oval, some are turned a few degrees, some are a touch flatter or
dented, and that variation drifts along the edge rather than jumping hole to hole. It
is never extreme. The tooth tips stay comparatively clean.

Before this, every hole was a circular arc with tiny jitter (radius within about ±6%),
so the bites all read as equally round.

## What the prototype settled

The prototype compared four designs side by side in the editor:

- A, plain circles (the baseline).
- B, rotated ellipses drawn as one SVG arc each, which is what this doc first proposed.
- C, circles with a noisy outline.
- D, rotated ellipses with a noisy outline.

D won. The tilt alone barely reads at small sizes. The dents (`wobble`) and the drift
along the edge carry most of the realism, and they need sampled points, so a hole can
no longer be one arc command.

## Design

Each hole is a rotated ellipse, dented by a few low harmonics, in the edge's local
frame (angle 0 along the edge, `π/2` inward):

```
ellipse(a) = rx·ry / hypot(ry·cos(a − θ), rx·sin(a − θ))
r(a)       = ellipse(a) × (1 − depth × share(a))
```

- `rx` is the hole radius as before, and `ry = rx × aspect` with `aspect ≤ 1`.
- `share(a)` in `[0, 1]` is the normalised dent: a sum of harmonics `k = 2..detail`
  weighted `1 / k^falloff`, scaled per hole so its highest point is 0 and its deepest
  is 1. It is clamped at 0, because a peak between the 72 normalising samples can rise
  just past the sampled maximum.

Since `aspect ≤ 1` and the dent only cuts inward, a hole never extends past its
circle, so neighbouring holes cannot overlap at any `holeSize`.

### Noise channels

Every quantity reads a noise channel over the hole's index round the whole perimeter
(clockwise from the top-left corner, continuous across corners):

```
n(ch) = valueNoise1d(index / wavelength, s) × (1 − independence)
      + (hash2(index, s + 7) × 2 − 1) × independence,     s = seed·7919 + 101 + ch·131
soft(n) = tanh(1.6·|n|) / tanh(1.6)
```

- `aspect = 1 − squash × amount × soft(n(1))`
- `θ = sign(n(2)) × (minTilt + (maxTilt − minTilt) × soft(n(2))) × amount`
- `depth = wobble × amount × (0.35 + 0.65 × soft(n(5)))`
- the harmonic coefficients are `n(10 + 2k)` and `n(11 + 2k)`

`soft` eases values towards their cap instead of clipping at it. `independence` blends
the smooth drift with a per-hole hash, so 0 gives runs of similar holes and 1 makes
every hole its own.

**The tilt jump.** With `minTilt > 0`, the tilt jumps from `−minTilt` to `+minTilt`
where `n(2)` crosses zero. We kept this on purpose, because it is the formula that was
tuned in the prototype, and a hole tilted by less than `minTilt` reads as a circle
anyway. Set `minTilt: 0` for a tilt that drifts continuously.

### Drawing

A varied hole is sampled, not arced. Points are spaced about 0.15 units apart, at least
24 per hole, from the crossing where the previous tooth ends (`start`, in
`(π/2, 3π/2)`) to the crossing where the next tooth begins (`end`, in `(−π/2, π/2)`).
The hole is star-shaped about its centre, so each of those brackets holds exactly one
crossing, which bisection finds. The samples are clean: tear profiles and roughness
never touch them, so "punched holes are clean; torn teeth are rough" still holds. The
output is still plain path geometry that resvg renders.

Corner holes in `hole` mode stay circular arcs.

## Config

`perforation.variation`, every field clamped in `normaliseConfig`:

| Field          | Range  | Default | Meaning                                      |
| -------------- | ------ | ------- | -------------------------------------------- |
| `amount`       | 0..1   | 0.5     | overall strength; 0 keeps plain circles      |
| `wavelength`   | 1..12  | 1       | noise wavelength, in holes                   |
| `independence` | 0..1   | 0.5     | per-hole hash share against the smooth drift |
| `squash`       | 0..0.4 | 0.2     | largest `1 − aspect`                         |
| `minTilt`      | 0..45  | 10      | smallest tilt, in degrees                    |
| `maxTilt`      | 0..45  | 20      | largest tilt, in degrees                     |
| `wobble`       | 0..0.4 | 0.3     | deepest dent, as a share of the radius       |
| `detail`       | 2..10  | 5       | highest dent harmonic (rounded)              |
| `falloff`      | 0..2   | 1       | harmonic weight `1 / k^falloff`              |

The defaults are the values tuned in the editor.

## Determinism

- No new layout PRNG draws. The noise is a pure function of the hole index and seed,
  so nothing existing reorders, and changing the variation moves only hole shapes and
  the tooth endpoints they imply.
- At `amount: 0`, the output is exactly the previous string (`A r r 0 …` with the
  symmetric chord). The prototype-parity snapshot and the original digest matrix run
  at `amount: 0` and are unchanged. New snapshots cover the default stamp and the
  digest matrix with variation.

## Tests

`packages/core/src/hole-shape.test.ts` checks that:

- holes are circles at `amount: 0`
- variation draws nothing from the layout PRNG
- no hole extends past its circle
- each tooth ends at its hole's edge crossings
- tears and roughness never change the holes
- varied stamps only cut corner arcs
- neighbouring holes are more alike than distant ones
- the settings are clamped

## Lab

- The `Hole variation` view is a grid of `amount` (rows) by `wobble` (columns).
- The hole overlay draws each varied hole's shape, its circle dashed, and a tick for
  `θ`.

## Out of scope for this pass

- Squarer bites (superellipse holes). The holes are sampled now, so this would be
  another term in `r(a)`.
- Rounded versus flat-topped tooth tips driven by the same slow drift.
- Patchy tears: correlating the tear profile picks along the edge.
