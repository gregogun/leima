import { notImplemented } from './internal/not-implemented.js';

/**
 * One seeded PRNG for the layout, consumed in a fixed order. Changing a visual
 * option must not reorder draws for unrelated parts.
 *
 * mulberry32: a few lines, no runtime dependency.
 */
export type Prng = () => number;

export function mulberry32(_seed: number): Prng {
  notImplemented('mulberry32');
}

/**
 * Stateless hash, for per-tooth detail. Per-tooth draws go through this rather
 * than the layout PRNG so that toggling a profile does not reshuffle other teeth.
 */
export function hash2(_seed: number, _index: number): number {
  notImplemented('hash2');
}

/** Uniform draw in `[min, max)` from a stateless hash. */
export function hashRange(_seed: number, _index: number, _min: number, _max: number): number {
  notImplemented('hashRange');
}
