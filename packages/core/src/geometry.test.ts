import { describe, expect, it } from 'vitest';
import {
  createLayout,
  edgePoint,
  pitchUnits,
  stampPath,
  toothOffset,
  type CornerMode,
  type StampConfigInput,
} from './index.ts';

/** Physical rules the geometry encodes, from the brief's acceptance checks. */

const CORNERS: readonly CornerMode[] = ['offset', 'hole', 'solid'];
const SIZES = [
  { width: 26, height: 26 },
  { width: 24, height: 30 },
  { width: 30, height: 24 },
];

/** The `A rx ry rot large sweep x y` commands of a path. */
const arcs = (d: string) => d.match(/A[^ALMZ]+/g) ?? [];

describe('layout', () => {
  it('holds a whole number of holes per edge, with corners lined up, in every corner mode', () => {
    for (const corners of CORNERS) {
      for (const size of SIZES) {
        for (const gauge of [10, 14, 17.5]) {
          const layout = createLayout({ seed: 5, size, perforation: { gauge, corners } });
          for (const edge of layout.edges) {
            const n = Math.max(2, Math.round(edge.length / pitchUnits(gauge)));
            expect(edge.step * n).toBeCloseTo(edge.length, 9);
            expect(edge.holes).toHaveLength(corners === 'offset' ? n : n - 1);
            expect(edge.teeth).toHaveLength(edge.holes.length + 1);
            // Teeth start and finish at the corner, or at the shared corner hole.
            expect(edge.teeth[0]?.from).toBe(edge.cornerStart);
            expect(edge.teeth.at(-1)?.to).toBe(edge.length - edge.cornerEnd);
          }
          layout.edges.forEach((edge, e) => {
            const next = layout.edges[(e + 1) % 4];
            // Each edge ends where the next begins, and a shared corner hole has one radius.
            expect(edgePoint(edge, edge.length, 0).x).toBeCloseTo(next?.origin.x ?? NaN, 9);
            expect(edgePoint(edge, edge.length, 0).y).toBeCloseTo(next?.origin.y ?? NaN, 9);
            expect(edge.cornerEnd).toBe(next?.cornerStart);
            expect(edge.cornerEnd > 0).toBe(corners === 'hole');
          });
        }
      }
    }
  });

  it('pulls interior teeth only', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const edge of createLayout({ seed, wear: 1 }).edges) {
        expect(edge.teeth[0]?.pull).toBe(0);
        expect(edge.teeth.at(-1)?.pull).toBe(0);
      }
    }
  });

  it('centres the print, whatever the seed, wear or corners', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const wear of [0, 0.38, 1]) {
        for (const corners of CORNERS) {
          for (const print of [{ area: 'bleed' }, { area: 'bordered', margin: 1.8 }] as const) {
            const { printRect: r, size } = createLayout({
              seed,
              wear,
              perforation: { corners },
              print,
            });
            expect(r.x + r.width / 2).toBeCloseTo(size.width / 2, 9);
            expect(r.y + r.height / 2).toBeCloseTo(size.height / 2, 9);
          }
        }
      }
    }
  });

  it('extends a bleed print past the trim by 0.45 pitch', () => {
    const { printRect: rect, size, pitch } = createLayout({ seed: 2, wear: 1 });
    expect(rect.x).toBeCloseTo(-0.45 * pitch, 9);
    expect(rect.width).toBeCloseTo(size.width + 0.9 * pitch, 9);
  });

  it('insets a bordered print by the margin', () => {
    const layout = createLayout({ seed: 2, print: { area: 'bordered', margin: 2 } });
    const { printRect: rect, size } = layout;
    expect(rect.x).toBe(20);
    expect(rect.width).toBeCloseTo(size.width - 40, 9);
  });
});

describe('path', () => {
  it('meets the hole arcs with zero tooth offset, so there is no kink at a join', () => {
    for (const wear of [0, 0.38, 1]) {
      for (const corners of CORNERS) {
        const layout = createLayout({ seed: 11, wear, perforation: { corners } });
        for (const edge of layout.edges) {
          for (const tooth of edge.teeth) {
            expect(Math.abs(toothOffset(layout, edge, tooth, 0))).toBeLessThan(1e-6);
            expect(Math.abs(toothOffset(layout, edge, tooth, 1))).toBeLessThan(1e-6);
          }
        }
      }
    }
  });

  it('keeps hole arcs clean: tears and roughness never touch them', () => {
    for (const wear of [0, 0.38, 1]) {
      for (const corners of CORNERS) {
        const base: StampConfigInput = { seed: 4, wear, perforation: { corners } };
        const reference = arcs(stampPath(createLayout(base)).outline);
        const rough = arcs(
          stampPath(createLayout({ ...base, tears: { roughness: 1, profiles: { frayed: 1 } } }))
            .outline,
        );
        const flat = arcs(
          stampPath(
            createLayout({
              ...base,
              tears: {
                roughness: 0,
                profiles: { clean: 0, step: 0, nibble: 0, spur: 0, lean: 0, frayed: 0 },
              },
            }),
          ).outline,
        );
        expect(rough).toEqual(reference);
        expect(flat).toEqual(reference);
      }
    }
  });

  it('cuts one arc per hole, plus a quarter-circle per corner in hole mode', () => {
    for (const corners of CORNERS) {
      const layout = createLayout({ seed: 8, perforation: { corners } });
      const holes = layout.edges.reduce((sum, edge) => sum + edge.holes.length, 0);
      expect(arcs(stampPath(layout).outline)).toHaveLength(holes + (corners === 'hole' ? 4 : 0));
    }
  });

  it('draws flat teeth with no profiles and no roughness', () => {
    const layout = createLayout({
      seed: 6,
      wear: 0,
      tears: {
        roughness: 0,
        profiles: { clean: 0, step: 0, nibble: 0, spur: 0, lean: 0, frayed: 0 },
      },
    });
    for (const edge of layout.edges) {
      for (const tooth of edge.teeth) {
        expect(tooth.profile).toBeNull();
        expect(toothOffset(layout, edge, tooth, 0.5)).toBe(0);
      }
    }
  });

  it('grows fibres with density and wear, and none at density 0', () => {
    const count = (fibres: number, wear: number) =>
      stampPath(createLayout({ seed: 7, wear, tears: { fibres } })).fibres.length;
    expect(count(0, 1)).toBe(0);
    expect(count(1, 1)).toBeGreaterThan(count(0.5, 0.38));
    for (const stroke of stampPath(createLayout({ seed: 7, wear: 1, tears: { fibres: 1 } }))
      .fibres) {
      expect(stroke.width).toBeGreaterThanOrEqual(0.12);
      expect(stroke.width).toBeLessThan(0.24);
    }
  });
});
