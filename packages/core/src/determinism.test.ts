import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, PRESETS, SHAPES, pitchMm, pitchUnits, roundCoord } from './index.js';

/**
 * The real determinism suite lands with the core in build step 2. These are the
 * acceptance checks from the brief, written out as the targets to hit:
 *
 * - Same seed and config give a byte-identical path string across runs, Node and
 *   browser.
 * - Every edge holds a whole number of holes; corners line up in all three corner
 *   modes.
 * - Tooth offsets are 0 where they meet hole arcs (no kinks at arc joins).
 * - Full bleed shows no light rim at the edge at 1x and 4x zoom.
 * - Hole arcs stay smooth at every wear level; only teeth roughen.
 * - Turning a tear profile off changes only the teeth that used it.
 * - Browser SVG and server PNG match visually for the same config (v1.1).
 * - Output matches the prototype for seed 7, perf 14, wear 0.38, square, bleed.
 *
 * What is testable today: the units and the defaults.
 */
describe('units', () => {
  it('derives pitch from gauge', () => {
    expect(pitchMm(14)).toBeCloseTo(1.4286, 4);
    expect(pitchMm(10)).toBe(2);
    expect(pitchUnits(10)).toBe(20);
  });

  it('rounds coordinates to 2 decimals', () => {
    expect(roundCoord(1.23456)).toBe(1.23);
    expect(roundCoord(-0.005)).toBe(-0);
  });
});

describe('defaults', () => {
  it('matches the brief: seed 7, gauge 14, wear 0.38, square, bleed', () => {
    expect(DEFAULT_CONFIG.seed).toBe(7);
    expect(DEFAULT_CONFIG.perforation.gauge).toBe(14);
    expect(DEFAULT_CONFIG.perforation.holeSize).toBe(0.55);
    expect(DEFAULT_CONFIG.wear).toBe(0.38);
    expect(DEFAULT_CONFIG.size).toEqual(SHAPES.square);
    expect(DEFAULT_CONFIG.print).toEqual({ area: 'bleed' });
  });

  it('ships the six starter profile keys enabled', () => {
    expect(Object.keys(DEFAULT_CONFIG.tears.profiles)).toEqual([
      'clean',
      'step',
      'nibble',
      'spur',
      'lean',
      'frayed',
    ]);
  });

  it('keeps the config JSON-serialisable, so it round-trips through a URL', () => {
    expect(JSON.parse(JSON.stringify(DEFAULT_CONFIG))).toEqual(DEFAULT_CONFIG);
  });

  it('presets are partial configs', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(JSON.parse(JSON.stringify(preset))).toEqual(preset);
    }
  });
});
