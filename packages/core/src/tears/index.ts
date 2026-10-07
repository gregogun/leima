import { hash2, hashString } from '../prng.js';
import type { ProfilePoint, TearLibrary, TearProfile } from '../types.js';
import { STARTER_PROFILES } from './profiles.js';

export { STARTER_PROFILES, CLEAN, STEP, NIBBLE, SPUR, LEAN, FRAYED } from './profiles.js';

/**
 * Per-tooth hash indices. Fibres use 1 and 10..49 (see `path.ts`); keep these
 * clear of them so no two decisions share a draw.
 */
export const HASH_PULL_DEPTH = 3;
const HASH_PROFILE_ACCEPT = 4;

/**
 * The default library is the six starters. Users register their own profiles as
 * point arrays: `createTearLibrary([...STARTER_PROFILES, defineProfile(...)])`.
 */
export function createTearLibrary(
  profiles: readonly TearProfile[] = STARTER_PROFILES,
): TearLibrary {
  const library = new Map<string, TearProfile>();
  for (const profile of profiles) {
    if (library.has(profile.name)) {
      throw new Error(`[@leima/core] Tear profile "${profile.name}" is registered twice.`);
    }
    library.set(profile.name, defineProfile(profile.name, profile.points));
  }
  return library;
}

export const DEFAULT_TEAR_LIBRARY: TearLibrary = createTearLibrary();

/** Validates that offset is 0 at u = 0 and u = 1, and that u is sorted and in range. */
export function defineProfile(name: string, points: readonly ProfilePoint[]): TearProfile {
  const fail = (why: string): never => {
    throw new Error(`[@leima/core] Tear profile "${name}" ${why}.`);
  };
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) fail('needs at least two points');
  if (first?.[0] !== 0 || first[1] !== 0) fail('must start at [0, 0]');
  if (last?.[0] !== 1 || last[1] !== 0) fail('must end at [1, 0]');
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const point = points[i];
    if (!prev || !point || point[0] < prev[0]) fail('must have u sorted ascending');
    if (!Number.isFinite(point?.[1])) fail('has a non-finite offset');
  }
  return { name, points };
}

/**
 * Picks a profile for one tooth from the enabled weights, or `null` when every
 * profile is off.
 *
 * The pick must be stable under weight changes. The prototype indexed into the
 * enabled list, so toggling one profile reassigned teeth that never used it.
 * Here each tooth has a first choice, `library[floor(roll * size)]`, accepted
 * with probability equal to its weight. A rejected tooth falls back to stable
 * weighted sampling (`argmax(hash_p ** (1 / weight_p))`), with one hash per
 * profile name.
 *
 * - With every weight at 1 the first choice always stands, so the default
 *   library picks exactly as the prototype did.
 * - Turning a profile off, or lowering its weight, moves only the teeth that
 *   profile won. Raising it pulls teeth only towards it.
 * - The odds stay proportional to the weights: P(p) = w_p / sum(w).
 *
 * Weights are clamped to `[0, 1]`. A weight over 1 would change the odds of
 * every other profile, so 1 is "full".
 */
export function pickProfile(
  library: TearLibrary,
  weights: Readonly<Record<string, number>>,
  roll: number,
  toothHash: number,
): string | null {
  const names = [...library.keys()];
  const weightOf = (name: string) => Math.min(1, Math.max(0, weights[name] ?? 0));

  const first = names[Math.floor(roll * names.length)];
  if (first !== undefined && hash2(toothHash, HASH_PROFILE_ACCEPT) < weightOf(first)) {
    return first;
  }

  let best: string | null = null;
  let bestScore = -Infinity;
  for (const name of names) {
    const weight = weightOf(name);
    if (weight === 0) continue;
    // log(h ** (1 / w)), so the argmax never underflows.
    const score = Math.log(hash2(toothHash, hashString(name))) / weight;
    if (best === null || score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}

/** Evaluates a profile's piecewise-linear offset at `u`. */
export function sampleProfile(profile: TearProfile, u: number): number {
  let previous: ProfilePoint | undefined;
  for (const point of profile.points) {
    const [u1, v1] = point;
    if (previous && u <= u1) {
      const [u0, v0] = previous;
      return v0 + (v1 - v0) * ((u - u0) / (u1 - u0 || 1));
    }
    previous = point;
  }
  return 0;
}
