import { notImplemented } from './internal/not-implemented.js';
import type { StampConfig, StampLayout } from './types.js';

/**
 * Pure function from config to layout. No DOM, no randomness outside the seeded
 * PRNG.
 *
 * For each edge, walked clockwise from the top-left corner:
 *
 * 1. `n = max(2, round(edgeLength / pitch))`; `step = edgeLength / n`;
 *    `r = holeSize * step / 2`. Pitch snaps per edge to a whole number of holes,
 *    so corners line up.
 * 2. Place holes per corner mode, each with seeded jitter:
 *    - along-edge offset  +/- (0.01 + 0.045w) * step
 *    - perpendicular      +/- (0.02 + 0.1w) * r
 *    - radius             +/- (0.015 + 0.05w) * r
 * 3. One tooth per gap (holes + 1). Each tooth gets a pulled-perf depth
 *    (chance 0.06w, interior teeth only, depth 0.12-0.34 * step), a profile pick,
 *    flip, invert, fibre roll and a hash seed.
 * 4. In `hole` corner mode, a shared corner radius per corner.
 *
 * Misregistration: the print is offset slightly within the stamp, scaled by wear.
 * In bleed mode the print extends past the trim so the offset never shows a gap.
 */
export function createLayout(_config: StampConfig): StampLayout {
  notImplemented('createLayout');
}

/** Fills in defaults and clamps ranges. Exported so the editor can round-trip a URL. */
export function normaliseConfig(_config: Partial<StampConfig>): StampConfig {
  notImplemented('normaliseConfig');
}
