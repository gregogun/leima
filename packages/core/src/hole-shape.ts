import { valueNoise1d } from './noise.ts';
import { hash2 } from './prng.ts';
import type { Hole, HoleShape, HoleVariation } from './types.ts';

/** Samples per hole when normalising its dents. */
const DENT_SAMPLES = 72;

/** Saturating curve: values ease towards 1 instead of clipping at it. */
const soft = (n: number) => Math.tanh(1.6 * Math.abs(n)) / Math.tanh(1.6);

/**
 * The shape of the `index`th hole round the perimeter (counted clockwise from
 * the top-left corner, continuous across corners), or `null` for a plain circle
 * when `variation.amount` is 0.
 *
 * A rotated ellipse, narrower than the circle (`ry = radius * aspect`) and
 * tilted from the edge direction, then dented by low harmonics of the angle
 * (k = 2..detail, weighted 1 / k^falloff). Each channel is value noise over the
 * hole index with a wavelength in holes, blended with a per-hole hash by
 * `independence`, so neighbours look alike and the look drifts along the edge.
 * Everything is a pure function of the index and seed: no layout PRNG draws.
 *
 * The hole only ever shrinks inside its circle, so neighbours cannot overlap.
 */
export function holeShape(
  variation: HoleVariation,
  radius: number,
  index: number,
  seed: number,
): HoleShape | null {
  const { amount, wavelength, independence } = variation;
  if (amount === 0) return null;
  const base = seed * 7919 + 101;
  const n = (channel: number) => {
    const s = base + channel * 131;
    const smooth = valueNoise1d(index / wavelength, s);
    const own = hash2(index, s + 7) * 2 - 1;
    return smooth * (1 - independence) + own * independence;
  };

  const aspect = 1 - variation.squash * amount * soft(n(1));
  const tiltNoise = n(2);
  const { minTilt, maxTilt } = variation;
  const degrees = Math.sign(tiltNoise) * (minTilt + (maxTilt - minTilt) * soft(tiltNoise)) * amount;

  const harmonics: [number, number, number][] = [];
  for (let k = 2; k <= variation.detail; k++) {
    const w = 1 / Math.pow(k, variation.falloff);
    harmonics.push([k, n(10 + 2 * k) * w, n(11 + 2 * k) * w]);
  }
  const shape: HoleShape = {
    ry: radius * aspect,
    tilt: (degrees * Math.PI) / 180,
    depth: variation.wobble * amount * (0.35 + 0.65 * soft(n(5))),
    harmonics,
    high: 0,
    span: 1,
  };
  // Normalise per hole so the deepest dent is exactly `depth`.
  let low = Infinity;
  let high = -Infinity;
  for (let s = 0; s < DENT_SAMPLES; s++) {
    const value = dent(shape, (s / DENT_SAMPLES) * 2 * Math.PI);
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  return { ...shape, high, span: high - low || 1 };
}

function dent(shape: HoleShape, a: number): number {
  let sum = 0;
  for (const [k, c, s] of shape.harmonics) sum += c * Math.cos(k * a) + s * Math.sin(k * a);
  return sum;
}

/**
 * Distance from a hole's centre to its edge at angle `a`, in the edge's local
 * frame: `a = 0` along the edge, `a = PI / 2` inward.
 */
export function holeRadius(hole: Pick<Hole, 'radius' | 'shape'>, a: number): number {
  const { radius: rx, shape } = hole;
  if (!shape) return rx;
  const { ry, tilt } = shape;
  const ellipse = (rx * ry) / Math.hypot(ry * Math.cos(a - tilt), rx * Math.sin(a - tilt));
  // Clamped: a peak between the normalising samples can rise just past `high`.
  const share = Math.max(0, (shape.high - dent(shape, a)) / shape.span);
  return ellipse * (1 - shape.depth * share);
}

/**
 * The angles where a hole crosses the edge line: `start` in (PI/2, 3PI/2), where
 * the previous tooth ends, and `end` in (-PI/2, PI/2), where the next begins.
 * A tilted, dented hole cuts the line asymmetrically, so each is found by
 * bisection; the hole is star-shaped about its centre, so each bracket holds one
 * crossing.
 */
export function holeCrossings(hole: Pick<Hole, 'radius' | 'shape' | 'perp'>): {
  start: number;
  end: number;
} {
  const v = (a: number) => hole.perp + holeRadius(hole, a) * Math.sin(a);
  return {
    start: bisect(v, Math.PI / 2, (3 * Math.PI) / 2),
    end: bisect(v, -Math.PI / 2, Math.PI / 2),
  };
}

/** Root of `f` between `a` and `b`, given `f` changes sign across them. */
function bisect(f: (x: number) => number, a: number, b: number): number {
  let lo = a;
  let hi = b;
  const sign = Math.sign(f(lo));
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(f(mid)) === sign) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
