import { hash2 } from './prng.ts';

/**
 * Value noise for fine roughness along a tooth, in `[-1, 1]`. Smoothstep
 * interpolation between hashed lattice values; a pure function of its arguments.
 */
export function valueNoise1d(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash2(i, seed) * 2 - 1;
  const b = hash2(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}
