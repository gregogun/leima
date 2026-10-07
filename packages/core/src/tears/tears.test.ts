import { describe, expect, it } from 'vitest';
import { createLayout, stampPath } from '../index.js';
import {
  DEFAULT_TEAR_LIBRARY,
  STARTER_PROFILES,
  createTearLibrary,
  defineProfile,
  pickProfile,
  sampleProfile,
} from './index.js';

const ALL_ON = { clean: 1, step: 1, nibble: 1, spur: 1, lean: 1, frayed: 1 };

/** One tooth subpath per entry, in walk order. */
const toothPaths = (teeth: string) => teeth.split('M').slice(1);

describe('tear profiles', () => {
  it('ships six starters that start and end on the edge line', () => {
    expect(STARTER_PROFILES.map((p) => p.name)).toEqual([
      'clean',
      'step',
      'nibble',
      'spur',
      'lean',
      'frayed',
    ]);
    for (const profile of STARTER_PROFILES) {
      expect(sampleProfile(profile, 0)).toBe(0);
      expect(sampleProfile(profile, 1)).toBe(0);
    }
  });

  it('interpolates linearly between points', () => {
    const profile = defineProfile('tent', [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ]);
    expect(sampleProfile(profile, 0.25)).toBe(0.5);
    expect(sampleProfile(profile, 0.75)).toBe(0.5);
  });

  it('rejects profiles that would kink at a hole arc', () => {
    expect(() =>
      defineProfile('lifted', [
        [0, 0.1],
        [1, 0],
      ]),
    ).toThrow(/start at \[0, 0\]/);
    expect(() =>
      defineProfile('open', [
        [0, 0],
        [1, 0.1],
      ]),
    ).toThrow(/end at \[1, 0\]/);
    expect(() =>
      defineProfile('back', [
        [0, 0],
        [0.6, 1],
        [0.4, 1],
        [1, 0],
      ]),
    ).toThrow(/sorted/);
    expect(() => createTearLibrary([...STARTER_PROFILES, STARTER_PROFILES[0]!])).toThrow(/twice/);
  });

  it('registers custom profiles alongside the starters', () => {
    const notch = defineProfile('notch', [
      [0, 0],
      [0.5, -0.8],
      [1, 0],
    ]);
    const library = createTearLibrary([...STARTER_PROFILES, notch]);
    const layout = createLayout({ seed: 7, tears: { profiles: { notch: 1 } } }, library);
    const used = new Set(layout.edges.flatMap((e) => e.teeth.map((t) => t.profile)));
    expect(used.has('notch')).toBe(true);
  });
});

describe('pickProfile', () => {
  it('takes the first choice when every weight is 1, as the prototype did', () => {
    for (let i = 0; i < 600; i++) {
      const roll = i / 600;
      expect(pickProfile(DEFAULT_TEAR_LIBRARY, ALL_ON, roll, i * 7919)).toBe(
        STARTER_PROFILES[Math.floor(roll * 6)]?.name,
      );
    }
  });

  it('returns null when every profile is off', () => {
    expect(pickProfile(DEFAULT_TEAR_LIBRARY, {}, 0.3, 42)).toBeNull();
  });

  it('keeps the odds proportional to the weights', () => {
    const weights = { clean: 1, spur: 0.5, frayed: 0.25 };
    const counts: Record<string, number> = {};
    const trials = 40000;
    for (let i = 0; i < trials; i++) {
      const name = pickProfile(DEFAULT_TEAR_LIBRARY, weights, (i * 0.618034) % 1, i * 2654435761);
      counts[name ?? 'none'] = (counts[name ?? 'none'] ?? 0) + 1;
    }
    expect((counts['clean'] ?? 0) / trials).toBeCloseTo(1 / 1.75, 1);
    expect((counts['spur'] ?? 0) / trials).toBeCloseTo(0.5 / 1.75, 1);
    expect((counts['frayed'] ?? 0) / trials).toBeCloseTo(0.25 / 1.75, 1);
  });

  it('turning a profile off changes only the teeth that used it', () => {
    for (const seed of [1, 7, 42]) {
      const before = createLayout({ seed });
      const after = createLayout({ seed, tears: { profiles: { spur: 0 } } });
      const beforeTeeth = toothPaths(stampPath(before).teeth);
      const afterTeeth = toothPaths(stampPath(after).teeth);
      const picks = (layout: typeof before) =>
        layout.edges.flatMap((e) => e.teeth.map((t) => t.profile));

      const was = picks(before);
      const now = picks(after);
      let moved = 0;
      was.forEach((profile, i) => {
        if (profile === 'spur') {
          moved++;
          expect(now[i]).not.toBe('spur');
        } else {
          expect(now[i]).toBe(profile);
          expect(afterTeeth[i]).toBe(beforeTeeth[i]);
        }
      });
      expect(moved).toBeGreaterThan(0);
    }
  });

  it('lowering a weight only moves teeth away from that profile', () => {
    const was = createLayout({ seed: 3 }).edges.flatMap((e) => e.teeth.map((t) => t.profile));
    const now = createLayout({ seed: 3, tears: { profiles: { lean: 0.4 } } }).edges.flatMap((e) =>
      e.teeth.map((t) => t.profile),
    );
    now.forEach((profile, i) => {
      if (profile !== was[i]) expect(was[i]).toBe('lean');
    });
  });
});
