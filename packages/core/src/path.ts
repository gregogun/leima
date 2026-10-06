import { notImplemented } from './internal/not-implemented.js';
import type { StampLayout, StampPath } from './types.js';

/**
 * Walk each edge: emit the tooth as sampled points (about every 0.3 units), then
 * an inward arc for the hole. The inward normal is `(-dy, dx)`; arcs use sweep 0,
 * and large-arc 1 when the hole centre sits inside the edge line. `hole` corner
 * mode adds a quarter-circle arc at each corner into the next edge.
 *
 * Punched holes are clean; torn teeth are rough. Tear profiles and roughness
 * apply only to the tooth segments between holes, never to hole arcs.
 *
 * Coordinates round to 2 decimals, so the path string is snapshot-stable.
 */
export function stampPath(_layout: StampLayout): StampPath {
  notImplemented('stampPath');
}

/**
 * Outward offset at `u` in [0, 1] along a tooth:
 *
 *   amp * (profile(u) + roughness * noise * env) - pull * sin(PI*u)^0.7
 *
 * where `amp = (0.05 + 0.15w) * step` and `env = sin(PI*u)^0.5`. Every term is 0
 * at both ends, so teeth meet hole arcs exactly.
 */
export function toothOffset(_u: number, _tooth: unknown, _step: number, _wear: number): number {
  notImplemented('toothOffset');
}

/** Sample spacing along a tooth, in stamp units. */
export const TOOTH_SAMPLE_STEP = 0.3;
