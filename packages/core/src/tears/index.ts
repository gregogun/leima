import { notImplemented } from '../internal/not-implemented.js';
import type { ProfilePoint, TearLibrary, TearProfile } from '../types.js';

export { STARTER_PROFILES, CLEAN, STEP, NIBBLE, SPUR, LEAN, FRAYED } from './profiles.js';

/** The default library. Users can register their own profiles as point arrays. */
export function createTearLibrary(_profiles?: readonly TearProfile[]): TearLibrary {
  notImplemented('createTearLibrary');
}

/** Validates that offset is 0 at u = 0 and u = 1, and that u is sorted and in range. */
export function defineProfile(_name: string, _points: readonly ProfilePoint[]): TearProfile {
  notImplemented('defineProfile');
}

/**
 * Picks a profile for one tooth from the enabled weights.
 *
 * Open question in the brief, resolved here as a design constraint: the pick must
 * be stable under weight changes. A weighted CDF reshuffles every tooth
 * downstream of a toggled profile, which is the prototype's bug. Stable weighted
 * sampling instead gives each tooth one stable hash *per profile key* and takes
 * `argmax(hash_p ** (1 / weight_p))`, so turning a profile off only moves the
 * teeth that profile actually won.
 */
export function pickProfile(
  _library: TearLibrary,
  _weights: Record<string, number>,
  _toothHash: number,
): string {
  notImplemented('pickProfile');
}

/** Evaluates a profile's piecewise-linear offset at `u`. */
export function sampleProfile(_profile: TearProfile, _u: number): number {
  notImplemented('sampleProfile');
}
