import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  createLayout,
  hashString,
  normaliseConfig,
  renderSvg,
  stampPath,
  type CornerMode,
  type StampConfigInput,
} from './index.ts';

/**
 * Determinism rules from the brief: one seeded PRNG consumed in a fixed order,
 * per-tooth detail from a stateless hash, path coordinates rounded to 2
 * decimals, and the path string snapshot-tested for a fixed set of seeds.
 */

const CORNERS: readonly CornerMode[] = ['offset', 'hole', 'solid'];

describe('determinism', () => {
  it('gives a byte-identical path and SVG for the same seed and config', () => {
    const config = { ...DEFAULT_CONFIG, seed: 1234 };
    expect(stampPath(createLayout(config))).toEqual(stampPath(createLayout(config)));
    expect(renderSvg(config, null)).toBe(renderSvg(config, null));
  });

  it('matches the prototype for seed 7, perf 14, wear 0.38, square, bleed', () => {
    // Verified byte-for-byte against the Perforation Lab prototype with one
    // change applied: pulled-perf depth comes from the tooth hash, not the layout
    // PRNG (see `createLayout`). Without that change the prototype matches
    // up to the first pulled tooth, on the left edge.
    const { outline, teeth, fibres } = stampPath(createLayout(DEFAULT_CONFIG));
    expect(outline).toMatchSnapshot();
    expect({ teeth: hashString(teeth), fibres: fibres.length }).toMatchSnapshot();
  });

  it('keeps path strings stable across a fixed set of seeds and modes', () => {
    const digests: Record<string, string> = {};
    for (const seed of [1, 7, 42, 1234]) {
      for (const corners of CORNERS) {
        for (const wear of [0, 0.38, 1]) {
          const config: StampConfigInput = { seed, wear, perforation: { corners } };
          const { outline } = stampPath(createLayout(config));
          digests[`${seed}/${corners}/${wear}`] =
            `${hashString(outline).toString(16)}:${outline.length}`;
        }
      }
    }
    expect(digests).toMatchSnapshot();
  });

  it('rounds every path coordinate to at most 2 decimals', () => {
    const { outline, teeth } = stampPath(createLayout({ seed: 3, wear: 1 }));
    expect(`${outline}${teeth}`).not.toMatch(/\d\.\d{3}/);
  });

  it('does not reorder layout draws when wear changes', () => {
    // Wear sets the pulled-perf chance; the prototype drew a pulled tooth's
    // depth from the layout PRNG, which shifted every later draw.
    const strip = (wear: number) =>
      createLayout({ seed: 7, wear }).edges.flatMap((edge) =>
        edge.teeth.map(({ profile, flip, invert, fibreRoll, hash }) => ({
          profile,
          flip,
          invert,
          fibreRoll,
          hash,
        })),
      );
    expect(strip(1)).toEqual(strip(0));
    expect(strip(0.38)).toEqual(strip(0));
  });
});

describe('normaliseConfig', () => {
  it('fills a partial config from the defaults', () => {
    expect(normaliseConfig({})).toEqual(DEFAULT_CONFIG);
    expect(normaliseConfig({ perforation: { gauge: 12 } }).perforation).toEqual({
      ...DEFAULT_CONFIG.perforation,
      gauge: 12,
    });
  });

  it('clamps out-of-range values and rejects unknown enums', () => {
    // As if read back from a hand-edited URL.
    const corners: string = 'round';
    const config = normaliseConfig({
      seed: 3.7,
      wear: 4,
      // @ts-expect-error -- 'round' is not a corner mode
      perforation: { holeSize: 2, corners },
      tears: { profiles: { spur: 3, nibble: -1 }, fibres: Number.NaN },
      print: { area: 'bordered', margin: 50 },
    });
    expect(config.seed).toBe(3);
    expect(config.wear).toBe(1);
    expect(config.perforation.holeSize).toBe(0.9);
    expect(config.perforation.corners).toBe('offset');
    expect(config.tears.profiles['spur']).toBe(1);
    expect(config.tears.profiles['nibble']).toBe(0);
    expect(config.tears.fibres).toBe(DEFAULT_CONFIG.tears.fibres);
    expect(config.print).toEqual({ area: 'bordered', margin: 12 });
  });

  it('is idempotent and survives a JSON round trip, so it round-trips through a URL', () => {
    const once = normaliseConfig({ seed: 9, wear: 0.7, print: { area: 'bordered' } });
    expect(normaliseConfig(once)).toEqual(once);
    expect(JSON.parse(JSON.stringify(once))).toEqual(once);
  });
});
