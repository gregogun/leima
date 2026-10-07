import type { TearProfile } from '../types.ts';

/**
 * The six starter profiles, copied from the Perforation Lab prototype. Points
 * are `[u, offset]` with u along the tooth and offset outward in amplitude
 * units; offset is 0 at u = 0 and u = 1.
 *
 * Library order matters: a tooth's first-choice profile is drawn by index into
 * it, so new starters go on the end.
 */
export const CLEAN: TearProfile = {
  name: 'clean',
  points: [
    [0, 0],
    [0.18, 0.15],
    [0.35, -0.05],
    [0.5, 0.2],
    [0.68, 0.05],
    [0.85, 0.18],
    [1, 0],
  ],
};

export const STEP: TearProfile = {
  name: 'step',
  points: [
    [0, 0],
    [0.2, 0.25],
    [0.42, 0.3],
    [0.47, -0.25],
    [0.7, -0.3],
    [0.88, -0.1],
    [1, 0],
  ],
};

export const NIBBLE: TearProfile = {
  name: 'nibble',
  points: [
    [0, 0],
    [0.25, 0.1],
    [0.4, 0.05],
    [0.47, -0.6],
    [0.58, -0.52],
    [0.66, 0.05],
    [0.85, 0.12],
    [1, 0],
  ],
};

export const SPUR: TearProfile = {
  name: 'spur',
  points: [
    [0, 0],
    [0.2, 0.05],
    [0.38, 0.12],
    [0.49, 0.75],
    [0.55, 0.15],
    [0.75, 0.08],
    [1, 0],
  ],
};

export const LEAN: TearProfile = {
  name: 'lean',
  points: [
    [0, 0],
    [0.12, 0.5],
    [0.4, 0.38],
    [0.6, 0.15],
    [0.8, -0.12],
    [1, 0],
  ],
};

export const FRAYED: TearProfile = {
  name: 'frayed',
  points: [
    [0, 0],
    [0.1, 0.22],
    [0.16, -0.1],
    [0.27, 0.32],
    [0.36, 0.04],
    [0.47, 0.36],
    [0.55, -0.06],
    [0.66, 0.3],
    [0.77, 0],
    [0.88, 0.24],
    [1, 0],
  ],
};

export const STARTER_PROFILES: readonly TearProfile[] = [CLEAN, STEP, NIBBLE, SPUR, LEAN, FRAYED];
