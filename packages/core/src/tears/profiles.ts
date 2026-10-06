import type { TearProfile } from '../types.js';

/**
 * The six starter profiles. Points are `[u, offset]` arrays with offset 0 at
 * u = 0 and u = 1.
 *
 * TODO(step 2): copy the points from the Perforation Lab prototype. These are
 * placeholders so the library shape and keys are reviewable; none of them
 * describes a real tear yet.
 */
export const CLEAN: TearProfile = { name: 'clean', points: [] };
export const STEP: TearProfile = { name: 'step', points: [] };
export const NIBBLE: TearProfile = { name: 'nibble', points: [] };
export const SPUR: TearProfile = { name: 'spur', points: [] };
export const LEAN: TearProfile = { name: 'lean', points: [] };
export const FRAYED: TearProfile = { name: 'frayed', points: [] };

export const STARTER_PROFILES: readonly TearProfile[] = [CLEAN, STEP, NIBBLE, SPUR, LEAN, FRAYED];
