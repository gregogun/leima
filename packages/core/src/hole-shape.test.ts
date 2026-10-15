import { describe, expect, it } from 'vitest';
import {
  createLayout,
  holeRadius,
  normaliseConfig,
  stampPath,
  type CornerMode,
  type Hole,
  type StampConfigInput,
} from './index.ts';

/** The rules from docs/design/perforation-variation.md. */

const CORNERS: readonly CornerMode[] = ['offset', 'hole', 'solid'];
const ANGLES = Array.from({ length: 360 }, (_, i) => (i / 360) * 2 * Math.PI);
const holes = (config: StampConfigInput) => createLayout(config).edges.flatMap((e) => e.holes);

describe('hole variation', () => {
  it('leaves every hole a circle at amount 0', () => {
    for (const hole of holes({ seed: 3, perforation: { variation: { amount: 0 } } })) {
      expect(hole.shape).toBeNull();
    }
  });

  it('draws nothing from the layout PRNG, so no other geometry moves', () => {
    const strip = (amount: number) =>
      createLayout({ seed: 7, wear: 0.7, perforation: { variation: { amount } } }).edges.map(
        (edge) => ({
          holes: edge.holes.map(({ along, perp, radius }) => ({ along, perp, radius })),
          teeth: edge.teeth.map(({ profile, flip, invert, pull, fibreRoll, hash }) => ({
            profile,
            flip,
            invert,
            pull,
            fibreRoll,
            hash,
          })),
        }),
      );
    expect(strip(1)).toEqual(strip(0));
    expect(strip(0.5)).toEqual(strip(0));
  });

  it('never extends a hole past its circle, so neighbours cannot overlap', () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const hole of holes({
        seed,
        perforation: { holeSize: 0.9, variation: { amount: 1, squash: 0.4, wobble: 0.4 } },
      })) {
        for (const a of ANGLES) expect(holeRadius(hole, a)).toBeLessThanOrEqual(hole.radius);
      }
    }
  });

  it('ends each tooth where its hole crosses the edge line', () => {
    for (const corners of CORNERS) {
      for (const wear of [0, 0.38, 1]) {
        const layout = createLayout({ seed: 12, wear, perforation: { corners } });
        for (const edge of layout.edges) {
          edge.holes.forEach((hole, j) => {
            // Both crossings sit on the edge line, either side of the centre.
            for (const a of [hole.start, hole.end]) {
              expect(Math.abs(hole.perp + holeRadius(hole, a) * Math.sin(a))).toBeLessThan(1e-6);
            }
            const offset = (a: number) => holeRadius(hole, a) * Math.cos(a);
            expect(offset(hole.start)).toBeLessThan(0);
            expect(offset(hole.end)).toBeGreaterThan(0);
            expect(edge.teeth[j]?.to).toBeCloseTo(hole.along + offset(hole.start), 9);
            expect(edge.teeth[j + 1]?.from).toBeCloseTo(hole.along + offset(hole.end), 9);
          });
        }
      }
    }
  });

  it('keeps holes clean: tears and roughness never touch them', () => {
    for (const wear of [0, 0.38, 1]) {
      const base: StampConfigInput = { seed: 4, wear };
      const reference = holes(base);
      expect(holes({ ...base, tears: { roughness: 1, profiles: { frayed: 1 } } })).toEqual(
        reference,
      );
      expect(
        holes({
          ...base,
          tears: {
            roughness: 0,
            profiles: { clean: 0, step: 0, nibble: 0, spur: 0, lean: 0, frayed: 0 },
          },
        }),
      ).toEqual(reference);
    }
  });

  it('samples varied holes instead of cutting arcs, leaving only corner arcs', () => {
    for (const corners of CORNERS) {
      const { outline } = stampPath(createLayout({ seed: 8, perforation: { corners } }));
      expect(outline.match(/A/g) ?? []).toHaveLength(corners === 'hole' ? 4 : 0);
    }
  });

  it('makes neighbouring holes more alike than distant ones', () => {
    // Smooth drift only: no per-hole share, and no tilt floor to flip across.
    const config = (seed: number): StampConfigInput => ({
      seed,
      perforation: {
        variation: { amount: 1, independence: 0, wavelength: 5, minTilt: 0, maxTilt: 20 },
      },
    });
    const meanGap = (list: Hole[], distance: number, pick: (hole: Hole) => number) => {
      let sum = 0;
      for (let i = distance; i < list.length; i++) {
        const a = list[i];
        const b = list[i - distance];
        if (a && b) sum += Math.abs(pick(a) - pick(b));
      }
      return sum / (list.length - distance);
    };
    let near = { tilt: 0, ry: 0 };
    let far = { tilt: 0, ry: 0 };
    for (let seed = 1; seed <= 20; seed++) {
      const list = holes(config(seed));
      const tilt = (hole: Hole) => hole.shape?.tilt ?? 0;
      const ry = (hole: Hole) => (hole.shape?.ry ?? hole.radius) / hole.radius;
      near = { tilt: near.tilt + meanGap(list, 1, tilt), ry: near.ry + meanGap(list, 1, ry) };
      far = { tilt: far.tilt + meanGap(list, 10, tilt), ry: far.ry + meanGap(list, 10, ry) };
    }
    expect(near.tilt).toBeLessThan(far.tilt * 0.6);
    expect(near.ry).toBeLessThan(far.ry * 0.6);
  });

  it('clamps the settings and rounds detail to a whole harmonic', () => {
    const { variation } = normaliseConfig({
      perforation: {
        variation: { amount: 3, wavelength: 0, squash: 1, maxTilt: 90, detail: 6.6, falloff: -1 },
      },
    }).perforation;
    expect(variation).toMatchObject({
      amount: 1,
      wavelength: 1,
      squash: 0.4,
      maxTilt: 45,
      detail: 7,
      falloff: 0,
    });
  });
});
